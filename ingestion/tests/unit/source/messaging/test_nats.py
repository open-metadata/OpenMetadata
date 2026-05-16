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
Unit tests for NATS connector
"""

import base64
import ssl
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.topic import CleanupPolicy
from metadata.ingestion.source.messaging.messaging_service import (
    BrokerTopicDetails,
    MessagingServiceSource,
)
from metadata.ingestion.source.messaging.nats.connection import _build_connect_opts
from metadata.ingestion.source.messaging.nats.metadata import (
    _NS_TO_MS,
    NatsSource,
    _detect_schema_type,
)
from metadata.ingestion.source.messaging.nats.models import (
    NatsStreamConfig,
    NatsStreamState,
    NatsTopicMetadata,
)


class TestNatsModels:
    def test_stream_config_all_fields(self):
        config = NatsStreamConfig(
            subjects=["crawler.>", "events.>"],
            retention="limits",
            max_msgs=1000,
            max_bytes=10_000_000,
            max_age=86_400_000_000_000,
            num_replicas=1,
            storage="file",
        )
        assert config.subjects == ["crawler.>", "events.>"]
        assert config.retention == "limits"
        assert config.max_msgs == 1000
        assert config.max_bytes == 10_000_000
        assert config.max_age == 86_400_000_000_000
        assert config.num_replicas == 1
        assert config.storage == "file"

    def test_stream_config_all_optional(self):
        config = NatsStreamConfig()
        assert config.subjects is None
        assert config.retention is None
        assert config.max_age is None
        assert config.num_replicas is None

    def test_stream_config_allows_extra_fields(self):
        config = NatsStreamConfig(name="my-stream", unknown_field="value")
        assert config.name == "my-stream"
        assert config.unknown_field == "value"

    def test_stream_state_all_fields(self):
        state = NatsStreamState(messages=500, bytes=1024, num_consumers=3)
        assert state.messages == 500
        assert state.bytes == 1024
        assert state.num_consumers == 3

    def test_stream_state_all_optional(self):
        state = NatsStreamState()
        assert state.messages is None
        assert state.bytes is None
        assert state.num_consumers is None

    def test_stream_state_allows_extra_fields(self):
        state = NatsStreamState(first_seq=1, last_seq=500)
        assert state.first_seq == 1
        assert state.last_seq == 500

    def test_topic_metadata_full(self):
        config = NatsStreamConfig(subjects=["test.>"], storage="file")
        state = NatsStreamState(messages=10, num_consumers=2)
        meta = NatsTopicMetadata(name="test-stream", config=config, state=state)
        assert meta.name == "test-stream"
        assert meta.config.subjects == ["test.>"]
        assert meta.state.num_consumers == 2

    def test_topic_metadata_minimal(self):
        meta = NatsTopicMetadata(name="minimal-stream")
        assert meta.name == "minimal-stream"
        assert meta.config is None
        assert meta.state is None



class TestDetectSchemaType:
    def test_avro_record(self):
        assert _detect_schema_type('{"type": "record", "name": "X", "fields": []}') == "avro"

    def test_avro_enum(self):
        assert _detect_schema_type('{"type": "enum", "name": "Status", "symbols": []}') == "avro"

    def test_json_schema_with_dollar_schema(self):
        assert _detect_schema_type('{"$schema": "http://json-schema.org/draft-07/schema#", "type": "object"}') == "json"

    def test_json_schema_with_properties(self):
        assert _detect_schema_type('{"properties": {"id": {"type": "string"}}}') == "json"

    def test_protobuf(self):
        assert _detect_schema_type('syntax = "proto3";\nmessage Order {}') == "protobuf"

    def test_unknown_falls_back_to_other(self):
        result = _detect_schema_type("not json at all")
        assert "other" in result.lower()


class TestNatsBuildConnectOpts:
    def _mock_connection(self, servers="nats://localhost:4222", **kwargs):
        conn = MagicMock()
        conn.natsServers = servers
        conn.username = None
        conn.password = None
        conn.token = None
        conn.nkeySeed = None
        conn.additionalConfig = None
        conn.tlsConfig = None
        for key, value in kwargs.items():
            setattr(conn, key, value)
        return conn

    def test_minimal_single_server(self):
        conn = self._mock_connection()
        opts = _build_connect_opts(conn)
        assert opts == {"servers": ["nats://localhost:4222"]}

    def test_multiple_servers_parsed(self):
        conn = self._mock_connection(servers="nats://a:4222, nats://b:4222 , nats://c:4222")
        opts = _build_connect_opts(conn)
        assert opts["servers"] == ["nats://a:4222", "nats://b:4222", "nats://c:4222"]

    def test_basic_auth(self):
        password_mock = MagicMock()
        password_mock.get_secret_value.return_value = "s3cr3t"
        conn = self._mock_connection(username="alice", password=password_mock)
        opts = _build_connect_opts(conn)
        assert opts["user"] == "alice"
        assert opts["password"] == "s3cr3t"
        assert "token" not in opts

    def test_username_without_password_skips_basic_auth(self):
        conn = self._mock_connection(username="alice", password=None)
        opts = _build_connect_opts(conn)
        assert "user" not in opts
        assert "password" not in opts

    def test_token_auth(self):
        token_mock = MagicMock()
        token_mock.get_secret_value.return_value = "my-token"
        conn = self._mock_connection(token=token_mock)
        opts = _build_connect_opts(conn)
        assert opts["token"] == "my-token"
        assert "user" not in opts

    def test_basic_auth_takes_precedence_over_token(self):
        password_mock = MagicMock()
        password_mock.get_secret_value.return_value = "pass"
        token_mock = MagicMock()
        token_mock.get_secret_value.return_value = "tok"
        conn = self._mock_connection(username="alice", password=password_mock, token=token_mock)
        opts = _build_connect_opts(conn)
        assert "user" in opts
        assert "token" not in opts

    def test_nkey_auth(self):
        nkey_mock = MagicMock()
        nkey_mock.get_secret_value.return_value = "SUAM..."
        conn = self._mock_connection(nkeySeed=nkey_mock)
        opts = _build_connect_opts(conn)
        assert opts["nkeys_seed_str"] == "SUAM..."

    def test_additional_config_merged(self):
        conn = self._mock_connection(additionalConfig={"connect_timeout": 10, "max_reconnect_attempts": 5})
        opts = _build_connect_opts(conn)
        assert opts["connect_timeout"] == 10
        assert opts["max_reconnect_attempts"] == 5

    def test_additional_config_can_override_servers(self):
        conn = self._mock_connection(additionalConfig={"pedantic": True})
        opts = _build_connect_opts(conn)
        assert opts["pedantic"] is True
        assert "servers" in opts

    def test_tls_ca_cert_builds_ssl_context(self):
        ca_pem = "-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----"
        ca_mock = MagicMock()
        ca_mock.get_secret_value.return_value = ca_pem
        ssl_cfg = MagicMock()
        ssl_cfg.caCertificate = ca_mock
        ssl_cfg.sslCertificate = None
        ssl_cfg.sslKey = None
        tls_mock = MagicMock()
        tls_mock.root = ssl_cfg
        conn = self._mock_connection(tlsConfig=tls_mock)
        mock_ctx = MagicMock(spec=ssl.SSLContext)
        with patch(
            "metadata.ingestion.source.messaging.nats.connection.ssl.create_default_context",
            return_value=mock_ctx,
        ):
            opts = _build_connect_opts(conn)
        assert "tls" in opts
        assert opts["tls"] is mock_ctx
        mock_ctx.load_verify_locations.assert_called_once_with(cadata=ca_pem)

    def test_tls_skipped_when_none(self):
        conn = self._mock_connection(tlsConfig=None)
        opts = _build_connect_opts(conn)
        assert "tls" not in opts


@pytest.fixture
def nats_source():
    with patch.object(MessagingServiceSource, "__init__", lambda self, *a, **kw: None):
        src = NatsSource.__new__(NatsSource)
        src.nats_client = MagicMock()
        src.service_connection = MagicMock()
        src.service_connection.jetStreamEnabled = True
        src.service_connection.natsServers = "nats://localhost:4222"
        src.generate_sample_data = True
        src.context = MagicMock()
        src.context.get.return_value.messaging_service = "test_service"
        src.source_config = MagicMock()
        src.metadata = MagicMock()
        src.register_record = MagicMock()
        src.service_connection.schemaKvBucket = None
        return src


def _encoded(text: str) -> str:
    return base64.b64encode(text.encode()).decode()


def _make_details(name, config=None, state=None):
    return BrokerTopicDetails(
        topic_name=name,
        topic_metadata=NatsTopicMetadata(
            name=name,
            config=config or NatsStreamConfig(),
            state=state or NatsStreamState(),
        ),
    )


class TestNatsYieldTopic:
    def test_retention_calculated_from_max_age(self, nats_source):
        max_age_ns = 86_400_000_000_000  # 24h in nanoseconds
        details = _make_details("s1", config=NatsStreamConfig(max_age=max_age_ns))
        results = list(nats_source.yield_topic(details))
        assert len(results) == 1
        assert results[0].right.retentionTime == max_age_ns / _NS_TO_MS

    def test_retention_zero_when_no_max_age(self, nats_source):
        details = _make_details("s1", config=NatsStreamConfig(max_age=None))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.retentionTime == 0.0

    def test_partitions_from_num_consumers(self, nats_source):
        details = _make_details("s1", state=NatsStreamState(num_consumers=5))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.partitions == 5

    def test_partitions_default_one_when_no_consumers(self, nats_source):
        details = _make_details("s1", state=NatsStreamState(num_consumers=None))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.partitions == 1

    def test_topic_config_populated(self, nats_source):
        details = _make_details(
            "s1",
            config=NatsStreamConfig(
                subjects=["test.>"],
                storage="file",
                retention="limits",
                num_replicas=2,
            ),
        )
        results = list(nats_source.yield_topic(details))
        cfg = results[0].right.topicConfig
        assert cfg["subjects"] == ["test.>"]
        assert cfg["storage"] == "file"
        assert cfg["retention"] == "limits"
        assert "num_replicas" not in cfg

    def test_replication_factor_set_from_num_replicas(self, nats_source):
        details = _make_details("s1", config=NatsStreamConfig(num_replicas=3))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.replicationFactor == 3

    def test_replication_factor_none_when_not_set(self, nats_source):
        details = _make_details("s1", config=NatsStreamConfig(num_replicas=None))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.replicationFactor is None

    def test_retention_size_set_from_max_bytes(self, nats_source):
        details = _make_details("s1", config=NatsStreamConfig(max_bytes=5_000_000))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.retentionSize == 5_000_000

    def test_retention_size_none_when_not_set(self, nats_source):
        details = _make_details("s1", config=NatsStreamConfig(max_bytes=None))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.retentionSize is None

    def test_maximum_message_size_set_from_max_msg_size(self, nats_source):
        details = _make_details("s1", config=NatsStreamConfig(max_msg_size=65_536))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.maximumMessageSize == 65_536

    def test_maximum_message_size_none_when_not_set(self, nats_source):
        details = _make_details("s1", config=NatsStreamConfig(max_msg_size=None))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.maximumMessageSize is None

    def test_cleanup_policies_limits(self, nats_source):
        details = _make_details("s1", config=NatsStreamConfig(retention="limits"))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.cleanupPolicies == [CleanupPolicy.delete]

    def test_cleanup_policies_workqueue(self, nats_source):
        details = _make_details("s1", config=NatsStreamConfig(retention="workqueue"))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.cleanupPolicies == [CleanupPolicy.delete]

    def test_cleanup_policies_interest(self, nats_source):
        details = _make_details("s1", config=NatsStreamConfig(retention="interest"))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.cleanupPolicies == [CleanupPolicy.delete]

    def test_cleanup_policies_none_when_no_retention(self, nats_source):
        details = _make_details("s1", config=NatsStreamConfig(retention=None))
        results = list(nats_source.yield_topic(details))
        assert results[0].right.cleanupPolicies is None

    def test_message_schema_populated_from_kv(self, nats_source):
        avro_schema = '{"type": "record", "name": "Test", "fields": []}'
        nats_source.service_connection.schemaKvBucket = "SCHEMAS"
        nats_source.nats_client.request.return_value = {"message": {"data": _encoded(avro_schema)}}
        details = _make_details("s1")
        results = list(nats_source.yield_topic(details))
        assert results[0].right.messageSchema is not None
        assert results[0].right.messageSchema.schemaText == avro_schema

    def test_message_schema_other_when_no_kv_bucket(self, nats_source):
        nats_source.service_connection.schemaKvBucket = None
        details = _make_details("s1")
        results = list(nats_source.yield_topic(details))
        assert results[0].right.messageSchema is not None
        assert "Other" in str(results[0].right.messageSchema.schemaType)


    def test_topic_config_omits_none_values(self, nats_source):
        details = _make_details("s1", config=NatsStreamConfig())
        results = list(nats_source.yield_topic(details))
        assert results[0].right.topicConfig is None

    def test_register_record_called(self, nats_source):
        details = _make_details("s1")
        list(nats_source.yield_topic(details))
        nats_source.register_record.assert_called_once()

    def test_exception_yields_left(self, nats_source):
        nats_source.context.get.side_effect = Exception("context error")
        details = _make_details("s1")
        results = list(nats_source.yield_topic(details))
        assert len(results) == 1
        assert results[0].left is not None
        assert results[0].right is None
        assert "context error" in results[0].left.error


class TestNatsGetTopicList:
    def test_jetstream_disabled_yields_nothing(self, nats_source):
        nats_source.service_connection.jetStreamEnabled = False
        result = list(nats_source.get_topic_list())
        assert result == []
        nats_source.nats_client.request.assert_not_called()

    def test_single_page_of_streams(self, nats_source):
        nats_source.nats_client.request.side_effect = [
            {"streams": ["stream-a", "stream-b"], "total": 2},
            {"config": {"subjects": ["a.>"]}, "state": {"messages": 10}},
            {"config": {"subjects": ["b.>"]}, "state": {"messages": 5}},
        ]
        result = list(nats_source.get_topic_list())
        assert len(result) == 2
        assert result[0].topic_name == "stream-a"
        assert result[1].topic_name == "stream-b"

    def test_pagination_fetches_all_streams(self, nats_source):
        nats_source.nats_client.request.side_effect = [
            {"streams": ["s1", "s2"], "total": 4},
            {"config": {}, "state": {}},
            {"config": {}, "state": {}},
            {"streams": ["s3", "s4"], "total": 4},
            {"config": {}, "state": {}},
            {"config": {}, "state": {}},
        ]
        result = list(nats_source.get_topic_list())
        assert len(result) == 4
        assert [r.topic_name for r in result] == ["s1", "s2", "s3", "s4"]

    def test_error_response_stops_iteration(self, nats_source):
        nats_source.nats_client.request.return_value = {"error": {"description": "no streams found"}}
        result = list(nats_source.get_topic_list())
        assert result == []

    def test_individual_stream_error_is_skipped(self, nats_source):
        nats_source.nats_client.request.side_effect = [
            {"streams": ["ok-stream", "bad-stream"], "total": 2},
            {"config": {"subjects": ["ok.>"]}, "state": {}},
            {"error": {"description": "stream not found"}},
        ]
        result = list(nats_source.get_topic_list())
        assert len(result) == 1
        assert result[0].topic_name == "ok-stream"

    def test_empty_streams_list_stops(self, nats_source):
        nats_source.nats_client.request.return_value = {"streams": [], "total": 0}
        result = list(nats_source.get_topic_list())
        assert result == []

    def test_topic_metadata_parsed_correctly(self, nats_source):
        nats_source.nats_client.request.side_effect = [
            {"streams": ["crawler-jobs"], "total": 1},
            {
                "config": {
                    "subjects": ["crawler.>"],
                    "retention": "limits",
                    "max_age": 86_400_000_000_000,
                    "num_replicas": 1,
                    "storage": "file",
                },
                "state": {"messages": 42, "bytes": 1024, "num_consumers": 3},
            },
        ]
        result = list(nats_source.get_topic_list())
        assert len(result) == 1
        meta: NatsTopicMetadata = result[0].topic_metadata
        assert meta.name == "crawler-jobs"
        assert meta.config.subjects == ["crawler.>"]
        assert meta.config.max_age == 86_400_000_000_000
        assert meta.state.num_consumers == 3


class TestNatsSampleData:
    def _make_msg_resp(self, seq: int, payload: str) -> dict:
        return {"message": {"subject": "test.subj", "seq": seq, "data": _encoded(payload)}}

    def test_fetch_returns_messages_in_reverse_order(self, nats_source):
        details = _make_details("s1", state=NatsStreamState(messages=3, first_seq=1, last_seq=3))
        nats_source.nats_client.request.side_effect = [
            self._make_msg_resp(3, '{"event": "c"}'),
            self._make_msg_resp(2, '{"event": "b"}'),
            self._make_msg_resp(1, '{"event": "a"}'),
        ]
        msgs = nats_source._fetch_sample_messages(details)
        assert msgs == ['{"event": "c"}', '{"event": "b"}', '{"event": "a"}']

    def test_fetch_skips_error_responses(self, nats_source):
        details = _make_details("s1", state=NatsStreamState(messages=2, first_seq=1, last_seq=2))
        nats_source.nats_client.request.side_effect = [
            {"error": {"description": "not found"}},
            self._make_msg_resp(1, "ok"),
        ]
        msgs = nats_source._fetch_sample_messages(details)
        assert msgs == ["ok"]

    def test_fetch_returns_empty_when_no_state(self, nats_source):
        details = _make_details("s1", state=None)
        msgs = nats_source._fetch_sample_messages(details)
        assert msgs == []

    def test_fetch_returns_empty_when_no_last_seq(self, nats_source):
        details = _make_details("s1", state=NatsStreamState(messages=5))
        msgs = nats_source._fetch_sample_messages(details)
        assert msgs == []

    def test_yield_sample_data_skipped_when_disabled(self, nats_source):
        nats_source.generate_sample_data = False
        details = _make_details("s1", state=NatsStreamState(last_seq=1, first_seq=1))
        results = list(nats_source.yield_topic_sample_data(details))
        assert results == []

    def test_yield_sample_data_skipped_when_topic_not_found(self, nats_source):
        nats_source.metadata.get_by_name.return_value = None
        nats_source.context.get.return_value.topic = "s1"
        details = _make_details("s1", state=NatsStreamState(last_seq=1, first_seq=1))
        results = list(nats_source.yield_topic_sample_data(details))
        assert results == []

    def test_yield_sample_data_yields_left_on_exception(self, nats_source):
        nats_source.context.get.side_effect = Exception("ctx error")
        details = _make_details("s1", state=NatsStreamState(last_seq=1, first_seq=1))
        results = list(nats_source.yield_topic_sample_data(details))
        assert len(results) == 1
        assert results[0].left is not None


class TestNatsClose:
    def test_close_calls_client_close(self, nats_source):
        with patch.object(MessagingServiceSource, "close", return_value=None):
            nats_source.close()
        nats_source.nats_client.close.assert_called_once()

    def test_close_with_none_client_is_safe(self, nats_source):
        nats_source.nats_client = None
        with patch.object(MessagingServiceSource, "close", return_value=None):
            nats_source.close()
