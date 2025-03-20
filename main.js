const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const http = require('http');
const path = require('path');

let mainWindow;
let currentIP = '';
let PORT = 0;

function isServerReady(ip, port, retries = 5) {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const checkServer = () => {
            if (attempts >= retries) {
                reject(new Error('Server failed to start after multiple retries'));
                return;
            }

            attempts++;

            http.get(`http://${ip}:${port}`, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    console.log(`Attempt ${attempts}: Server not ready`);
                    setTimeout(checkServer, 2000);
                }
            }).on('error', (err) => {
                console.log(`Attempt ${attempts}: Error - ${err.message}`);
                setTimeout(checkServer, 2000);
            });
        };

        checkServer();
    });
}

// When Electron is ready, start the server and create the window
function startServer() {
    const serverProcess = exec('node ' + path.join(__dirname, 'app.js'), (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        console.log(`Server output: ${stdout}`);
    });

    serverProcess.stdout.on('data', (data) => {
        console.log(data);

        // Extract IP and PORT dynamically
        const match = data.match(/Server running at http:\/\/([\d\.]+):(\d+)\//);
        if (match) {
            currentIP = match[1];
            PORT = match[2];

            console.log(`IP: ${currentIP}, PORT: ${PORT}`);

            // Create the main window after getting the IP and PORT
            isServerReady(currentIP, PORT)
                .then(() => {
                    createWindow();  // Create window after server is ready
                })
                .catch(() => {
                    console.log('Server not available yet, retrying...');
                    setTimeout(() => isServerReady(currentIP, PORT), 2000);
                });
        }
    });

    serverProcess.on('close', (code) => {
        if (code === 0) {
            console.log('Server started successfully.');
        } else {
            console.log('Failed to start the server');
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            spellcheck: false,
            webSecurity: false,
        },
    });

    mainWindow.loadURL(`http://${currentIP}:${PORT}`);

    // Send server URL once the window is loaded
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('server-url', { ip: currentIP, port: PORT });
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    startServer();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit the app when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
