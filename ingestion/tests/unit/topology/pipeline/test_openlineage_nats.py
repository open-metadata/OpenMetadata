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
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from nats.js.api import ConsumerConfig, DeliverPolicy
from nats.js.errors import APIError, NotFoundError

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
from metadata.ingestion.source.pipeline.openlineage import metadata as openlineage_metadata
from metadata.ingestion.source.pipeline.openlineage.connection import _get_nats_connection
from metadata.ingestion.source.pipeline.openlineage.metadata import OpenlineageSource

EVENT_FILE = Path(__file__).parents[2] / "resources" / "datasets" / "openlineage_event.json"


def _message(payload: dict) -> MagicMock:
    message = MagicMock()
    message.data = json.dumps(payload).encode()
    return message


def _fake_nats(js: MagicMock) -> MagicMock:
    connection = MagicMock()
    connection.jetstream.return_value = js
    connection.flush = AsyncMock()
    connection.close = AsyncMock()
    return connection


def _fake_jetstream(existing: ConsumerConfig | None = None, add_error: Exception | None = None) -> MagicMock:
    """A JetStream stub whose consumer either already exists or does not."""
    js = MagicMock()
    if existing is None:
        js.consumer_info = AsyncMock(side_effect=NotFoundError())
    else:
        js.consumer_info = AsyncMock(return_value=MagicMock(config=existing))
    js.add_consumer = AsyncMock(side_effect=add_error)
    js.pull_subscribe_bind = AsyncMock(return_value=MagicMock())
    return js


def _connect_with(monkeypatch: pytest.MonkeyPatch, js: MagicMock) -> MagicMock:
    connection = _fake_nats(js)

    async def fake_connect(**_: object) -> MagicMock:
        return connection

    monkeypatch.setattr("metadata.ingestion.source.pipeline.openlineage.connection.nats.connect", fake_connect)
    return connection


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

    @pytest.mark.parametrize(
        ("field", "value"),
        [
            # `_poll_nats` ends a run by adding poolTimeout to an idle counter until it passes
            # sessionTimeout, so a zero wait spins forever against a quiet stream
            ("poolTimeout", 0),
            ("poolTimeout", -1),
            ("batchSize", 0),
            ("ackWait", 0),
            ("maxDeliver", 0),
            ("sessionTimeout", -1),
        ],
    )
    def test_non_positive_tuning_values_are_rejected(self, field, value):
        with pytest.raises(ValueError):
            NatsBrokerConfig(natsServers="nats://localhost:4222", streamName="OPENLINEAGE", **{field: value})

    def test_a_zero_session_timeout_is_still_allowed(self):
        """One empty fetch ends the run: it means "do not wait for more", not "never stop"."""
        broker = NatsBrokerConfig(natsServers="nats://localhost:4222", streamName="OPENLINEAGE", sessionTimeout=0)

        assert broker.sessionTimeout == 0


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


