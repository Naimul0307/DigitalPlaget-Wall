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
    
        // Get computed width & margin for positioning
        img.style.visibility = 'hidden';
        document.body.appendChild(img);
        const style = getComputedStyle(img);
        const width = parseInt(style.width, 10);
        const margin = parseInt(style.margin, 10);
        const cellSize = width + margin * 2;
        document.body.removeChild(img);
    
        // Refresh available positions
        if (availablePositions.length === 0) {
            availablePositions = shuffle(getAvailablePositions());
    
            // Remove positions that are already used
            Array.from(doodleDisplay.children).forEach(existingImg => {
                const exX = parseInt(existingImg.style.left) - margin;
                const exY = parseInt(existingImg.style.top) - margin;
                availablePositions = availablePositions.filter(pos => !(pos.x === exX && pos.y === exY));
            });
        }
    
        // Get max allowed doodles
        const maxImages = parseInt(document.body.dataset.maxImages, 10) || 10 || 20;
    
        // If max reached, remove the oldest image (firstChild)
        if (doodleDisplay.children.length >= maxImages) {
            doodleDisplay.removeChild(doodleDisplay.firstChild);
        }
    
        // Get next position (or fallback to 0,0)
        let pos = availablePositions.pop() || { x: 0, y: 0 };
    
        img.style.left = `${pos.x + margin}px`;
        img.style.top = `${pos.y + margin}px`;
        img.style.visibility = 'visible';
    
        // Add new image on top
        doodleDisplay.appendChild(img);
        observeSingleImage(img);
    }
    
    
    
    // function addNewDoodle(imageSrc) {
    //     const maxAttempts = 30;
    
    //     const img = new Image();
    //     img.src = imageSrc;
    //     img.alt = 'Doodle';
    //     img.style.animation = `floatOutTop 12s linear infinite`;
    
    //     // Sync animation delay with current time
    //     const now = Date.now();
    //     const loopDuration = 8000;
    //     const offset = (now % loopDuration) / 1000;
    //     img.style.animationDelay = `-${offset}s`;
    //     img.style.position = 'absolute';
    
    //     // Temporarily add to DOM to compute CSS
    //     img.style.visibility = 'hidden';
    //     document.body.appendChild(img);
    //     const style = getComputedStyle(img);
    //     const width = parseInt(style.width, 10);
    //     const margin = parseInt(style.margin, 10);
    //     const cellSize = width + (margin * 2);
    //     document.body.removeChild(img); // clean up
    
    //     let randomX, randomY, attempts = 0;
    //     let placed = false;
    
    //     while (attempts < maxAttempts && !placed) {
    //         randomX = Math.floor(Math.random() * (window.innerWidth - cellSize));
    //         randomY = Math.floor(Math.random() * (window.innerHeight - cellSize));
    //         const overlap = Array.from(doodleDisplay.children).some(existingImg => {
    //             const exX = parseInt(existingImg.style.left || 0);
    //             const exY = parseInt(existingImg.style.top || 0);
    //             return (
    //                 Math.abs(randomX - exX) < cellSize &&
    //                 Math.abs(randomY - exY) < cellSize
    //             );
    //         });
    
    //         if (!overlap) placed = true;
    //         attempts++;
    //     }
    
    //     img.style.left = `${randomX}px`;
    //     img.style.top = `${randomY}px`;
    //     img.style.visibility = 'visible';
    
    //     doodleDisplay.insertBefore(img, doodleDisplay.firstChild);
    //     observeSingleImage(img);
    
    //     const maxImages = parseInt(document.body.dataset.maxImages, 10) || 10;
    //     while (doodleDisplay.children.length > maxImages) {
    //         doodleDisplay.removeChild(doodleDisplay.lastChild);
    //     }
    // }
    
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