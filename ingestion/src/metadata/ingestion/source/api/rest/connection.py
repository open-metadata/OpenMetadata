#  Copyright 2024 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Source connection handler
"""

from typing import Dict, Optional, Union  # noqa: UP035

import requests
from requests.models import Response

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.api.openAPISchemaFilePath import (
    OpenAPISchemaFilePath,
)
from metadata.generated.schema.entity.services.connections.api.openAPISchemaS3 import (
    OpenAPISchemaS3,
)
from metadata.generated.schema.entity.services.connections.api.openAPISchemaURL import (
    OpenAPISchemaURL,
)
from metadata.generated.schema.entity.services.connections.api.restConnection import (
    RestConnection as RestConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.api.rest.parser import (
    OpenAPIParseError,
    parse_openapi_schema,
    parse_openapi_schema_from_file,
    parse_openapi_schema_from_s3,
    validate_openapi_schema,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.ssl_registry import get_verify_ssl_fn


class SchemaURLError(Exception):
    """
    Class to indicate schema url is invalid
    """


class InvalidOpenAPISchemaError(Exception):
    """
    Class to indicate openapi schema is invalid
    """


def get_connection(connection: RestConnectionConfig) -> Union[Response, Dict]:  # noqa: UP006, UP007
    """
    Create connection.
    If openAPISchemaURL is provided, fetches the schema via HTTP.
    Otherwise, reads from the local openAPISchemaFilePath.
    """
    schema_conn = connection.openAPISchemaConnection
    if isinstance(schema_conn, OpenAPISchemaURL):
        verify_ssl_fn = get_verify_ssl_fn(connection.verifySSL)
        verify = verify_ssl_fn(connection.sslConfig)
        if verify is None:
            verify = True
        headers = {}
        if connection.token:
            headers["Authorization"] = f"Bearer {connection.token.get_secret_value()}"
        return requests.get(schema_conn.openAPISchemaURL, headers=headers, verify=verify)

    if isinstance(schema_conn, OpenAPISchemaFilePath):
        return parse_openapi_schema_from_file(schema_conn.openAPISchemaFilePath)

    if isinstance(schema_conn, OpenAPISchemaS3):
        return parse_openapi_schema_from_s3(
            s3_url=str(schema_conn.openAPISchemaS3URL),
            aws_credentials=schema_conn.awsCredentials,
        )

    raise ValueError(f"Unsupported openAPISchemaConnection type: {type(schema_conn)}")


class RestConnection(BaseConnection[RestConnectionConfig, Response | dict]):
    def _get_client(self) -> Response | dict:
        return get_connection(self.service_connection)

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        client = self.client
        service_connection = self.service_connection
        is_local_file = isinstance(client, dict)

        def custom_url_exec():
            if is_local_file:
                return []
            if client.status_code == 200:  # pyright: ignore[reportAttributeAccessIssue]
                return []
            raise SchemaURLError(
                "Failed to connect to the JSON schema url. "
                "Please check the url and credentials. "
                f"Status Code was: {client.status_code}"  # pyright: ignore[reportAttributeAccessIssue]
            )

        def custom_schema_exec():
            try:
                schema = client if is_local_file else parse_openapi_schema(client)  # pyright: ignore[reportArgumentType]
                if validate_openapi_schema(schema):  # pyright: ignore[reportArgumentType]
                    return []

                raise InvalidOpenAPISchemaError("Provided schema is not valid OpenAPI specification")  # noqa: TRY301
            except OpenAPIParseError as e:
                raise InvalidOpenAPISchemaError(f"Failed to parse OpenAPI schema: {e}")  # noqa: B904
            except InvalidOpenAPISchemaError:
                raise
            except Exception as e:
                raise InvalidOpenAPISchemaError(f"Error validating OpenAPI schema: {e}")  # noqa: B904

        test_fn = {"CheckURL": custom_url_exec, "CheckSchema": custom_schema_exec}

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
