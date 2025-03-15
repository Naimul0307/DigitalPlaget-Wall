const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs");
const path = require("path");
const os = require("os");
const cors = require("cors");
const Jimp = require("jimp");
const multer = require("multer");

// Initialize app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Define static and template folders
const staticFolder = path.join(__dirname, "static");
const doodleFolder = path.join(staticFolder, "doodles");
const configPath = path.join(staticFolder, "js", "config.json");

app.use(cors());
app.use(express.json());
app.use("/static", express.static(staticFolder));

// Ensure doodle folder exists
if (!fs.existsSync(doodleFolder)) {
    fs.mkdirSync(doodleFolder, { recursive: true });
}

// Load configuration
const loadConfig = () => JSON.parse(fs.readFileSync(configPath, "utf8"));

// Update configuration with the current IP and port
const getIPAddress = () => {
    const interfaces = os.networkInterfaces();
    for (let iface of Object.values(interfaces)) {
        for (let entry of iface) {
            if (entry.family === "IPv4" && !entry.internal) return entry.address;
        }
    }
    return "127.0.0.1";
};

const currentIP = getIPAddress();
const PORT = process.env.PORT || 5003;
const config = loadConfig();
config.IP = currentIP;
config.PORT = PORT;
fs.writeFileSync(configPath, JSON.stringify(config, null, 4));

// Store doodle file paths
let doodleFiles = [];

// Routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "templates", "settings.html"));
});
app.get("/main", (req, res) => res.sendFile(path.join(__dirname, "templates", "main_screen.html")));
app.get("/index", (req, res) => res.sendFile(path.join(__dirname, "templates", "index.html")));

app.get("/get_latest_doodles", (req, res) => {
    console.log("Doodles being sent:", doodleFiles);
    const maxImages = parseInt(process.env.MAX_IMAGES) || 18;
    res.json({ doodles: doodleFiles.slice(0, maxImages) });
});

// Handle file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/update_settings", upload.single("bg_image_upload"), async (req, res) => {
    try {
        const { image_width, image_margin, max_images } = req.body;
        const cssPath = path.join(staticFolder, "css", "main.css");
        const jsPath = path.join(staticFolder, "js", "screen.js");

        // Update background image
        if (req.file) {
            const bgImagePath = path.join(staticFolder, "background", "background_image.png");
            fs.writeFileSync(bgImagePath, req.file.buffer);
        }

        // Update CSS with image width and margin
        let cssContent = fs.readFileSync(cssPath, "utf8");
        cssContent = cssContent.replace(/(#doodleDisplay img\s*{[^}]*?width:\s*)[^;]+(;)/, `$1${image_width}$2`);
        cssContent = cssContent.replace(/(#doodleDisplay img\s*{[^}]*?margin:\s*)[^;]+(;)/, `$1${image_margin}$2`);
        fs.writeFileSync(cssPath, cssContent);

        // Update JS maxImages value
        let jsContent = fs.readFileSync(jsPath, "utf8");
        jsContent = jsContent.replace(/const maxImages\s*=\s*parseInt\(document\.body\.dataset\.maxImages,\s*\d+\)\s*\|\|\s*\d+;/,
            `const maxImages = parseInt(document.body.dataset.maxImages, ${max_images}) || ${max_images};`);
        fs.writeFileSync(jsPath, jsContent);

        res.send("Settings updated successfully!");
    } catch (err) {
        console.error("Error updating settings:", err);
        res.status(500).send("Error updating settings.");
    }
});

io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("submit_doodle", async(data) => {
        const base64Data = data.image.replace(/^data:image\/png;base64,/, "");
        const fileName = `doodle_${Date.now()}.png`;
        const filePath = path.join(doodleFolder, fileName);

        // fs.writeFile(filePath, base64Data, "base64", (err) => {
        //     if (err) {
        //         console.error("Error saving doodle:", err);
        //         socket.emit("save_error", { message: "Failed to save doodle." });
        //     } else {
        //         console.log("Doodle saved:", filePath);
        //         doodleFiles.unshift(`/static/doodles/${fileName}`);// Store path for retrieval
        //         socket.emit("save_success", { filePath: `/static/doodles/${fileName}` });
        //     }
        // });
        fs.writeFile(filePath, base64Data, "base64", (err) => {
            if (err) {
                console.error("Error saving doodle:", err);
                socket.emit("save_error", { message: "Failed to save doodle." });
            } else {
                console.log("Doodle saved:", filePath);
                const publicPath = `/static/doodles/${fileName}`;
                doodleFiles.unshift(publicPath);
                
                // Notify all clients about the new doodle
                io.emit("new_doodle", { image: publicPath });
        
                socket.emit("save_success", { filePath: publicPath });
            }
        });
        
    });
});


app.get("/get_current_settings", (req, res) => {
    try {
        const config = loadConfig(); // Load the settings from config.json
        res.json({
            background_image: "/static/background/background_image.png", 
            doodle_image: "/static/doodles/doodle.png", 
            image_width: config.image_width || "100px",
            image_margin: config.image_margin || "5px",
            max_images: config.max_images || 16
        });
    } catch (err) {
        console.error("Error loading settings:", err);
        res.status(500).json({ error: "Failed to load settings." });
    }
});

fs.readdir(doodleFolder, (err, files) => {
    if (!err) {
        doodleFiles = files
            .filter(file => file.endsWith(".png"))
            .map(file => `/static/doodles/${file}`)
            .reverse();
        console.log("Loaded existing doodles:", doodleFiles);
    } else {
        console.error("Error reading doodle directory:", err);
    }
});


// Start server
server.listen(PORT, currentIP, () => {
    console.log(`Server running at http://${currentIP}:${PORT}/`);
});
