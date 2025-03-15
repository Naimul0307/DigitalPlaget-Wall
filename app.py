
import os
import re
from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
import json
from datetime import datetime
import base64
import socket
import threading
import webbrowser
from PIL import Image
from io import BytesIO

# Dynamic paths based on current file location
current_dir = os.path.dirname(os.path.abspath(__file__))
static_folder = os.path.join(current_dir, 'static')
template_folder = os.path.join(current_dir, 'templates')
config_file_path = os.path.join(static_folder, 'js', 'config.json')

app = Flask(__name__, static_folder=static_folder, template_folder=template_folder)
socketio = SocketIO(app)

# Lock for thread-safe file operations
lock = threading.Lock()

# Function to load configuration from config.json
def load_config():
    with open(config_file_path, 'r') as f:
        return json.load(f)

# Function to update the config.json file with the current IP and port
def update_config_file(ip_address, port_number):
    config = load_config()
    config['IP'] = ip_address
    config['PORT'] = port_number
    with open(config_file_path, 'w') as f:
        json.dump(config, f, indent=4)

# Function to get the current IP address
def get_current_ip():
    hostname = socket.gethostname()
    return socket.gethostbyname(hostname)

# Function to find a free port
def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

# Function to check if a port is in use
def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

# Update configuration with the current IP and a free port
current_ip = get_current_ip()
default_port = 5003

if is_port_in_use(default_port):
    port_number = find_free_port()
else:
    port_number = default_port

update_config_file(current_ip, port_number)

# Reload config to get the latest changes
config = load_config()

# List to store doodles
doodle_files = []

@app.route('/main')
def index():
    return render_template('main_screen.html')

@app.route('/index')
def main_screen():
    return render_template('index.html')

@socketio.on('submit_doodle')
def handle_doodle_submission(data):
    global doodle_files  # Ensure doodle_files is treated as a global variable

    try:
        image_data = data.get('image', '').split(',')[1]  # Extract base64 image data
        filename = f"doodle_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.png"  # Unique filename

        # Decode the base64 image data
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))

        # Resize the image to 720x720 px
        resized_image = image.resize((1080, 1080))

        # Save the image to the static folder
        doodle_dir = os.path.join(static_folder, 'doodles')
        if not os.path.exists(doodle_dir):
            os.makedirs(doodle_dir)

        with lock:
            with open(os.path.join(doodle_dir, filename), "wb") as f:
                resized_image.save(f, format="PNG")

        # Update doodle_files list with new filename
        with lock:
            doodle_files.insert(0, f'/static/doodles/{filename}')
            # Trim the list to 16 items
            doodle_files = doodle_files[:16]

        # Broadcast the doodle to all connected clients
        emit('new_doodle', {'image': f'/static/doodles/{filename}'}, broadcast=True)

    except Exception as e:
        emit('doodle_error', {'message': str(e)})

@app.route('/get_latest_doodles')
def get_latest_doodles():
    global doodle_files  # Ensure doodle_files is treated as a global variable
    max_images = int(os.getenv('MAX_IMAGES', 18))  # Default to 18 if not set in environment
    return jsonify({'doodles': doodle_files[:max_images]})

@app.route('/')
def settings():
    return render_template('settings.html')

@app.route('/get_current_settings')
def get_current_settings():
    try:
        css_file_path = os.path.join(static_folder, 'css', 'main.css')
        with open(css_file_path, 'r') as f:
            css_content = f.read()

        # Extract the image width and margin from the CSS content
        image_width_match = re.search(r'#doodleDisplay img\s*{[^}]*?width:\s*([^;]+);', css_content)
        image_margin_match = re.search(r'#doodleDisplay img\s*{[^}]*?margin:\s*([^;]+);', css_content)

        image_width = image_width_match.group(1) if image_width_match else ''
        image_margin = image_margin_match.group(1) if image_margin_match else ''
        
        js_file_path = os.path.join(static_folder, 'js', 'screen.js')
        with open(js_file_path, 'r') as f:
            js_content = f.read()

        # Extract the maxImages value from the JS content
        max_images_match = re.search(r'const maxImages\s*=\s*parseInt\(document\.body\.dataset\.maxImages,\s*(\d+)\)\s*\|\|\s*\d+;', js_content)
        max_images = max_images_match.group(1) if max_images_match else '18'


        return jsonify({
            'background_image': '',
            'doodle_image': '',
            'image_width': image_width,
            'image_margin': image_margin,
            'max_images': max_images
        })
    except Exception as e:
        print(f"Error fetching current settings: {e}")
        return jsonify({
            'background_image': '',
            'doodle_image': '',
            'image_width': '',
            'image_margin': '',
            'max_images': '18'
        })

@app.route('/update_settings', methods=['POST'])
def update_settings():
    try:
        # Retrieve form data
        image_width = request.form.get('image_width')
        image_margin = request.form.get('image_margin')
        max_images = request.form.get('max_images')

        # Handle background image upload
        bg_image_file = request.files.get('bg_image_upload')
        if bg_image_file:
            bg_image_filename = 'background_image.' + bg_image_file.filename.split('.')[-1]
            bg_image_path = os.path.join(static_folder, 'background', bg_image_filename)
            bg_image_file.save(bg_image_path)

            # Update CSS with new background image path
            css_file_path = os.path.join(static_folder, 'css', 'main.css')
            with open(css_file_path, 'r') as f:
                css_content = f.read()

            css_content = re.sub(r'url\("/static/background/[^"]*"\)', f'url("/static/background/{bg_image_filename}")', css_content)

            with open(css_file_path, 'w') as f:
                f.write(css_content)

        # Update CSS with new width and margin values
        if image_width or image_margin:
            css_file_path = os.path.join(static_folder, 'css', 'main.css')
            with open(css_file_path, 'r') as f:
                css_content = f.read()

            if image_width:
                # Regex to replace the width property
                css_content = re.sub(
                    r'(#doodleDisplay img\s*{[^}]*?width:\s*)[^;]+(;)',
                    lambda m: m.group(1) + image_width + m.group(2),
                    css_content
                )

            if image_margin:
                # Regex to replace the margin property
                css_content = re.sub(
                    r'(#doodleDisplay img\s*{[^}]*?margin:\s*)[^;]+(;)',
                    lambda m: m.group(1) + image_margin + m.group(2),
                    css_content
                )

            with open(css_file_path, 'w') as f:
                f.write(css_content)

        # Update JS with new maxImages value
        if max_images:
            js_file_path = os.path.join(static_folder, 'js', 'screen.js')
            with open(js_file_path, 'r') as f:
                js_content = f.read()

            # Regex to replace the numeric value in the line
            js_content = re.sub(
                r'const\s+maxImages\s*=\s*parseInt\(document\.body\.dataset\.maxImages,\s*\d+\)\s*\|\|\s*\d+;',
                f'const maxImages = parseInt(document.body.dataset.maxImages, {max_images}) || {max_images};',
                js_content
            )

            with open(js_file_path, 'w') as f:
                f.write(js_content)

        return 'Settings updated successfully!', 200
    except Exception as e:
        print(f"Error updating settings: {e}")
        return 'Error updating settings.', 500

if __name__ == '__main__':
    url = f"http://{current_ip}:{port_number}/"
    webbrowser.open(url)
    socketio.run(app, host=current_ip, port=port_number, debug=True)