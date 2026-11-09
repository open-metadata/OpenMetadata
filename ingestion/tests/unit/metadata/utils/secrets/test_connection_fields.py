#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Connection field resolution with runner-local secrets configuration."""

import json
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import pytest
from botocore.stub import Stubber

from metadata.generated.schema.entity.services.connections.database.teradataConnection import TeradataConnection
from metadata.generated.schema.entity.services.connections.mlmodel.mlflowConnection import MlflowConnection
from metadata.generated.schema.security.secrets.secretsManagerClientLoader import SecretsManagerClientLoader
from metadata.generated.schema.security.secrets.secretsManagerProvider import SecretsManagerProvider
from metadata.ingestion.source.database.teradata.connection import TeradataConnection as TeradataClient
from metadata.ingestion.source.mlmodel.mlflow.connection import MlflowConnection as MlflowClient
from metadata.utils.secrets.secrets_manager_factory import SecretsManagerFactory
from metadata.utils.singleton import Singleton


@pytest.fixture
def runner_environment(monkeypatch):
    monkeypatch.setattr(Singleton, "_instances", {})
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.delenv("AWS_SESSION_TOKEN", raising=False)


def connection_config(connection_type, field, value):
    options = (
        {"trackingUri": "http://localhost:5000"}
        if connection_type is MlflowConnection
        else {"hostPort": "localhost:1025", "username": "user"}
    )
    return connection_type.model_validate({**options, field: value})


@pytest.mark.parametrize(
    "connection_type,field,value",
    [
        (MlflowConnection, "registryUri", "mysql+pymysql://user:password@localhost/demo_db"),
        (TeradataConnection, "logdata", "demo.jwt/token+value="),
    ],
)
def test_runner_resolves_references_at_use_time_and_preserves_them_on_serialization(
    runner_environment, connection_type, field, value
):
    reference = "secret:/demo_connection"
    manager = SecretsManagerFactory(SecretsManagerProvider.aws, SecretsManagerClientLoader.env).get_secrets_manager()
    config = connection_config(connection_type, field, reference)
    with Stubber(manager.client) as aws:
        aws.add_response("get_secret_value", {"SecretString": value}, {"SecretId": "/demo_connection"})
        assert json.loads(config.model_dump_json(mask_secrets=False))[field] == reference
        assert json.loads(config.model_dump_json(context={"mask_secrets": True}))[field] == "**********"
        if connection_type is MlflowConnection:
            with patch("metadata.ingestion.source.mlmodel.mlflow.connection.MlflowClient") as client:
                with MlflowClient(config) as connection:
                    assert connection.client is client.return_value
                assert client.call_args.kwargs["registry_uri"] == value
        else:
            params = parse_qs(urlsplit(TeradataClient.get_connection_url(config)).query)
            assert params["logdata"] == [value]
        assert json.loads(config.model_dump_json(mask_secrets=False))[field] == reference
        aws.assert_no_pending_responses()


@pytest.mark.parametrize("provider", [SecretsManagerProvider.db, SecretsManagerProvider.aws])
@pytest.mark.parametrize(
    "connection_type,field,value",
    [
        (MlflowConnection, "registryUri", "http://localhost:5000"),
        (TeradataConnection, "logdata", "EXAMPLE.REALM"),
    ],
)
def test_literal_values_do_not_require_a_vault_lookup(runner_environment, provider, connection_type, field, value):
    manager = SecretsManagerFactory(provider, SecretsManagerClientLoader.env).get_secrets_manager()
    config = connection_config(connection_type, field, value)
    if provider is SecretsManagerProvider.aws:
        with Stubber(manager.client):
            assert getattr(config, field).get_secret_value() == value
    else:
        assert getattr(config, field).get_secret_value() == value
