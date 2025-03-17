const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs");
const path = require("path");
const os = require("os");
const cors = require("cors");
const Jimp = require("jimp").default;  // Use default export
const multer = require("multer");

// Initialize app and server
const app = express();  // Initialize app first
const server = http.createServer(app);
const io = socketIo(server);

// Middleware and other configurations
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define static and template folders
const staticFolder = path.join(__dirname, "static");
const doodleFolder = path.join(staticFolder, "doodles");
const configPath = path.join(staticFolder, "js", "config.json");

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
app.get("/get_current_settings", (req, res) => {
    try {
        const cssFilePath = path.join(staticFolder, "css", "main.css");
        const jsFilePath = path.join(staticFolder, "js", "screen.js");

        let cssContent = fs.readFileSync(cssFilePath, "utf8");
        let jsContent = fs.readFileSync(jsFilePath, "utf8");

        // Extract image width & margin from CSS
        const widthMatch = cssContent.match(/#doodleDisplay img\s*{[^}]*?width:\s*([^;]+);/);
        const marginMatch = cssContent.match(/#doodleDisplay img\s*{[^}]*?margin:\s*([^;]+);/);

        const imageWidth = widthMatch ? widthMatch[1] : "";
        const imageMargin = marginMatch ? marginMatch[1] : "";

        // Extract maxImages from JS
        const maxImagesMatch = jsContent.match(/const maxImages\s*=\s*parseInt\(document\.body\.dataset\.maxImages,\s*(\d+)\)/);
        const maxImages = maxImagesMatch ? maxImagesMatch[1] : "18";

        res.json({
            background_image: "/static/background/background_image.png",
            doodle_image: "/static/doodles/doodle.png",
            image_width: imageWidth,
            image_margin: imageMargin,
            max_images: maxImages
        });
    } catch (err) {
        console.error("Error fetching current settings:", err);
        res.status(500).json({ error: "Failed to load settings." });
    }
});

// 📌 UPDATE Settings
app.post("/update_settings", upload.single("bg_image_upload"), async (req, res) => {
    try {
        const { image_width, image_margin, max_images } = req.body;

        const cssFilePath = path.join(staticFolder, "css", "main.css");
        const jsFilePath = path.join(staticFolder, "js", "screen.js");

        // Handle background image upload
        if (req.file) {
            const bgImagePath = path.join(staticFolder, "background", "background_image.png");
            fs.writeFileSync(bgImagePath, req.file.buffer);

            // Update CSS with new background image path
            let cssContent = fs.readFileSync(cssFilePath, "utf8");
            cssContent = cssContent.replace(/url\("\/static\/background\/[^"]*"\)/, `url("/static/background/background_image.png")`);
            fs.writeFileSync(cssFilePath, cssContent);
        }

        // Update CSS (Image width & margin)
        let cssContent = fs.readFileSync(cssFilePath, "utf8");
        if (image_width) {
            cssContent = cssContent.replace(/(#doodleDisplay img\s*{[^}]*?width:\s*)[^;]+(;)/, `$1${image_width}$2`);
        }
        if (image_margin) {
            cssContent = cssContent.replace(/(#doodleDisplay img\s*{[^}]*?margin:\s*)[^;]+(;)/, `$1${image_margin}$2`);
        }
        fs.writeFileSync(cssFilePath, cssContent);

        // Update JS (maxImages value)
        let jsContent = fs.readFileSync(jsFilePath, "utf8");
        jsContent = jsContent.replace(
            /const maxImages\s*=\s*parseInt\(document\.body\.dataset\.maxImages,\s*\d+\)\s*\|\|\s*\d+;/,
            `const maxImages = parseInt(document.body.dataset.maxImages, ${max_images}) || ${max_images};`
        );
        fs.writeFileSync(jsFilePath, jsContent);

        res.send("Settings updated successfully!");
    } catch (err) {
        console.error("Error updating settings:", err);
        res.status(500).send("Error updating settings.");
    }
});

let resizeWidth = 720;  // Default resize width
let resizeHeight = 720; // Default resize height
let imageQuality = 100; // Default image quality

// Update settings from the frontend
io.on("connection", (socket) => {
    console.log("A user connected");

    // Listen for settings update from the client
    socket.on('update_image_settings', (settings) => {
        resizeWidth = settings.resize_width || resizeWidth;
        resizeHeight = settings.resize_height || resizeHeight;
        imageQuality = settings.image_quality || imageQuality;

        console.log('Updated image settings:', { resizeWidth, resizeHeight, imageQuality });
    });

    socket.on("submit_doodle", async (data) => {
        const base64Data = data.image.replace(/^data:image\/png;base64,/, "");
        const fileName = `doodle_${Date.now()}.png`;
        const filePath = path.join(doodleFolder, fileName);
        const buffer = Buffer.from(base64Data, "base64");

        Jimp.read(buffer)
            .then(image => {
                // Apply dynamic resize and quality settings
                return image.resize(resizeWidth, resizeHeight).quality(imageQuality).writeAsync(filePath);
            })
            .then(() => {
                console.log("Doodle saved:", filePath);
                const publicPath = `/static/doodles/${fileName}`;
                doodleFiles.unshift(publicPath);

                // Notify all clients about the new doodle
                io.emit("new_doodle", { image: publicPath });

                socket.emit("save_success", { filePath: publicPath });
            })
            .catch(err => {
                console.error("Error processing doodle:", err);
                socket.emit("save_error", { message: "Failed to save doodle." });
            });
    });
});

// Handling settings update request from the client (to save to configuration file)
app.post("/update_settings", upload.single("bg_image_upload"), async (req, res) => {
    try {
        const { image_width, image_margin, max_images, resize_width, resize_height, image_quality } = req.body;

        // Update CSS and JS files (existing logic) ...

        // Save new image settings to the config
        resizeWidth = resize_width || resizeWidth;
        resizeHeight = resize_height || resizeHeight;
        imageQuality = image_quality || imageQuality;

        // Optionally, you can save these values to the config file if you want to persist them
        const config = loadConfig();
        config.resizeWidth = resizeWidth;
        config.resizeHeight = resizeHeight;
        config.imageQuality = imageQuality;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));

        res.send("Settings updated successfully!");
    } catch (err) {
        console.error("Error updating settings:", err);
        res.status(500).send("Error updating settings.");
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