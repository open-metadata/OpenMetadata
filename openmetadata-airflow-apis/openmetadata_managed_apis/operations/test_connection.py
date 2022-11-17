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
Module containing the logic to test a connection
from a WorkflowSource
"""
import traceback

from flask import Response
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.utils.logger import operations_logger
from openmetadata_managed_apis.workflows.ingestion.credentials_builder import (
    build_secrets_manager_credentials,
)

from metadata.generated.schema.api.services.ingestionPipelines.testServiceConnection import (
    TestServiceConnectionRequest,
)
from metadata.utils.connections import (
    SourceConnectionException,
    get_connection,
    test_connection,
)
from metadata.utils.secrets.secrets_manager_factory import SecretsManagerFactory

logger = operations_logger()


def test_source_connection(
    test_service_connection: TestServiceConnectionRequest,
) -> Response:
    """
    Create the engine and test the connection
    :param test_service_connection: Service connection to test
    :return: None or exception
    """
    # we need to instantiate the secret manager in case secrets are passed
    SecretsManagerFactory(
        test_service_connection.secretsManagerProvider,
        build_secrets_manager_credentials(
            test_service_connection.secretsManagerProvider
        ),
    )
    connection = get_connection(test_service_connection.connection.config)

    try:
        test_connection(connection)

    except SourceConnectionException as exc:
        msg = f"Connection error from [{connection}]: {exc}"
        logger.debug(traceback.format_exc())
        logger.error(msg)
        return ApiResponse.error(
            status=ApiResponse.STATUS_SERVER_ERROR,
            error=msg,
        )

    return ApiResponse.success({"message": f"Connection with {connection} successful!"})
