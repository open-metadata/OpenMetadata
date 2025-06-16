#  Copyright 2025 Collate
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
Source connection handler for OpenSearch
"""
from pathlib import Path
from typing import Optional

from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

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
from metadata.generated.schema.entity.services.connections.search.elasticSearch.basicAuth import (
    BasicAuthentication,
)
from metadata.generated.schema.entity.services.connections.search.openSearchConnection import (
    OpenSearchConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
from metadata.ingestion.connections.builders import init_empty_connection_arguments
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN, UTF_8
from metadata.utils.helpers import clean_uri, init_staging_dir

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


def get_connection(connection: OpenSearchConnection) -> OpenSearch:
    """
    Create OpenSearch connection supporting Basic and AWS IAM authentication.
    """
    basic_auth = None
    aws_auth = None
    verify_ssl = False
    ssl_show_warn = False
    ca_cert = False
    client_cert = None
    private_key = None

    if connection.verifySSL == VerifySSL.validate:
        verify_ssl = True
    elif connection.verifySSL == VerifySSL.ignore:
        ssl_show_warn = True

    if connection.sslConfig and connection.sslConfig.certificates:
        if isinstance(connection.sslConfig.certificates, SslCertificatesByValues):
            ca_cert, client_cert, private_key = _handle_ssl_context_by_value(
                ssl_config=connection.sslConfig
            )
        elif isinstance(connection.sslConfig.certificates, SslCertificatesByPath):
            ca_cert, client_cert, private_key = _handle_ssl_context_by_path(
                ssl_config=connection.sslConfig
            )

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

    # Check for AWS IAM Authentication
    if isinstance(connection.authType, AWSCredentials):
        aws_access_key = connection.authType.awsAccessKeyId
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

    # Determine the http_auth based on the available authentication method.
    # AWS IAM takes precedence, followed by Basic Authentication.
    http_auth = aws_auth if aws_auth else basic_auth

    return OpenSearch(
        clean_uri(str(connection.hostPort)),
        http_auth=http_auth,
        verify_certs=verify_ssl,
        ssl_show_warn=ssl_show_warn,
        ca_certs=ca_cert,
        client_cert=client_cert,
        client_key=private_key,
        connection_class=RequestsHttpConnection,  # Use RequestsHttpConnection for AWS auth support.
        **connection.connectionArguments.root,
    )


def test_connection(
    metadata: OpenMetadata,
    client: OpenSearch,
    service_connection: OpenSearchConnection,
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
