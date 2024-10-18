#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Local webserver for generating hybrid yamls
"""
import io
import os

import yaml
from fastapi.encoders import jsonable_encoder
from flask import jsonify, request, send_file, send_from_directory
from metadata.generated.schema.entity.automations.testServiceConnection import (
    TestServiceConnectionRequest,
)

from webserver import app
from webserver.models import OMetaServerModel
from webserver.repository import LocalIngestionServer


@app.route("/ingestion", methods=["POST"])
def save_source_config():
    """Route to save the service connection configuration"""
    LocalIngestionServer().set_ingestion_pipeline(request.json)

    print(request.json)
    return jsonify(success=True)


@app.route("/connection", methods=["POST"])
def save_service_connection():
    """Prepare the service connection for each different service to test"""
    LocalIngestionServer().set_service(request.json)

    print(request.json)
    return jsonify(success=True)


@app.route("/")
def serve_react_app():
    """Route to serve the React app"""
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def serve_static_files(path):
    """Server other static assets like JS, CSS, etc."""
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, "index.html")


@app.route("/init", methods=["POST"])
def init_local_server():
    """Initialize the local server"""
    ometa_server = OMetaServerModel.model_validate(request.json)
    LocalIngestionServer().init_ometa(ometa_server=ometa_server)

    return jsonify(success=True)


@app.route("/api/test", methods=["POST"])
def _test_connection():
    payload = request.json

    test_conn_req = TestServiceConnectionRequest.model_validate(payload)
    res = LocalIngestionServer().test_connection(test_conn_req)
    json_compatible_data = jsonable_encoder(res)
    # return jsonify(res.model_dump())
    return jsonify(json_compatible_data)


@app.route("/api/yaml/download", methods=["GET"])
def download_yaml():
    try:
        # Send the file as an attachment
        # TODO: FIXME
        return send_file(io.StringIO("..."), as_attachment=True)
    except Exception as e:
        return f"Error loading text file: {e}"


@app.route("/api/yaml", methods=["GET"])
def send_yaml():
    """Return an OpenMetadataWorkflowConfig"""
    try:
        workflow = LocalIngestionServer().build_workflow()
        return yaml.dump(yaml.safe_load(workflow.model_dump_json()))

    except Exception as e:
        return f"Error loading text file: {e}"


@app.route("/api/run", methods=["POST"])
def run_ingestion():
    """Runs the created ingestion"""
    LocalIngestionServer().run_workflow()
    return jsonify(success=True)
