window.onload = function() {
    fetchAndDisplayDoodles(); // Fetch initial doodles on page load

    const socket = io(); // Initialize Socket.IO connection

    socket.on('connect', function() {
        console.log('Socket connected');
    });

    socket.on('disconnect', function() {
        console.log('Socket disconnected');
    });

    socket.on('connect_error', function(error) {
        console.error('Socket connection error:', error);
    });

    socket.on('new_doodle', function(data) {
        console.log('New doodle received:', data);
        if (!data.image) {
            console.error("Received invalid doodle:", data);
            return;
        }
        queueFullScreenImage(data.image); 
    });
    
    function fetchAndDisplayDoodles() {
        fetch('/get_latest_doodles')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch doodles');
                }
                return response.json();
            })
            .then(data => {
                if (data.doodles.length === 0) {
                    console.warn("No doodles found!");
                } else {
                    console.log("Loaded doodles:", data.doodles);
                }
                displayDoodles(data.doodles);
            })
            .catch(error => {
                console.error('Error fetching doodles:', error);
            });
    }

    function displayDoodles(doodles) {
        // Clear existing doodles
        doodleDisplay.innerHTML = '';
        
        doodles.forEach((doodle, index) => {
            addNewDoodle(doodle, index * 0.5);
        });

        observeVisibleImages(); // Start observing visible images
    }

    function addNewDoodle(imageSrc, delay = 0) {
        const img = new Image();
        img.src = imageSrc;
        img.alt = 'Doodle';
        img.classList.add('animated-image');
        img.style.animationDelay = `${delay}s`; // Apply staggered animation delay

        doodleDisplay.insertBefore(img, doodleDisplay.firstChild);

        // Apply IntersectionObserver to the new image
        observeSingleImage(img);

        // Remove excess images if exceeding maxImages
        const maxImages = parseInt(document.body.dataset.maxImages, 10) || 6;
        while (doodleDisplay.children.length > maxImages) {
            doodleDisplay.removeChild(doodleDisplay.lastChild);
        }
    }

    function observeVisibleImages() {
        // Apply IntersectionObserver to trigger animation when images are in viewport
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('#doodleDisplay img').forEach(img => {
            observer.observe(img);
        });
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
            addNewDoodle(imageSrc); // Add to the grid after full-screen display
            displayNextImage(); // Display the next image
        });
    }

    function displayFullScreenImage(imageSrc, callback) {
        const fullScreenContainer = document.getElementById('fullScreenContainer');
        const fullScreenImage = document.getElementById('fullScreenImage');

        fullScreenImage.src = imageSrc;
        fullScreenContainer.classList.add('show');

        // Adjust duration to match full-screen display duration
        setTimeout(() => {
            fullScreenContainer.classList.remove('show');
            if (callback) {
                callback(); // Execute callback after full-screen display
            }
        }, 2000); // Adjust duration of full-screen display
    }

    // Add event listener for keydown event to clear the main screen on F12 key press
    document.addEventListener('keydown', function(event) {
        if (event.key === 'F10') { // You can change 'F12' to any other key you want to use
            console.log('F10 key pressed. Clearing the main screen.');
            clearDoodleDisplay();
        }
    });

    function clearDoodleDisplay() {
        doodleDisplay.innerHTML = ''; // Clear the main doodle display
    }
};