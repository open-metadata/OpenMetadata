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
from os.path import dirname
from pathlib import Path

from flask import Blueprint
from openmetadata_managed_apis.api.config import REST_API_ENDPOINT
from openmetadata_managed_apis.api.utils import import_path


def get_blueprint() -> Blueprint:
    """
    Return the blueprint after forcing the import of all routes
    :return: REST API blueprint
    """

    blueprint = Blueprint("airflow_api", __name__, url_prefix=REST_API_ENDPOINT)

    routes = Path(dirname(__file__)) / "routes"
    modules = [
        str(elem.absolute())
        for elem in routes.glob("*.py")
        if elem.is_file() and elem.stem != "__init__"
    ]

    # Force import routes to load endpoints
    for file in modules:
        module = import_path(file)
        module.get_fn(blueprint)

    return blueprint
