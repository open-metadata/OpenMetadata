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
"""NATS checks against a real broker, with the catalog API isolated."""

import json
import socket
from pathlib import Path
from time import perf_counter
from unittest.mock import MagicMock

import pytest
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs

from metadata.generated.schema.entity.services.connections.messaging.natsConnection import NatsConnection as Config
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import TestConnectionDefinition
from metadata.ingestion.source.messaging.nats.connection import NatsConnection
from metadata.ingestion.source.messaging.nats.metadata import NatsSource


@pytest.fixture(scope="module")
def authenticated_nats():
    with (
        DockerContainer("nats:2.10.29-alpine")
        .with_command("-js --user demo_user --pass demo_password")
        .with_exposed_ports(4222) as container
    ):
        wait_for_logs(container, "Server is ready", timeout=30)
        yield f"nats://{container.get_container_host_ip()}:{container.get_exposed_port(4222)}"


@pytest.fixture
def config(authenticated_nats):
    return Config.model_validate(
        {
            "natsServers": authenticated_nats,
            "authType": {"username": "demo_user", "password": "demo_password"},
        }
    )


@pytest.fixture
def catalog():
    path = (
        Path(__file__).parents[4]
        / "openmetadata-service/src/main/resources/json/data/testConnections/messaging/nats.json"
    )
    metadata = MagicMock()
    metadata.get_by_name.return_value = TestConnectionDefinition.model_validate_json(path.read_text())
    return metadata


def test_bad_password_fails_access_without_waiting_for_default_sdk_retries(config, catalog):
    config = Config.model_validate(
        {**config.model_dump(), "authType": {"username": "demo_user", "password": "wrong_demo_password"}}
    )
    started = perf_counter()
    with NatsConnection(config) as connection:
        result = connection.test_connection(catalog, automation_workflow=object())
    assert perf_counter() - started < 20
    assert [step.status.value for step in result.steps] == ["Failed", "Skipped", "Skipped"]
    assert result.steps[0].name == "CheckAccess"
    assert "Authorization Violation" in result.steps[0].errorLog
    assert result.steps[0].diagnosis.title == "NATS authentication failed"
    assert result.status.value == "Failed"
    assert catalog.patch_automation_workflow_response.call_args.args[-1].value == "Failed"


def test_refused_port_fails_access_and_live_second_server_still_connects(config, catalog):
    with socket.socket() as unused_port:
        unused_port.bind(("127.0.0.1", 0))
        bad_server = f"nats://127.0.0.1:{unused_port.getsockname()[1]}"
    valid_server = config.natsServers
    config.natsServers = bad_server
    started = perf_counter()
    with NatsConnection(config) as connection:
        result = connection.test_connection(catalog)
    assert perf_counter() - started < 20
    assert [step.status.value for step in result.steps] == ["Failed", "Skipped", "Skipped"]
    assert result.steps[0].diagnosis.title == "Connection refused"
    assert result.steps[0].errorLog

    config.natsServers = f"{bad_server},{valid_server}"
    config.additionalConfig = {"dont_randomize": True}
    with NatsConnection(config) as connection:
        result = connection.test_connection(catalog)
    assert [step.status.value for step in result.steps] == ["Passed", "Passed", "Passed"]
    assert result.status.value == "Successful"


@pytest.mark.parametrize(
    "bucket, expected_status", [(None, "Passed"), ("my_missing_bucket", "Warning"), ("my_schemas", "Passed")]
)
def test_optional_bucket_is_not_required_when_unconfigured(config, catalog, bucket, expected_status):
    with NatsConnection(config) as connection:
        client = connection.client
        assert client.nc.options["max_reconnect_attempts"] == 5
        response = client.request(
            "$JS.API.STREAM.CREATE.KV_my_schemas",
            json.dumps(
                {
                    "name": "KV_my_schemas",
                    "subjects": ["$KV.my_schemas.>"],
                    "storage": "memory",
                    "max_msgs_per_subject": 1,
                }
            ).encode(),
        )
        assert "error" not in response
        config.schemaKvBucket = bucket
        result = connection.test_connection(catalog, automation_workflow=object())
    assert client.nc.is_closed
    assert client._loop.is_closed()
    assert [step.status.value for step in result.steps] == ["Passed", "Passed", expected_status]
    assert result.status.value == "Successful"
    assert catalog.patch_automation_workflow_response.call_args.args[-1].value == "Successful"
    if bucket is None:
        assert result.steps[-1].skipReason is None
        assert result.steps[-1].resultSummary == "Schema KV bucket not configured; check not required"
        assert result.steps[-1].errorLog is None
    elif bucket == "my_missing_bucket":
        assert "stream not found" in result.steps[-1].errorLog


@pytest.mark.parametrize("name, description", [("my_stream", "Example stream description"), ("my_plain_stream", None)])
def test_real_stream_description_reaches_topic_request(config, catalog, name, description):
    with NatsConnection(config) as connection:
        payload = {"name": name, "subjects": [f"demo.{name}.>"], "storage": "memory"}
        if description is not None:
            payload["description"] = description
        response = connection.client.request(f"$JS.API.STREAM.CREATE.{name}", json.dumps(payload).encode())
        assert "error" not in response
    source = NatsSource.create(
        {
            "type": "nats",
            "serviceName": "my_service",
            "serviceConnection": {"config": config.model_dump(mode="json")},
            "sourceConfig": {"config": {"type": "MessagingMetadata"}},
        },
        catalog,
    )
    try:
        source.context.get().messaging_service = "my_service"
        details = next(topic for topic in source.get_topic_list() if topic.topic_name == name)
        records = list(source.yield_topic(details))
    finally:
        source.close()
    assert len(records) == 1 and records[0].left is None
    value = records[0].right.description
    assert (value.root if value is not None else None) == description
