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
from typing import Optional

from airflow import settings
from airflow.models import DagBag, DagModel
from airflow.www.app import csrf
from flask import Response, request
from flask_admin import expose as admin_expose
from flask_appbuilder import BaseView as AppBuilderBaseView
from flask_appbuilder import expose as app_builder_expose
from openmetadata.api.apis_metadata import APIS_METADATA, get_metadata_api
from openmetadata.api.config import (
    AIRFLOW_VERSION,
    AIRFLOW_WEBSERVER_BASE_URL,
    REST_API_ENDPOINT,
    REST_API_PLUGIN_VERSION,
)
from openmetadata.api.response import ApiResponse
from openmetadata.api.utils import jwt_token_secure
from openmetadata.operations.delete import delete_dag_id
from openmetadata.operations.deploy import DagDeployer
from openmetadata.operations.status import status
from openmetadata.operations.test_connection import test_source_connection
from openmetadata.operations.trigger import trigger
from pydantic.error_wrappers import ValidationError

from metadata.generated.schema.api.services.ingestionPipelines.testServiceConnection import (
    TestServiceConnectionRequest,
)
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
    def get_request_arg(req, arg) -> Optional[str]:
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
    @admin_expose("/api", methods=["GET", "POST", "DELETE"])  # for Flask Admin
    @app_builder_expose(
        "/api", methods=["GET", "POST", "DELETE"]
    )  # for Flask AppBuilder
    @jwt_token_secure  # On each request
    def api(self):
        # Get the api that you want to execute
        api = self.get_request_arg(request, "api")

        # Validate that the API is provided
        if not api:
            logging.warning("api argument not provided or empty")
            return ApiResponse.bad_request("API should be provided")

        api = api.strip().lower()
        logging.info(f"REST_API.api() called (api: {api})")

        api_metadata = get_metadata_api(api)
        if api_metadata is None:
            logging.info(f"api [{api}] not supported")
            return ApiResponse.bad_request(f"API [{api}] was not found")

        # Deciding which function to use based off the API object that was requested.
        # Some functions are custom and need to be manually routed to.
        if api == "rest_status":
            return self.rest_status()
        if api == "deploy_dag":
            return self.deploy_dag()
        if api == "trigger_dag":
            return self.trigger_dag()
        if api == "test_connection":
            return self.test_connection()
        if api == "dag_status":
            return self.dag_status()
        if api == "delete_dag":
            return self.delete_dag()

        raise ValueError(
            f"Invalid api param {api}. Expected deploy_dag or trigger_dag."
        )

    @staticmethod
    def rest_status() -> Response:
        """
        Check that the Airflow REST is reachable
        and running correctly.
        """
        try:
            url = AIRFLOW_WEBSERVER_BASE_URL + REST_API_ENDPOINT
            return ApiResponse.success(
                {"message": f"Airflow REST {REST_API_PLUGIN_VERSION} running at {url}"}
            )
        except Exception as err:
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=f"Internal error obtaining REST status - {err} - {traceback.format_exc()}",
            )

    def deploy_dag(self) -> Response:
        """
        Custom Function for the deploy_dag API
        Creates workflow dag based on workflow dag file and refreshes
        the session
        """

        json_request = request.get_json()

        try:
            ingestion_pipeline = IngestionPipeline(**json_request)

            deployer = DagDeployer(ingestion_pipeline, self.get_dagbag())
            response = deployer.deploy()

            return response

        except ValidationError as err:
            return ApiResponse.error(
                status=ApiResponse.STATUS_BAD_REQUEST,
                error=f"Request Validation Error parsing payload {json_request}. IngestionPipeline expected - {err}",
            )

        except Exception as err:
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=f"Internal error deploying {json_request} - {err} - {traceback.format_exc()}",
            )

    @staticmethod
    def test_connection() -> Response:
        """
        Given a WorkflowSource Schema, create the engine
        and test the connection
        """
        json_request = request.get_json()

        try:
            test_service_connection = TestServiceConnectionRequest(**json_request)
            response = test_source_connection(test_service_connection)

            return response

        except ValidationError as err:
            return ApiResponse.error(
                status=ApiResponse.STATUS_BAD_REQUEST,
                error=f"Request Validation Error parsing payload {json_request}. (Workflow)Source expected - {err}",
            )

        except Exception as err:
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=f"Internal error testing connection {json_request} - {err} - {traceback.format_exc()}",
            )

    @staticmethod
    def trigger_dag() -> Response:
        """
        Trigger a dag run
        """
        request_json = request.get_json()

        dag_id = request_json.get("workflow_name")
        if not dag_id:
            return ApiResponse.bad_request("workflow_name should be informed")

        try:
            run_id = request_json.get("run_id")
            response = trigger(dag_id, run_id)

            return response

        except Exception as exc:
            logging.info(f"Failed to trigger dag {dag_id}")
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=f"Workflow {dag_id} has filed to trigger due to {exc} - {traceback.format_exc()}",
            )

    def dag_status(self) -> Response:
        """
        Check the status of a DAG runs
        """
        dag_id: str = self.get_request_arg(request, "dag_id")

        if not dag_id:
            return ApiResponse.error(
                status=ApiResponse.STATUS_BAD_REQUEST,
                error=f"Missing dag_id argument in the request",
            )

        try:
            return status(dag_id)

        except Exception as exc:
            logging.info(f"Failed to get dag {dag_id} status")
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=f"Failed to get status for {dag_id} due to {exc} - {traceback.format_exc()}",
            )

    def delete_dag(self) -> Response:
        """
        POST request to DELETE a DAG.

        Expect: POST
        {
            "workflow_name": "my_ingestion_pipeline3"
        }
        """
        dag_id: str = self.get_request_arg(request, "dag_id")

        if not dag_id:
            return ApiResponse.bad_request("workflow_name should be informed")

        try:
            return delete_dag_id(dag_id)

        except Exception as exc:
            logging.info(f"Failed to delete dag {dag_id}")
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=f"Failed to delete {dag_id} due to {exc} - {traceback.format_exc()}",
            )
