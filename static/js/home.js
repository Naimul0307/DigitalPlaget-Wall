const socket = io();
const canvas = document.getElementById('doodleCanvas');
const ctx = canvas.getContext('2d');
let drawing = false;
let inputField = null;
let isTyping = false;
let draggingText = false;
let draggedText = null;

// Arrays to store all drawing paths and text elements
let drawingPaths = [];
let currentPath = [];
let textElements = [];

// Resize canvas to fit its container
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    redrawCanvas();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Add event listeners for mouse and touch events
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('touchstart', handleTouchStart);
canvas.addEventListener('touchend', handleTouchEnd);
canvas.addEventListener('touchmove', handleTouchMove);

function handleMouseDown(event) {
    const { offsetX, offsetY } = getEventCoords(event);
    if (isTyping) return;
    if (startDragging(offsetX, offsetY)) return;
    startDrawing(offsetX, offsetY);
}

function handleMouseUp() {
    stopDrawing();
    stopDragging();
}

function handleMouseMove(event) {
    const { offsetX, offsetY } = getEventCoords(event);
    if (drawing) {
        drawLine(offsetX, offsetY);
    } else if (draggingText) {
        dragText(offsetX, offsetY);
    }
}

function handleTouchStart(event) {
    const { offsetX, offsetY } = getEventCoords(event.touches[0]);
    if (isTyping) return;
    if (startDragging(offsetX, offsetY)) return;
    startDrawing(offsetX, offsetY);
}

function handleTouchEnd(event) {
    stopDrawing();
    stopDragging();
    if (isTyping) {
        createInputField(event.changedTouches[0]);
    }
    // Prevent further touch events that could interfere
    event.preventDefault();
}


function handleTouchMove(event) {
    event.preventDefault();
    const { offsetX, offsetY } = getEventCoords(event.touches[0]);
    if (drawing) {
        drawLine(offsetX, offsetY);
    } else if (draggingText) {
        dragText(offsetX, offsetY);
    }
}

function startDrawing(x, y) {
    drawing = true;
    currentPath = [{ x, y }];
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function stopDrawing() {
    if (drawing) {
        drawingPaths.push([...currentPath]);
        currentPath = [];
    }
    drawing = false;
    ctx.beginPath();
}

function drawLine(x, y) {
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgb(0, 0, 0)';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    currentPath.push({ x, y });
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingPaths = [];
    textElements = [];
    if (inputField) {
        document.querySelector('.canvas-container').removeChild(inputField);
        inputField = null;
        isTyping = false;
        canvas.removeEventListener('click', createInputField);
        canvas.removeEventListener('touchend', createInputField);
    }
}

function saveDoodle() {
    const dataURL = canvas.toDataURL('image/png');
    console.log("Sending doodle data:", dataURL.substring(0, 50)); // Log the first 50 chars
    socket.emit('submit_doodle', { image: dataURL });
    clearCanvas(); // Clear the canvas after saving
}

function addText() {
    isTyping = true;
    canvas.addEventListener('click', createInputField);
    canvas.addEventListener('touchend', createInputField);
}

function createInputField(event) {
    if (inputField) return;

    const { offsetX, offsetY } = getEventCoords(event);
    const margin = 20;

    const maxWidth = canvas.width - 2 * margin;
    const fontSize = Math.max(canvas.width / 25, 14); // Clamp font size to minimum 14px

    inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.style.position = 'absolute';
    inputField.style.fontSize = `${fontSize}px`;
    inputField.style.padding = '5px';
    inputField.style.border = '2px solid black';
    inputField.style.background = 'rgba(255, 255, 255, 0.8)';
    inputField.style.zIndex = 10;

    inputField.style.width = '80%';
    inputField.style.maxWidth = `${maxWidth}px`;

    // Adjust position to prevent overflow
    let adjustedX = offsetX;
    let adjustedY = offsetY;

    if (adjustedX + maxWidth > canvas.width - margin) {
        adjustedX = canvas.width - maxWidth - margin;
    }

    if (adjustedY + fontSize + 20 > canvas.height) {
        adjustedY = canvas.height - fontSize - 20;
    }

    inputField.style.left = `${adjustedX}px`;
    inputField.style.top = `${adjustedY}px`;

    document.querySelector('.canvas-container').appendChild(inputField);
    inputField.focus();

    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const text = inputField.value;
            addTextElement(text, adjustedX, adjustedY + fontSize);
            document.querySelector('.canvas-container').removeChild(inputField);
            inputField = null;
            isTyping = false;
            canvas.removeEventListener('click', createInputField);
            canvas.removeEventListener('touchend', createInputField);
        }
    });
}

