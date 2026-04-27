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
Test Redshift connection URL building with basic and IAM auth
"""

from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.common.iamAuthConfig import (
    IamAuthConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.database.redshift.connection import (
    _get_provisioned_cluster_identifier,
    _get_redshift_iam_credentials,
    _get_serverless_workgroup,
    _is_serverless_host,
    get_redshift_connection_url,
)

PROVISIONED_HOST = "my-cluster.abc123.us-east-1.redshift.amazonaws.com"
SERVERLESS_HOST = "my-workgroup.123456789012.us-east-1.redshift-serverless.amazonaws.com"


class TestHostParsing:
    def test_is_serverless_host_true(self):
        assert _is_serverless_host(SERVERLESS_HOST) is True

    def test_is_serverless_host_false(self):
        assert _is_serverless_host(PROVISIONED_HOST) is False

    def test_get_serverless_workgroup(self):
        assert _get_serverless_workgroup(SERVERLESS_HOST) == "my-workgroup"

    def test_get_provisioned_cluster_identifier(self):
        assert _get_provisioned_cluster_identifier(PROVISIONED_HOST) == "my-cluster"


class TestGetRedshiftConnectionUrlBasicAuth:
    def test_basic_auth_url(self):
        connection = RedshiftConnection(
            hostPort=f"{PROVISIONED_HOST}:5439",
            username="admin",
            authType=BasicAuth(password="secret"),
            database="mydb",
        )
        url = get_redshift_connection_url(connection)
        assert url.startswith("redshift+psycopg2://")
        assert "admin" in url
        assert "secret" in url
        assert "mydb" in url

    def test_no_auth_type_uses_common_url(self):
        connection = RedshiftConnection(
            hostPort=f"{PROVISIONED_HOST}:5439",
            username="admin",
            database="mydb",
        )
        url = get_redshift_connection_url(connection)
        assert url.startswith("redshift+psycopg2://")
        assert "admin" in url


class TestGetRedshiftConnectionUrlIAMAuth:
    @patch("metadata.ingestion.source.database.redshift.connection._get_redshift_iam_credentials")
    def test_iam_auth_url_provisioned(self, mock_get_creds):
        mock_get_creds.return_value = ("IAMUser:admin", "temporary-password-123")

        connection = RedshiftConnection(
            hostPort=f"{PROVISIONED_HOST}:5439",
            username="admin",
            authType=IamAuthConfigurationSource(awsConfig=AWSCredentials(awsRegion="us-east-1")),
            database="mydb",
        )
        url = get_redshift_connection_url(connection)

        mock_get_creds.assert_called_once_with(connection)
        assert "redshift+psycopg2://" in url
        assert "IAMUser" in url
        assert "temporary-password-123" in url
        assert f"{PROVISIONED_HOST}:5439" in url
        assert url.endswith("/mydb")

    @patch("metadata.ingestion.source.database.redshift.connection._get_redshift_iam_credentials")
    def test_iam_auth_url_no_database(self, mock_get_creds):
        mock_get_creds.return_value = ("admin", "temp-pass")

        connection = RedshiftConnection(
            hostPort=f"{PROVISIONED_HOST}:5439",
            username="admin",
            authType=IamAuthConfigurationSource(awsConfig=AWSCredentials(awsRegion="us-east-1")),
            database="",
        )
        url = get_redshift_connection_url(connection)

        assert url.endswith(f"{PROVISIONED_HOST}:5439")


class TestGetRedshiftIAMCredentials:
    @patch("metadata.ingestion.source.database.redshift.connection.AWSClient")
    def test_provisioned_calls_get_cluster_credentials(self, mock_aws_client_cls):
        mock_client = MagicMock()
        mock_client.get_cluster_credentials.return_value = {
            "DbUser": "IAM:admin",
            "DbPassword": "temp-password",
        }
        mock_aws_client_cls.return_value.get_redshift_client.return_value = mock_client

        connection = RedshiftConnection(
            hostPort=f"{PROVISIONED_HOST}:5439",
            username="admin",
            authType=IamAuthConfigurationSource(awsConfig=AWSCredentials(awsRegion="us-east-1")),
            database="mydb",
        )

        user, password = _get_redshift_iam_credentials(connection)

        assert user == "IAM:admin"
        assert password == "temp-password"
        mock_client.get_cluster_credentials.assert_called_once_with(
            DbUser="admin",
            ClusterIdentifier="my-cluster",
            AutoCreate=False,
            DbName="mydb",
        )

    @patch("metadata.ingestion.source.database.redshift.connection.AWSClient")
    def test_provisioned_without_database(self, mock_aws_client_cls):
        mock_client = MagicMock()
        mock_client.get_cluster_credentials.return_value = {
            "DbUser": "admin",
            "DbPassword": "temp-password",
        }
        mock_aws_client_cls.return_value.get_redshift_client.return_value = mock_client

        connection = RedshiftConnection(
            hostPort=f"{PROVISIONED_HOST}:5439",
            username="admin",
            authType=IamAuthConfigurationSource(awsConfig=AWSCredentials(awsRegion="us-east-1")),
            database="",
        )

        _get_redshift_iam_credentials(connection)

        call_kwargs = mock_client.get_cluster_credentials.call_args[1]
        assert "DbName" not in call_kwargs

    @patch("metadata.ingestion.source.database.redshift.connection.AWSClient")
    def test_serverless_calls_get_credentials(self, mock_aws_client_cls):
        mock_client = MagicMock()
        mock_client.get_credentials.return_value = {
            "dbUser": "IAMR:admin",
            "dbPassword": "serverless-temp-password",
        }
        mock_aws_client_cls.return_value.get_redshift_serverless_client.return_value = mock_client

        connection = RedshiftConnection(
            hostPort=f"{SERVERLESS_HOST}:5439",
            username="admin",
            authType=IamAuthConfigurationSource(awsConfig=AWSCredentials(awsRegion="us-east-1")),
            database="mydb",
        )

        user, password = _get_redshift_iam_credentials(connection)

        assert user == "IAMR:admin"
        assert password == "serverless-temp-password"
        mock_client.get_credentials.assert_called_once_with(
            workgroupName="my-workgroup",
            dbName="mydb",
        )

    @patch("metadata.ingestion.source.database.redshift.connection.AWSClient")
    def test_serverless_defaults_database_to_dev(self, mock_aws_client_cls):
        mock_client = MagicMock()
        mock_client.get_credentials.return_value = {
            "dbUser": "admin",
            "dbPassword": "pass",
        }
        mock_aws_client_cls.return_value.get_redshift_serverless_client.return_value = mock_client

        connection = RedshiftConnection(
            hostPort=f"{SERVERLESS_HOST}:5439",
            username="admin",
            authType=IamAuthConfigurationSource(awsConfig=AWSCredentials(awsRegion="us-east-1")),
            database="",
        )

        _get_redshift_iam_credentials(connection)

        mock_client.get_credentials.assert_called_once_with(
            workgroupName="my-workgroup",
            dbName="dev",
        )

    @patch("metadata.ingestion.source.database.redshift.connection.AWSClient")
    def test_provisioned_wraps_aws_error(self, mock_aws_client_cls):
        mock_client = MagicMock()
        mock_client.get_cluster_credentials.side_effect = ClientError(
            {"Error": {"Code": "ClusterNotFound", "Message": "Cluster not found"}},
            "GetClusterCredentials",
        )
        mock_aws_client_cls.return_value.get_redshift_client.return_value = mock_client

        connection = RedshiftConnection(
            hostPort=f"{PROVISIONED_HOST}:5439",
            username="admin",
            authType=IamAuthConfigurationSource(awsConfig=AWSCredentials(awsRegion="us-east-1")),
            database="mydb",
        )

        with pytest.raises(SourceConnectionException, match="my-cluster"):
            _get_redshift_iam_credentials(connection)

    @patch("metadata.ingestion.source.database.redshift.connection.AWSClient")
    def test_serverless_wraps_aws_error(self, mock_aws_client_cls):
        mock_client = MagicMock()
        mock_client.get_credentials.side_effect = ClientError(
            {"Error": {"Code": "ResourceNotFoundException", "Message": "not found"}},
            "GetCredentials",
        )
        mock_aws_client_cls.return_value.get_redshift_serverless_client.return_value = mock_client

        connection = RedshiftConnection(
            hostPort=f"{SERVERLESS_HOST}:5439",
            username="admin",
            authType=IamAuthConfigurationSource(awsConfig=AWSCredentials(awsRegion="us-east-1")),
            database="mydb",
        )

        with pytest.raises(SourceConnectionException, match="my-workgroup"):
            _get_redshift_iam_credentials(connection)
