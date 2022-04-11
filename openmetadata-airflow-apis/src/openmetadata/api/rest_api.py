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

import logging
import traceback

from airflow import settings
from airflow.api.common.experimental.trigger_dag import trigger_dag
from airflow.models import DagBag, DagModel
from airflow.utils import timezone
from airflow.www.app import csrf
from flask import request
from flask_admin import expose as admin_expose
from flask_appbuilder import BaseView as AppBuilderBaseView
from flask_appbuilder import expose as app_builder_expose
from openmetadata.airflow.deploy import DagDeployer
from openmetadata.api.apis_metadata import APIS_METADATA, get_metadata_api
from openmetadata.api.config import (
    AIRFLOW_VERSION,
    AIRFLOW_WEBSERVER_BASE_URL,
    REST_API_ENDPOINT,
    REST_API_PLUGIN_VERSION,
)
from openmetadata.api.response import ApiResponse
from openmetadata.api.utils import jwt_token_secure
from pydantic.error_wrappers import ValidationError

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)


class REST_API(AppBuilderBaseView):
    """API View which extends either flask AppBuilderBaseView or flask AdminBaseView"""

    # Get the DagBag which has a list of all the current Dags
    @staticmethod
    def get_dagbag():
        dagbag = DagBag(dag_folder=settings.DAGS_FOLDER, read_dags_from_db=True)
        dagbag.collect_dags()
        dagbag.collect_dags_from_db()
        return dagbag

    @staticmethod
    def get_request_arg(req, arg):
        return req.args.get(arg) or req.form.get(arg)

    # '/' Endpoint where the Admin page is which allows you to view the APIs available and trigger them
    @app_builder_expose("/")
    def list(self):
        logging.info("RestApi.list() called")

        # get the information that we want to display on the page regarding the dags that are available
        dagbag = self.get_dagbag()
        dags = []
        for dag_id in dagbag.dags:
            orm_dag = DagModel.get_current(dag_id)
            dags.append(
                {
                    "dag_id": dag_id,
                    "is_active": (not orm_dag.is_paused)
                    if orm_dag is not None
                    else False,
                }
            )

        return self.render_template(
            "/rest_api_plugin/index.html",
            dags=dags,
            airflow_webserver_base_url=AIRFLOW_WEBSERVER_BASE_URL,
            rest_api_endpoint=REST_API_ENDPOINT,
            apis_metadata=APIS_METADATA,
            airflow_version=AIRFLOW_VERSION,
            rest_api_plugin_version=REST_API_PLUGIN_VERSION,
            rbac_authentication_enabled=True,
        )

    # '/api' REST Endpoint where API requests should all come in
    @csrf.exempt  # Exempt the CSRF token
    @admin_expose("/api", methods=["GET", "POST"])  # for Flask Admin
    @app_builder_expose("/api", methods=["GET", "POST"])  # for Flask AppBuilder
    @jwt_token_secure  # On each request
    def api(self):
        # Get the api that you want to execute
        api = self.get_request_arg(request, "api")

        # Validate that the API is provided
        if not api:
            logging.warning("api argument not provided")
            return ApiResponse.bad_request("API should be provided")

        api = api.strip().lower()
        logging.info("REST_API.api() called (api: " + str(api) + ")")

        api_metadata = get_metadata_api(api)
        if api_metadata is None:
            logging.info("api '" + str(api) + "' not supported")
            return ApiResponse.bad_request("API '" + str(api) + "' was not found")

        # Deciding which function to use based off the API object that was requested.
        # Some functions are custom and need to be manually routed to.
        if api == "deploy_dag":
            return self.deploy_dag()
        if api == "trigger_dag":
            return self.trigger_dag()

        # TODO DELETE, STATUS (pick it up from airflow directly), LOG (just link v1), ENABLE DAG, DISABLE DAG (play pause)

        raise ValueError(
            f"Invalid api param {api}. Expected deploy_dag or trigger_dag."
        )

    def deploy_dag(self):
        """Custom Function for the deploy_dag API
        Creates workflow dag based on workflow dag file and refreshes
        the session
        args:
            workflow_config: the workflow config that defines the dag
        """

        json_request = request.get_json()

        try:
            ingestion_pipeline = IngestionPipeline(**json_request)

            deployer = DagDeployer(ingestion_pipeline, self.get_dagbag())
            response = deployer.deploy()

            return response

        except ValidationError as err:
            msg = f"Request Validation Error parsing payload {json_request} - {err}"
            return ApiResponse.error(status=ApiResponse.STATUS_BAD_REQUEST, error=msg)

        except Exception as err:
            msg = f"Internal error deploying {json_request} - {err} - {traceback.format_exc()}"
            return ApiResponse.error(status=ApiResponse.STATUS_SERVER_ERROR, error=msg)

    @staticmethod
    def trigger_dag():
        """
        Trigger a dag run
        """
        logging.info("Running run_dag method")
        try:
            request_json = request.get_json()
            dag_id = request_json["workflow_name"]
            run_id = request_json["run_id"] if "run_id" in request_json.keys() else None
            dag_run = trigger_dag(
                dag_id=dag_id,
                run_id=run_id,
                conf=None,
                execution_date=timezone.utcnow(),
            )
            return ApiResponse.success(
                {
                    "message": "Workflow [{}] has been triggered {}".format(
                        dag_id, dag_run
                    )
                }
            )
        except Exception as e:
            logging.info(f"Failed to trigger dag {dag_id}")
            return ApiResponse.error(
                {
                    "message": "Workflow {} has filed to trigger due to {}".format(
                        dag_id, e
                    )
                }
            )
