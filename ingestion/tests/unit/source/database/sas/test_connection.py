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
"""Unit tests for the SASConnection BaseConnection wiring (non-Engine client)."""
from unittest.mock import patch
import pytest

from metadata.ingestion.connections.connection import BaseConnection
from metadata.generated.schema.entity.services.connections.database.sasConnection import SASConnection
from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL

connection = pytest.importorskip("metadata.ingestion.source.database.sas.connection")
client = pytest.importorskip("metadata.ingestion.source.database.sas.client")


def test_sas_connection_is_base_connection():
    assert issubclass(connection.SASConnection, BaseConnection)


@patch("metadata.ingestion.source.database.sas.client.SASClient.get_token")
def test_sas_client_verify_ssl_cases(mock_get_token):
    mock_get_token.return_value = "mock"
    
    # False for ignore
    conf_ignore = SASConnection(username="a", password="b", serverHost="http://a", verifySSL=VerifySSL.ignore)
    c1 = client.SASClient(conf_ignore)
    assert c1.client.client_config.verify == False

    # CA cert for validate
    from metadata.generated.schema.security.ssl.verifySSLConfig import SslConfig, SslCertificatesByPath
    conf_validate = SASConnection(username="a", password="b", serverHost="http://a", verifySSL=VerifySSL.validate, sslConfig=SslConfig(certificates=SslCertificatesByPath(caCertPath="/ca.pem")))
    c2 = client.SASClient(conf_validate)
    assert c2.client.client_config.verify == "/ca.pem"

    # None for no-ssl
    conf_nossl = SASConnection(username="a", password="b", serverHost="http://a", verifySSL=VerifySSL.no_ssl)
    c3 = client.SASClient(conf_nossl)
    assert c3.client.client_config.verify is None
