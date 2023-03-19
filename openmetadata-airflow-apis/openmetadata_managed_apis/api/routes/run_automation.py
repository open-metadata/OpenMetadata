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
Test the connection against a source system
"""
import traceback
from typing import Callable

from flask import Blueprint, Response, request
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.utils.logger import routes_logger
from openmetadata_managed_apis.workflows.ingestion.credentials_builder import (
    build_secrets_manager_credentials,
)
from pydantic import ValidationError

from metadata.automations.runner import execute
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.utils.secrets.secrets_manager_factory import SecretsManagerFactory

logger = routes_logger()


def get_fn(blueprint: Blueprint) -> Callable:
    """
    Return the function loaded to a route
    :param blueprint: Flask Blueprint to assign route to
    :return: routed function
    """

    # Lazy import the requirements
    # pylint: disable=import-outside-toplevel
    from airflow.api_connexion import security
    from airflow.security import permissions
    from airflow.www.app import csrf

    @blueprint.route("/run_automation", methods=["POST"])
    @csrf.exempt
    @security.requires_access([(permissions.ACTION_CAN_READ, permissions.RESOURCE_DAG)])
    def run_automation() -> Response:
        """
        Given a WorkflowSource Schema, create the engine
        and test the connection
        """

        json_request = request.get_json(cache=False)

        try:
            # TODO: Prepare `parse_automation_workflow_gracefully`
            automation_workflow: AutomationWorkflow = AutomationWorkflow.parse_obj(
                json_request
            )
            # we need to instantiate the secret manager in case secrets are passed
            SecretsManagerFactory(
                automation_workflow.openMetadataServerConnection.secretsManagerProvider,
                build_secrets_manager_credentials(
                    automation_workflow.openMetadataServerConnection.secretsManagerProvider
                ),
            )
            execute(automation_workflow)

            return ApiResponse.success(
                {
                    "message": f"Workflow [{automation_workflow.name}] has been triggered."
                }
            )

        except ValidationError as err:
            msg = f"Request Validation Error parsing payload: {err}"
            logger.debug(traceback.format_exc())
            logger.error(msg)
            return ApiResponse.error(
                status=ApiResponse.STATUS_BAD_REQUEST,
                error=msg,
            )

        except Exception as exc:
            msg = f"Error running automation workflow due to [{exc}] "
            logger.debug(traceback.format_exc())
            logger.error(msg)
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=msg,
            )

    return run_automation
