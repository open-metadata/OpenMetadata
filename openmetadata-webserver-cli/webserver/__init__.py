from pathlib import Path

from flask import Flask
from flask_cors import CORS

STATIC_DIR = Path(__file__).parent / "ui" / "build"

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")


CORS(
    app,
    resources={r"/*": {"origins": "http://localhost:3000"}},
    supports_credentials=True,
    allow_headers="*",
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)

from webserver import routes  # noqa: E402
