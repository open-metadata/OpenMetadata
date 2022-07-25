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
Airflow REST API definition
"""
from flask_appbuilder import BaseView as AppBuilderBaseView
from flask_appbuilder import expose as app_builder_expose
from openmetadata_managed_apis.api.apis_metadata import APIS_METADATA
from openmetadata_managed_apis.api.config import (
    AIRFLOW_VERSION,
    AIRFLOW_WEBSERVER_BASE_URL,
    REST_API_ENDPOINT,
    REST_API_PLUGIN_VERSION,
)


class RestApiView(AppBuilderBaseView):
    """
    API View which extends either flask AppBuilderBaseView or flask AdminBaseView
    """

    # '/' Endpoint where the Admin page is which allows you to view the APIs available and trigger them
    @app_builder_expose("/")
    def list(self):
        return self.render_template(
            "/rest_api/index.html",
            airflow_webserver_base_url=AIRFLOW_WEBSERVER_BASE_URL,
            rest_api_endpoint=REST_API_ENDPOINT,
            apis_metadata=APIS_METADATA,
            airflow_version=AIRFLOW_VERSION,
            rest_api_plugin_version=REST_API_PLUGIN_VERSION,
            rbac_authentication_enabled=True,
        )