function addTextElement(text, x, y, fontSize = 40, color = 'rgb(0, 0, 0)') {
    const maxTextWidth = canvas.width - 40; // Give 20px margin on each side
    ctx.font = `${fontSize}px Arial`;

    // Reduce font size if even a single word is too long
    while (ctx.measureText(text).width > maxTextWidth && fontSize > 10) {
        fontSize -= 1;
        ctx.font = `${fontSize}px Arial`;
    }

    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine + ' ' + word;
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth < maxTextWidth) {
            currentLine = testLine;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);

    // Add multi-line text element
    textElements.push({ lines, x, y, fontSize, color });
    redrawCanvas();
}


function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw drawing paths
    drawingPaths.forEach(path => {
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        path.forEach(point => {
            ctx.lineTo(point.x, point.y);
        });
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgb(0, 0, 0)';
        ctx.stroke();
    });

    // Redraw text elements with dynamic font sizes
    textElements.forEach(textElement => {
        ctx.font = `${textElement.fontSize}px Arial`;
        ctx.fillStyle = textElement.color;
    
        textElement.lines.forEach((line, index) => {
            const lineY = textElement.y + index * (textElement.fontSize + 5); // 5px spacing
            ctx.fillText(line, textElement.x, lineY);
        });
    });
}


function startDragging(x, y) {
    let startDragging = false;
    textElements.forEach(textElement => {
        if (isInsideText(textElement, x, y)) {
            draggingText = true;
            draggedText = textElement;
            draggedText.offsetX = x - textElement.x;
            draggedText.offsetY = y - textElement.y;
            startDragging = true;
        }
    });
    return startDragging;
}

function dragText(x, y) {
    if (!draggingText || !draggedText) return;

    let newX = x - draggedText.offsetX;
    let newY = y - draggedText.offsetY;

    const lineHeights = draggedText.fontSize + 5;
    const textWidth = Math.max(...draggedText.lines.map(line => {
        ctx.font = `${draggedText.fontSize}px Arial`;
        return ctx.measureText(line).width;
    }));

    // X boundary
    if (newX < 0) newX = 0;
    if (newX + textWidth > canvas.width) newX = canvas.width - textWidth;

    // Y boundaries
    if (newY < draggedText.fontSize) newY = draggedText.fontSize;
    const lastLineY = newY + (draggedText.lines.length - 1) * lineHeights;
    if (lastLineY > canvas.height) {
        newY = canvas.height - (draggedText.lines.length - 1) * lineHeights;
    }

    draggedText.x = newX;
    draggedText.y = newY;
    redrawCanvas();
}

function stopDragging() {
    draggingText = false;
    draggedText = null;
}

function getEventCoords(event) {
    const canvasRect = canvas.getBoundingClientRect();
    return {
        offsetX: event.clientX - canvasRect.left,
        offsetY: event.clientY - canvasRect.top
    };
}
function isInsideText(textElement, x, y) {
    const textHeight = textElement.fontSize * textElement.lines.length;
    const textWidth = Math.max(...textElement.lines.map(line => ctx.measureText(line).width));

    return (
        x >= textElement.x &&
        x <= textElement.x + textWidth &&
        y >= textElement.y - textElement.fontSize &&
        y <= textElement.y + textHeight
    );
}
function detectZoomLevel() {
    var ratio = 0,
        screen = window.screen,
        ua = navigator.userAgent.toLowerCase();

    if (~ua.indexOf('firefox')) {
        if (window.devicePixelRatio !== undefined) {
            ratio = window.devicePixelRatio;
        }
    }
    else if (~ua.indexOf('msie')) {
        if (screen.deviceXDPI && screen.logicalXDPI) {
            ratio = screen.deviceXDPI / screen.logicalXDPI;
        }
    }
    else if (window.outerWidth !== undefined && window.innerWidth !== undefined) {
        ratio = window.outerWidth / window.innerWidth;
    }

    if (ratio) {
        ratio = Math.round(ratio * 100);
    }

    return ratio;
}