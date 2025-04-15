window.onload = function () {
    const doodleDisplay = document.getElementById('doodleDisplay');

    const socket = io();

    socket.on('new_doodle', function (data) {
        if (data.image) {
            queueFullScreenImage(data.image);
        }
    });

    fetchAndDisplayDoodles();

    function fetchAndDisplayDoodles() {
        fetch('/get_latest_doodles')
            .then(response => response.json())
            .then(data => {
                availablePositions = shuffle(getAvailablePositions());
                data.doodles.forEach((doodle, index) => {
                    addNewDoodle(doodle, index * 0.3);
                });
            });
    }

    // === Grid Placement Logic ===
    const cellSize = 320;
    let availablePositions = [];

    function getAvailablePositions() {
        const cols = Math.floor(window.innerWidth / cellSize);
        const rows = Math.floor(window.innerHeight / cellSize);
        const positions = [];
    
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                positions.push({ x: x * cellSize, y: y * cellSize });
            }
        }
        return positions;
    }
    
    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    function addNewDoodle(imageSrc) {
        const img = new Image();
        img.src = imageSrc;
        img.alt = 'Doodle';
        img.style.animation = `floatOutTop 12s linear infinite`;
    
        // Sync animation delay with current time
        const now = Date.now();
        const loopDuration = 8000;
        const offset = (now % loopDuration) / 1000;
        img.style.animationDelay = `-${offset}s`;
        img.style.position = 'absolute';
    
        // Temporarily add to DOM to calculate margin/width
        img.style.visibility = 'hidden';
        document.body.appendChild(img);
        const style = getComputedStyle(img);
        const width = parseInt(style.width, 10);
        const margin = parseInt(style.margin, 10);
        const cellSize = width + margin * 2;
        document.body.removeChild(img);
    
        // === Refresh available positions if empty ===
        if (availablePositions.length === 0) {
            availablePositions = shuffle(getAvailablePositions());
    
            // Remove already used positions
            Array.from(doodleDisplay.children).forEach(existingImg => {
                const exX = parseInt(existingImg.style.left || 0) - margin;
                const exY = parseInt(existingImg.style.top || 0) - margin;
                availablePositions = availablePositions.filter(pos => !(pos.x === exX && pos.y === exY));
            });
        }
    
        // === Remove oldest if at max limit ===
        const maxImages = parseInt(document.body.dataset.maxImages, 10) || 6 || 10 || 10;
        if (doodleDisplay.children.length >= maxImages) {
            doodleDisplay.removeChild(doodleDisplay.firstChild);
        }
    
        // === Get next available position or fallback ===
        const pos = availablePositions.pop() || { x: 0, y: 0 };
        img.style.left = `${pos.x + margin}px`;
        img.style.top = `${pos.y + margin}px`;
        img.style.visibility = 'visible';
    
        // === Add new image ===
        doodleDisplay.appendChild(img);
        observeSingleImage(img);
    }
    
    
    function observeSingleImage(img) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        observer.observe(img);
    }

    // === Fullscreen Preview ===
    let imageQueue = [];
    let isDisplaying = false;

    function queueFullScreenImage(imageSrc) {
        imageQueue.push(imageSrc);
        if (!isDisplaying) {
            displayNextImage();
        }
    }

    function displayNextImage() {
        if (imageQueue.length === 0) {
            isDisplaying = false;
            return;
        }

        isDisplaying = true;
        const imageSrc = imageQueue.shift();
        displayFullScreenImage(imageSrc, () => {
            addNewDoodle(imageSrc);
            displayNextImage();
        });
    }

    function displayFullScreenImage(imageSrc, callback) {
        const fullScreenContainer = document.getElementById('fullScreenContainer');
        const fullScreenImage = document.getElementById('fullScreenImage');

        fullScreenImage.src = imageSrc;
        fullScreenContainer.classList.add('show');

        setTimeout(() => {
            fullScreenContainer.classList.remove('show');
            if (callback) callback();
        }, 2000);
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'F10') {
            doodleDisplay.innerHTML = '';
            availablePositions = shuffle(getAvailablePositions());
        }
    });
};