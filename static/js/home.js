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

    // Get the canvas dimensions
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Define the size of the input field (you can adjust these values as needed)
    const inputWidth = 800; // Input field width
    const inputHeight = 100; // Input field height

    // Calculate the center position for the input field
    const centerX = (canvasWidth - inputWidth) / 2;
    const centerY = (canvasHeight - inputHeight) / 2;

    // Create the input field element
    inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.style.position = 'absolute';
    inputField.style.left = `${centerX}px`; // Center horizontally
    inputField.style.top = `${centerY}px`;  // Center vertically
    inputField.style.width = `${inputWidth}px`;  // Set the input field width
    inputField.style.height = `${inputHeight}px`;  // Set the input field height
    inputField.style.fontSize = '50px';  // Adjust the font size as needed
    inputField.style.zIndex = 1000; // Ensure it's above the canvas

    // Add the input field to the canvas container
    document.querySelector('.canvas-container').appendChild(inputField);

    // Focus on the input field
    inputField.focus();

    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const text = inputField.value;
            const textX = centerX;
            const textY = centerY + 30; // Adjust for the text baseline
            addTextElement(text, textX, textY);
            document.querySelector('.canvas-container').removeChild(inputField);
            inputField = null;
            isTyping = false;
            canvas.removeEventListener('click', createInputField);
            canvas.removeEventListener('touchend', createInputField);
        }
    });
}


function addTextElement(text, x, y, fontSize = 100, color = 'rgb(0, 0, 0)') {
    const maxTextWidth = canvas.width - 20; // Leave a 20px margin on both sides
    let measuredTextWidth = ctx.measureText(text).width;

    // Reduce font size if the text exceeds the canvas width
    while (measuredTextWidth > maxTextWidth && fontSize > 10) {
        fontSize -= 2; // Reduce font size
        ctx.font = `${fontSize}px Arial`;
        measuredTextWidth = ctx.measureText(text).width;
    }

    // If text is still too wide, truncate it
    while (measuredTextWidth > maxTextWidth) {
        text = text.slice(0, -1); // Remove the last character
        measuredTextWidth = ctx.measureText(text).width;
    }

    // Adjust the text position if it overflows the canvas
    if (x + measuredTextWidth > canvas.width - 20) {
        x = canvas.width - measuredTextWidth - 20; // Move left to fit
    }
    if (y > canvas.height - 20) {
        y = canvas.height - 20; // Move up to fit vertically
    }

    // Add text to elements with adjusted font size, color, and position
    textElements.push({ text, x, y, fontSize, color });
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
        ctx.font = `${textElement.fontSize}px Arial`; // Use the adjusted font size
        ctx.strokeStyle = 'rgb(0, 0, 0)';
        ctx.fillText(textElement.text, textElement.x, textElement.y);
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
    if (!draggingText) return;

    // Calculate the new position
    let newX = x - draggedText.offsetX;
    let newY = y - draggedText.offsetY;

    // Prevent dragging outside the canvas boundaries
    const textWidth = ctx.measureText(draggedText.text).width;
    const textHeight = draggedText.fontSize;

    if (newX < 0) newX = 0;
    if (newX + textWidth > canvas.width) newX = canvas.width - textWidth;
    if (newY < textHeight) newY = textHeight; // Prevent dragging above the top
    if (newY > canvas.height) newY = canvas.height; // Prevent dragging below the bottom

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
    return x >= textElement.x && x <= textElement.x + ctx.measureText(textElement.text).width && y >= textElement.y - 20 && y <= textElement.y;
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