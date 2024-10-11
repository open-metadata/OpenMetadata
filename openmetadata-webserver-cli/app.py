from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import json
import os

app = Flask(__name__, static_folder=os.path.join('ui', 'build'), static_url_path='')

CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}}, 
     supports_credentials=True, 
     allow_headers="*", 
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

conn = sqlite3.connect(':memory:', check_same_thread=False)
cursor = conn.cursor()

# Initialize the in-memory SQLite database
def init_db():
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ServiceConfig (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_data TEXT NOT NULL
        )
    ''')
    conn.commit()
    return conn

init_db()

# Route to save connection configuration
@app.route('/save-config', methods=['POST'])
def save_config():
    data = request.json  # Expecting a JSON payload
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Convert the data to a JSON string
    config_data_json = json.dumps(data)

    # Insert the JSON data into the SQLite database
    cursor.execute('''
        INSERT INTO ServiceConfig (config_data) VALUES (?)
    ''', (config_data_json,))
    
    conn.commit()

    return jsonify({"message": "Configuration saved successfully!"}), 201

# Route to serve the React app
@app.route('/')
def serve_react_app():
    return send_from_directory(app.static_folder, 'index.html')

# Serve other static assets like JS, CSS, etc.
@app.route('/<path:path>')
def serve_static_files(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')


# Start the Flask server
if __name__ == '__main__':
    app.run(debug=True, port=8001)