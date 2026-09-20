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
"""
OpenLineage connector: consuming events from NATS JetStream.
"""

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from metadata.clients.nats_client import build_connect_options, cleanup_temp_secrets
from metadata.generated.schema.entity.services.connections.messaging.nats.basicAuth import (
    UsernameAndPassword as BasicAuth,
)
from metadata.generated.schema.entity.services.connections.messaging.nats.nkeyAuth import (
    NkeySeed as NkeyAuth,
)
from metadata.generated.schema.entity.services.connections.messaging.nats.tokenAuth import (
    Token as TokenAuth,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.nats.credentialsAuth import (
    CredentialsFile as CredentialsAuth,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.natsBrokerConfig import (
    Nats as NatsBrokerConfig,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    OpenLineageConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.pipeline.openlineage.connection import _get_nats_connection
from metadata.ingestion.source.pipeline.openlineage.metadata import OpenlineageSource

EVENT_FILE = Path(__file__).parents[2] / "resources" / "datasets" / "openlineage_event.json"


def _message(payload: dict) -> MagicMock:
    message = MagicMock()
    message.data = json.dumps(payload).encode()
    return message


@pytest.fixture
def event_payload() -> dict:
    return json.loads(EVENT_FILE.read_text())


@pytest.fixture
def broker() -> NatsBrokerConfig:
    return NatsBrokerConfig(
        natsServers="nats://localhost:4222",
        streamName="OPENLINEAGE",
        poolTimeout=0.01,
        sessionTimeout=0,
    )


@pytest.fixture
def source(broker: NatsBrokerConfig) -> OpenlineageSource:
    source = OpenlineageSource.__new__(OpenlineageSource)
    source.service_connection = OpenLineageConnection(brokerConfig=broker)
    return source


class TestNatsBrokerConfig:
    def test_connection_resolves_the_nats_variant(self, broker):
        connection = OpenLineageConnection.model_validate({"brokerConfig": broker.model_dump()})

        assert isinstance(connection.brokerConfig, NatsBrokerConfig)

    def test_defaults_match_a_durable_pull_consumer(self):
        broker = NatsBrokerConfig(natsServers="nats://localhost:4222", streamName="OPENLINEAGE")

        assert broker.durableConsumerName == "openmetadata"
        assert broker.consumerOffsets.value == "all"
        assert broker.batchSize == 100
        assert broker.ackWait == 60
        assert broker.maxDeliver == 5

    def test_servers_and_stream_are_required(self):
        with pytest.raises(ValueError):
            NatsBrokerConfig(streamName="OPENLINEAGE")


class TestNatsConnectOptions:
    @pytest.mark.parametrize(
        ("auth", "expected"),
        [
            (BasicAuth(username="ol", password="secret"), {"user": "ol", "password": "secret"}),
            (TokenAuth(token="s3cret"), {"token": "s3cret"}),
            (NkeyAuth(nkeySeed="SUACSSL"), {"nkeys_seed_str": "SUACSSL"}),
        ],
    )
    def test_auth_maps_onto_nats_options(self, auth, expected):
        temp_files: list[str] = []

        options = build_connect_options(servers="nats://a:4222, nats://b:4222", auth=auth, temp_files=temp_files)

        assert options["servers"] == ["nats://a:4222", "nats://b:4222"]
        assert {key: options[key] for key in expected} == expected

    def test_credentials_auth_is_written_to_a_temp_file(self):
        temp_files: list[str] = []

        options = build_connect_options(
            servers="nats://a:4222",
            auth=CredentialsAuth(credentials="-----BEGIN NATS USER JWT-----"),
            temp_files=temp_files,
        )

        creds_path = Path(options["user_credentials"])
        assert creds_path.read_text() == "-----BEGIN NATS USER JWT-----"
        assert temp_files == [str(creds_path)]
        cleanup_temp_secrets(temp_files)
        assert not creds_path.exists()

    def test_additional_config_cannot_override_owned_options(self):
        with pytest.raises(ValueError, match="reserved connection options"):
            build_connect_options(
                servers="nats://a:4222",
                additional_config={"servers": ["nats://evil:4222"]},
                temp_files=[],
            )


class TestNatsConnection:
    def test_a_failed_subscription_closes_the_connection(self, broker, monkeypatch):
        """A stream that does not exist must not leave a live connection behind."""
        connection = MagicMock()
        connection.jetstream.side_effect = RuntimeError("stream not found")
        closed: list[bool] = []

        async def fake_close() -> None:
            closed.append(True)

        connection.close = fake_close

        async def fake_connect(**_: object) -> MagicMock:
            return connection

        monkeypatch.setattr("metadata.ingestion.source.pipeline.openlineage.connection.nats.connect", fake_connect)

        with pytest.raises(SourceConnectionException):
            _get_nats_connection(broker)

        assert closed == [True]


class TestPollNats:
    def test_yields_events_and_acknowledges_them(self, source, broker, event_payload):
        messages = [_message(event_payload), _message(event_payload)]
        source.client = MagicMock()
        source.client.fetch.side_effect = [messages, []]

        events = list(source._poll_nats(broker))

        assert len(events) == 2
        assert source.client.ack.call_count == 2

    def test_stops_after_the_session_timeout(self, source, broker):
        source.client = MagicMock()
        source.client.fetch.return_value = []

        assert list(source._poll_nats(broker)) == []
        # poolTimeout 0.01 against sessionTimeout 0: one empty fetch ends the run
        assert source.client.fetch.call_count == 1

    def test_unparseable_message_is_acknowledged_and_skipped(self, source, broker):
        source.client = MagicMock()
        source.client.fetch.side_effect = [[_message({"not": "an event"})], []]

        assert list(source._poll_nats(broker)) == []
        # without the ack the broken event would come back on every run
        assert source.client.ack.call_count == 1

    def test_filters_out_event_types_that_carry_no_lineage(self, source, broker, event_payload):
        aborted = {**event_payload, "eventType": "ABORT"}
        source.client = MagicMock()
        source.client.fetch.side_effect = [[_message(aborted)], []]

        assert list(source._poll_nats(broker)) == []
        assert source.client.ack.call_count == 1
