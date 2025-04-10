  // Function to request full-screen mode
  function enableFullScreen() {
    const elem = document.documentElement;

    // Request full-screen based on browser support
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { // Firefox
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { // Chrome, Safari and Opera
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { // IE/Edge
        elem.msRequestFullscreen();
    }

    // Lock the screen orientation to portrait
    lockOrientation();
}

// Function to lock the screen orientation
function lockOrientation() {
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').then(() => {
            console.log("Orientation locked to portrait.");
        }).catch((err) => {
            console.error("Failed to lock orientation: ", err);
        });
    } else {
        console.log("Screen Orientation API is not supported.");
    }
}

// Exit full-screen mode when user presses ESC key or navigates away
document.addEventListener("fullscreenchange", function () {
    if (!document.fullscreenElement) {
        console.log("Exited full-screen mode.");
        // Lock orientation back to portrait if possible
        lockOrientation();
    }
});

// Detect mobile device to provide an alert about screen locking and full-screen mode
function isMobile() {
    return /Mobi|Android/i.test(navigator.userAgent);
}

// Run the function on page load or button click
window.onload = function () {
    if (isMobile()) {
        alert("This experience is best viewed in full-screen portrait mode.");
    }
};