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
Source connection handler for OpenSearch with AWS IAM support.
"""
import ssl
from pathlib import Path
from typing import Optional

from httpx import create_ssl_context
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth  # New: AWS4Auth for AWS IAM authentication

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.common.sslCertPaths import (
    SslCertificatesByPath,
)
from metadata.generated.schema.entity.services.connections.common.sslCertValues import (
    SslCertificatesByValues,
)
from metadata.generated.schema.entity.services.connections.common.sslConfig import (
    SslConfig,
)
from metadata.generated.schema.entity.services.connections.search.openSearch.apiAuth import (
    ApiKeyAuthentication,
)

# New: Import AWS IAM authentication class.
from metadata.generated.schema.entity.services.connections.search.openSearch.awsIamAuth import (
    AwsIamAuthentication,
)
from metadata.generated.schema.entity.services.connections.search.openSearch.basicAuth import (
    BasicAuthentication,
)
from metadata.generated.schema.entity.services.connections.search.openSearchConnection import (
    OpensearchConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import init_empty_connection_arguments
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN, UTF_8
from metadata.utils.helpers import init_staging_dir

CA_CERT_FILE_NAME = "root.pem"
CLIENT_CERT_FILE_NAME = "client.pem"
KEY_CERT_FILE_NAME = "client_key.pem"


def _clean_cert_value(cert_data: str) -> str:
    return cert_data.replace("\\n", "\n")


def write_data_to_file(file_path: Path, cert_data: str) -> None:
    with open(
        file_path,
        "w+",
        encoding=UTF_8,
    ) as file:
        data = _clean_cert_value(cert_data)
        file.write(data)


def _handle_ssl_context_by_value(ssl_config: SslConfig):
    ca_cert = False
    client_cert = None
    private_key = None
    init_staging_dir(ssl_config.certificates.stagingDir)
    if ssl_config.certificates.caCertValue:
        ca_cert = Path(ssl_config.certificates.stagingDir, CA_CERT_FILE_NAME)
        write_data_to_file(
            ca_cert, ssl_config.certificates.caCertValue.get_secret_value()
        )
    if ssl_config.certificates.clientCertValue:
        client_cert = Path(ssl_config.certificates.stagingDir, CLIENT_CERT_FILE_NAME)
        write_data_to_file(
            client_cert,
            ssl_config.certificates.clientCertValue.get_secret_value(),
        )
    if ssl_config.certificates.privateKeyValue:
        private_key = Path(ssl_config.certificates.stagingDir, KEY_CERT_FILE_NAME)
        write_data_to_file(
            private_key,
            ssl_config.certificates.privateKeyValue.get_secret_value(),
        )
    return ca_cert, client_cert, private_key


def _handle_ssl_context_by_path(ssl_config: SslConfig):
    ca_cert = False
    if ssl_config.certificates.caCertPath:
        ca_cert = ssl_config.certificates.caCertPath
    client_cert = ssl_config.certificates.clientCertPath
    private_key = ssl_config.certificates.privateKeyPath
    return ca_cert, client_cert, private_key


def get_ssl_context(ssl_config: SslConfig) -> Optional[ssl.SSLContext]:
    """
    Method to get SSL Context for OpenSearch connection.
    """
    ca_cert = False
    client_cert = None
    private_key = None
    cert_chain = None

    if not ssl_config.certificates:
        return None

    if isinstance(ssl_config.certificates, SslCertificatesByValues):
        ca_cert, client_cert, private_key = _handle_ssl_context_by_value(
            ssl_config=ssl_config
        )
    elif isinstance(ssl_config.certificates, SslCertificatesByPath):
        ca_cert, client_cert, private_key = _handle_ssl_context_by_path(
            ssl_config=ssl_config
        )

    if client_cert and private_key:
        cert_chain = (client_cert, private_key)
    elif client_cert:
        cert_chain = client_cert
    else:
        cert_chain = None

    if ca_cert or cert_chain:
        ssl_context = create_ssl_context(
            cert=cert_chain,
            verify=ca_cert,
        )
        return ssl_context

    return ssl._create_unverified_context()  # pylint: disable=protected-access


def get_connection(connection: OpensearchConnection) -> OpenSearch:
    """
    Create OpenSearch connection supporting Basic, API Key, and AWS IAM authentication.
    """
    basic_auth = None
    api_key = None
    aws_auth = None  # New: AWS IAM auth placeholder
    ssl_context = None

    # Check for Basic Authentication
    if (
        isinstance(connection.authType, BasicAuthentication)
        and connection.authType.username
    ):
        basic_auth = (
            connection.authType.username,
            connection.authType.password.get_secret_value()
            if connection.authType.password
            else None,
        )

    # Check for API Key Authentication
    if isinstance(connection.authType, ApiKeyAuthentication):
        if connection.authType.apiKeyId and connection.authType.apiKey:
            api_key = (
                connection.authType.apiKeyId,
                connection.authType.apiKey.get_secret_value(),
            )
        elif connection.authType.apiKey:
            api_key = connection.authType.apiKey.get_secret_value()

    # Check for AWS IAM Authentication
    if isinstance(connection.authType, AwsIamAuthentication):
        aws_access_key = (
            connection.authType.awsAccessKeyId.get_secret_value()
            if connection.authType.awsAccessKeyId
            else None
        )
        aws_secret_key = (
            connection.authType.awsSecretAccessKey.get_secret_value()
            if connection.authType.awsSecretAccessKey
            else None
        )
        aws_region = connection.authType.awsRegion  # Region as a plain string
        aws_session_token = (
            connection.authType.awsSessionToken.get_secret_value()
            if hasattr(connection.authType, "awsSessionToken")
            and connection.authType.awsSessionToken
            else None
        )
        aws_auth = AWS4Auth(
            aws_access_key,
            aws_secret_key,
            aws_region,
            "es",
            session_token=aws_session_token,
        )

    if not connection.connectionArguments:
        connection.connectionArguments = init_empty_connection_arguments()

    if connection.sslConfig:
        ssl_context = get_ssl_context(connection.sslConfig)

    # Determine the http_auth based on the available authentication method.
    # AWS IAM takes precedence, followed by Basic Authentication, then API Key.
    http_auth = aws_auth if aws_auth else (basic_auth if basic_auth else api_key)

    return OpenSearch(
        str(connection.hostPort),
        http_auth=http_auth,
        ssl_context=ssl_context,
        connection_class=RequestsHttpConnection,  # Use RequestsHttpConnection for AWS auth support.
        **connection.connectionArguments.root,
    )


def test_connection(
    metadata: OpenMetadata,
    client: OpenSearch,
    service_connection: OpensearchConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection for OpenSearch. This can be executed either as part
    of a metadata workflow or during an Automation Workflow.
    """

    def test_get_search_indexes():
        client.indices.get_alias(expand_wildcards="open")

    test_fn = {
        "CheckAccess": client.info,
        "GetSearchIndexes": test_get_search_indexes,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
