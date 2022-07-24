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

from airflow.plugins_manager import AirflowPlugin
from flask import Blueprint
from openmetadata.api.rest_api import REST_API

# Creating View to be used by Plugin
rest_api_view = {"category": "Admin", "name": "REST API Plugin", "view": REST_API()}

# Creating Blueprint
template_blueprint = Blueprint(
    "template_blueprint",
    __name__,
    template_folder="templates",
    static_folder="static",
    static_url_path="/static/",
)

# Creating Blueprint
rest_api_blueprint = Blueprint("rest_api_blueprint", __name__, url_prefix="/rest/api")


class RestApiPlugin(AirflowPlugin):
    """Creating the RestApiPlugin which extends the AirflowPlugin to import it into Airflow"""

    name = "rest_api"
    operators = []
    appbuilder_views = [rest_api_view]
    flask_blueprints = [template_blueprint, rest_api_blueprint]
    hooks = []
    executors = []
    admin_views = [rest_api_view]
    menu_links = []