class TestDurableConsumerReuse:
    """A durable carries the position in the stream, so the wrong one is not harmless.

    ``durableConsumerName`` defaults to ``openmetadata`` for every OpenLineage service,
    so a second service on the same stream can find a durable belonging to the first.
    """

    def test_a_missing_consumer_is_created(self, broker, monkeypatch):
        js = _fake_jetstream(existing=None)
        _connect_with(monkeypatch, js)

        client = _get_nats_connection(broker)
        try:
            js.add_consumer.assert_awaited_once()
        finally:
            client.close()

    def test_a_consumer_filtering_other_subjects_is_refused(self, broker, monkeypatch):
        """Binding to it would consume and acknowledge events meant for someone else."""
        js = _fake_jetstream(existing=ConsumerConfig(durable_name="openmetadata", filter_subject="other.>"))
        connection = _connect_with(monkeypatch, js)

        with pytest.raises(SourceConnectionException, match="already exists and filters"):
            _get_nats_connection(broker)

        js.pull_subscribe_bind.assert_not_awaited()
        connection.close.assert_awaited_once()

    def test_an_unfiltered_consumer_matches_the_catch_all(self, broker, monkeypatch):
        """No filter and ``>`` both mean every subject, so they must not look different."""
        js = _fake_jetstream(existing=ConsumerConfig(durable_name="openmetadata", filter_subject=None))
        _connect_with(monkeypatch, js)

        client = _get_nats_connection(broker)
        try:
            js.pull_subscribe_bind.assert_awaited_once()
            js.add_consumer.assert_not_awaited()
        finally:
            client.close()

    def test_tuning_differences_are_warned_about_not_refused(self, broker, monkeypatch, caplog):
        """add_consumer cannot reconfigure a durable, so the existing values stand."""
        js = _fake_jetstream(
            existing=ConsumerConfig(
                durable_name="openmetadata",
                filter_subject=">",
                ack_wait=5,
                max_deliver=99,
                deliver_policy=DeliverPolicy.NEW,
            )
        )
        _connect_with(monkeypatch, js)

        client = _get_nats_connection(broker)
        try:
            warnings = caplog.text
            assert "ackWait" in warnings
            assert "maxDeliver" in warnings
            assert "consumerOffsets" in warnings
        finally:
            client.close()

    def test_a_consumer_created_concurrently_is_checked_too(self, broker, monkeypatch):
        """Two runs starting together must not make one of them fail outright."""
        js = _fake_jetstream(existing=None, add_error=APIError(code=400, description="consumer already exists"))
        js.consumer_info = AsyncMock(
            side_effect=[
                NotFoundError(),
                MagicMock(config=ConsumerConfig(durable_name="openmetadata", filter_subject=">")),
            ]
        )
        _connect_with(monkeypatch, js)

        client = _get_nats_connection(broker)
        try:
            js.pull_subscribe_bind.assert_awaited_once()
        finally:
            client.close()


class TestBatchKeepalive:
    """The generator is suspended for the whole time the pipeline works on an event."""

    @pytest.fixture
    def quick_broker(self) -> NatsBrokerConfig:
        return NatsBrokerConfig(
            natsServers="nats://localhost:4222",
            streamName="OPENLINEAGE",
            poolTimeout=0.01,
            sessionTimeout=0,
            ackWait=1,
        )

    def test_the_lease_is_refreshed_repeatedly_while_suspended(self, source, quick_broker, event_payload, monkeypatch):
        """One refresh before the yield only buys a single ackWait."""
        monkeypatch.setattr(openlineage_metadata, "MIN_NATS_KEEPALIVE_INTERVAL", 0.01)
        message = _message(event_payload)
        source.client = MagicMock()
        source.client.fetch.side_effect = [[message], []]

        for _ in source._poll_nats(quick_broker):
            # a downstream slower than one refresh interval
            time.sleep(0.6)

        assert source.client.in_progress.call_count >= 2, "the lease was refreshed only once"
        assert source.client.in_progress.call_args[0][0] is message

    def test_the_refresh_stops_before_the_acknowledgement(self, source, quick_broker, event_payload, monkeypatch):
        """A refresh racing the ack of the same message would fight it."""
        monkeypatch.setattr(openlineage_metadata, "MIN_NATS_KEEPALIVE_INTERVAL", 0.01)
        calls: list[str] = []
        source.client = MagicMock()
        source.client.in_progress.side_effect = lambda _m: calls.append("in_progress")
        source.client.ack.side_effect = lambda _m: calls.append("ack")
        source.client.fetch.side_effect = [[_message(event_payload)], []]

        for _ in source._poll_nats(quick_broker):
            time.sleep(0.05)

        assert calls[-1] == "ack"

    def test_nothing_is_kept_alive_for_an_unparseable_message(self, source, quick_broker):
        """It is acknowledged straight away, so there is no processing window to cover."""
        source.client = MagicMock()
        source.client.fetch.side_effect = [[_message({"not": "an event"})], []]

        assert list(source._poll_nats(quick_broker)) == []
        source.client.in_progress.assert_not_called()
