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

import asyncio
import base64
import json
import os
import ssl
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from metadata.generated.schema.entity.data.topic import CleanupPolicy
from metadata.generated.schema.entity.services.connections.messaging.natsConnection import (
    NatsConnection as NatsConnectionConfig,
)
from metadata.ingestion.source.messaging.messaging_service import (
    BrokerTopicDetails,
    MessagingServiceSource,
)
from metadata.ingestion.source.messaging.nats.connection import (
    NatsApiError,
    NatsClient,
    _build_connect_opts,
    _build_tls_context,
    _check_schema_kv_bucket,
    _cleanup_temp_certs,
    _get_streams,
    _write_temp_cert,
    get_connection,
)
from metadata.ingestion.source.messaging.nats.connection import (
    NatsConnection as OwnedNatsConnection,
)
from metadata.ingestion.source.messaging.nats.connection import (
    test_connection as run_nats_connection_test,
)
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
        config = NatsStreamConfig.model_validate({"name": "my-stream", "unknown_field": "value"})
        assert config.model_extra == {
            "name": "my-stream",
            "unknown_field": "value",
        }

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
        assert meta.config is not None
        assert meta.state is not None
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

    def test_text_with_message_word_is_not_protobuf(self):
        result = _detect_schema_type("This is a system message from service X")
        assert result != "protobuf"


class TestNatsClient:
    def test_request_returns_json_object(self):
        loop = asyncio.new_event_loop()
        nc = MagicMock()
        nc.request = AsyncMock(return_value=MagicMock(data=b'{"total": 0}'))
        client = NatsClient(nc=nc, _loop=loop)

        try:
            assert client.request("$JS.API.STREAM.LIST") == {"total": 0}
        finally:
            loop.close()

    def test_request_rejects_invalid_json(self):
        loop = asyncio.new_event_loop()
        nc = MagicMock()
        nc.request = AsyncMock(return_value=MagicMock(data=b"not-json"))
        client = NatsClient(nc=nc, _loop=loop)

        try:
            with pytest.raises(NatsApiError, match="invalid JSON"):
                client.request("$JS.API.STREAM.LIST")
        finally:
            loop.close()

    def test_request_rejects_non_object_json(self):
        loop = asyncio.new_event_loop()
        nc = MagicMock()
        nc.request = AsyncMock(return_value=MagicMock(data=b"[]"))
        client = NatsClient(nc=nc, _loop=loop)

        try:
            with pytest.raises(NatsApiError, match="invalid response"):
                client.request("$JS.API.STREAM.LIST")
        finally:
            loop.close()

    def test_close_drains_connection_and_removes_certificates(self, tmp_path):
        cert_path = tmp_path / "client.pem"
        cert_path.write_text("certificate")
        loop = asyncio.new_event_loop()
        nc = MagicMock()
        nc.drain = AsyncMock()
        client = NatsClient(nc=nc, _loop=loop, _temp_cert_files=[str(cert_path)])

        client.close()

        nc.drain.assert_awaited_once()
        assert loop.is_closed()
        assert not cert_path.exists()
        assert client._temp_cert_files == []

    def test_close_still_cleans_up_when_drain_fails(self, tmp_path):
        cert_path = tmp_path / "client.pem"
        cert_path.write_text("certificate")
        loop = asyncio.new_event_loop()
        nc = MagicMock()
        nc.drain = AsyncMock(side_effect=RuntimeError("drain failed"))
        client = NatsClient(nc=nc, _loop=loop, _temp_cert_files=[str(cert_path)])

        client.close()

        assert loop.is_closed()
        assert not cert_path.exists()


class TestNatsGetConnection:
    def test_get_connection_returns_owned_client(self):
        connection = NatsConnectionConfig(natsServers="nats://localhost:4222")
        nc = MagicMock()
        nc.drain = AsyncMock()

        with patch(
            "metadata.ingestion.source.messaging.nats.connection.nats.connect",
            new=AsyncMock(return_value=nc),
        ):
            client = get_connection(connection)

        assert client.nc is nc
        assert not client._loop.is_closed()
        client.close()

    def test_get_connection_cleans_up_after_connect_failure(self):
        connection = NatsConnectionConfig(natsServers="nats://localhost:4222")

        with (
            patch(
                "metadata.ingestion.source.messaging.nats.connection.nats.connect",
                new=AsyncMock(side_effect=RuntimeError("connect failed")),
            ),
            patch("metadata.ingestion.source.messaging.nats.connection._cleanup_temp_certs") as cleanup,
            pytest.raises(RuntimeError, match="connect failed"),
        ):
            get_connection(connection)

        cleanup.assert_called_once_with([])


class TestNatsConnectionConfig:
    @pytest.mark.parametrize(
        ("auth_type", "expected_key"),
        [
            ({"username": "alice", "password": "secret"}, "user"),
            ({"token": "token-value"}, "token"),
            ({"nkeySeed": "SUAM..."}, "nkeys_seed_str"),
        ],
    )
    def test_authentication_variants_are_explicit(self, auth_type, expected_key):
        connection = NatsConnectionConfig.model_validate(
            {
                "natsServers": "nats://localhost:4222",
                "authType": auth_type,
            }
        )

        assert expected_key in _build_connect_opts(connection, [])

    def test_anonymous_authentication_is_supported(self):
        connection = NatsConnectionConfig(natsServers="nats://localhost:4222")

        assert _build_connect_opts(connection, []) == {"servers": ["nats://localhost:4222"]}

    def test_partial_basic_authentication_is_rejected(self):
        with pytest.raises(ValidationError):
            NatsConnectionConfig.model_validate(
                {
                    "natsServers": "nats://localhost:4222",
                    "authType": {"username": "alice"},
                }
            )

    def test_legacy_flat_authentication_is_rejected(self):
        with pytest.raises(ValidationError):
            NatsConnectionConfig.model_validate(
                {
                    "natsServers": "nats://localhost:4222",
                    "username": "alice",
                    "password": "secret",
                }
            )

    def test_jetstream_cannot_be_disabled(self):
        with pytest.raises(ValidationError):
            NatsConnectionConfig.model_validate(
                {
                    "natsServers": "nats://localhost:4222",
                    "jetStreamEnabled": False,
                }
            )


class TestNatsBuildConnectOpts:
    def _mock_connection(self, servers="nats://localhost:4222", **kwargs):
        conn = MagicMock()
        conn.natsServers = servers
        conn.authType = None
        conn.additionalConfig = None
        conn.tlsConfig = None
        for key, value in kwargs.items():
            setattr(conn, key, value)
        return conn

    def test_minimal_single_server(self):
        conn = self._mock_connection()
        opts = _build_connect_opts(conn, [])
        assert opts == {"servers": ["nats://localhost:4222"]}

    def test_multiple_servers_parsed(self):
        conn = self._mock_connection(servers="nats://a:4222, nats://b:4222 , nats://c:4222")
        opts = _build_connect_opts(conn, [])
        assert opts["servers"] == ["nats://a:4222", "nats://b:4222", "nats://c:4222"]

    def test_empty_server_is_rejected(self):
        conn = self._mock_connection(servers="nats://a:4222,")

        with pytest.raises(ValueError, match="non-empty"):
            _build_connect_opts(conn, [])

    def test_basic_auth(self):
        conn = NatsConnectionConfig.model_validate(
            {
                "natsServers": "nats://localhost:4222",
                "authType": {"username": "alice", "password": "s3cr3t"},
            }
        )
        opts = _build_connect_opts(conn, [])
        assert opts["user"] == "alice"
        assert opts["password"] == "s3cr3t"
        assert "token" not in opts

    def test_token_auth(self):
        conn = NatsConnectionConfig.model_validate(
            {
                "natsServers": "nats://localhost:4222",
                "authType": {"token": "my-token"},
            }
        )
        opts = _build_connect_opts(conn, [])
        assert opts["token"] == "my-token"
        assert "user" not in opts

    def test_nkey_auth(self):
        conn = NatsConnectionConfig.model_validate(
            {
                "natsServers": "nats://localhost:4222",
                "authType": {"nkeySeed": "SUAM..."},
            }
        )
        opts = _build_connect_opts(conn, [])
        assert opts["nkeys_seed_str"] == "SUAM..."

    def test_additional_config_merged(self):
        conn = self._mock_connection(additionalConfig={"connect_timeout": 10, "max_reconnect_attempts": 5})
        opts = _build_connect_opts(conn, [])
        assert opts["connect_timeout"] == 10
        assert opts["max_reconnect_attempts"] == 5

    def test_additional_config_extra_keys_are_merged(self):
        conn = self._mock_connection(additionalConfig={"pedantic": True})
        opts = _build_connect_opts(conn, [])
        assert opts["pedantic"] is True
        assert "servers" in opts

    def test_additional_config_rejects_reserved_security_options(self):
        conn = self._mock_connection(
            additionalConfig={"servers": ["nats://evil:9999"], "token": "secret"},
        )
        with pytest.raises(ValueError, match="reserved"):
            _build_connect_opts(conn, [])

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
        temp_files: list = []
        mock_ctx = MagicMock(spec=ssl.SSLContext)
        with patch(
            "metadata.ingestion.source.messaging.nats.connection.ssl.create_default_context",
            return_value=mock_ctx,
        ):
            opts = _build_connect_opts(conn, temp_files)
        assert "tls" in opts
        assert opts["tls"] is mock_ctx
        mock_ctx.load_verify_locations.assert_called_once_with(cadata=ca_pem)
        assert temp_files == []

    def test_tls_skipped_when_none(self):
        conn = self._mock_connection(tlsConfig=None)
        opts = _build_connect_opts(conn, [])
        assert "tls" not in opts

    def test_tls_client_certificate_requires_private_key(self):
        ssl_cfg = MagicMock()
        ssl_cfg.caCertificate = None
        ssl_cfg.sslCertificate = MagicMock()
        ssl_cfg.sslKey = None

        with pytest.raises(ValueError, match="certificate and key"):
            _build_tls_context(ssl_cfg, [])

    def test_tls_client_certificate_and_key_are_loaded(self):
        certificate = MagicMock()
        certificate.get_secret_value.return_value = "certificate"
        private_key = MagicMock()
        private_key.get_secret_value.return_value = "private-key"
        ssl_cfg = MagicMock(
            caCertificate=None,
            sslCertificate=certificate,
            sslKey=private_key,
        )
        context = MagicMock(spec=ssl.SSLContext)

        with (
            patch(
                "metadata.ingestion.source.messaging.nats.connection.ssl.create_default_context",
                return_value=context,
            ),
            patch(
                "metadata.ingestion.source.messaging.nats.connection._write_temp_cert",
                side_effect=["/tmp/cert.pem", "/tmp/key.pem"],
            ) as write_temp_cert,
        ):
            assert _build_tls_context(ssl_cfg, []) is context

        assert write_temp_cert.call_count == 2
        context.load_cert_chain.assert_called_once_with(
            certfile="/tmp/cert.pem",
            keyfile="/tmp/key.pem",
        )

    def test_failed_temp_certificate_write_removes_file(self, tmp_path):
        cert_path = tmp_path / "partial-cert.pem"
        fd = os.open(cert_path, os.O_CREAT | os.O_WRONLY)

        with (
            patch(
                "metadata.ingestion.source.messaging.nats.connection.tempfile.mkstemp",
                return_value=(fd, str(cert_path)),
            ),
            patch(
                "metadata.ingestion.source.messaging.nats.connection.os.write",
                side_effect=OSError("disk full"),
            ),
            pytest.raises(OSError, match="disk full"),
        ):
            _write_temp_cert("certificate", [])

        assert not Path(cert_path).exists()

    def test_zero_byte_certificate_write_reports_cleanup_failure(self, tmp_path):
        cert_path = tmp_path / "partial-cert.pem"
        fd = os.open(cert_path, os.O_CREAT | os.O_WRONLY)
        temp_files: list[str] = []

        with (
            patch(
                "metadata.ingestion.source.messaging.nats.connection.tempfile.mkstemp",
                return_value=(fd, str(cert_path)),
            ),
            patch(
                "metadata.ingestion.source.messaging.nats.connection.os.write",
                return_value=0,
            ),
            patch.object(Path, "unlink", side_effect=OSError("permission denied")),
            pytest.raises(OSError, match="Could not write"),
        ):
            _write_temp_cert("certificate", temp_files)

        assert temp_files == [str(cert_path)]
        cert_path.unlink()

    def test_cleanup_retains_certificates_that_cannot_be_removed(self):
        temp_files = ["/tmp/client.pem"]

        with patch.object(Path, "unlink", side_effect=OSError("permission denied")):
            _cleanup_temp_certs(temp_files)

        assert temp_files == ["/tmp/client.pem"]


@pytest.fixture
def nats_source():
    with patch.object(MessagingServiceSource, "__init__", lambda self, *a, **kw: None):
        src = NatsSource.__new__(NatsSource)
        src.nats_client = MagicMock()
        src.service_connection = MagicMock()
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


def _stream_info(name: str, config=None, state=None) -> dict:
    return {
        "config": {"name": name, **(config or {})},
        "state": state or {},
    }


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

    def test_partitions_always_one(self, nats_source):
        details = _make_details("s1", state=NatsStreamState(num_consumers=5))
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

    def test_message_schema_is_absent_when_no_kv_bucket(self, nats_source):
        nats_source.service_connection.schemaKvBucket = None
        details = _make_details("s1")
        results = list(nats_source.yield_topic(details))
        assert results[0].right.messageSchema is None

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
    def test_single_page_of_streams(self, nats_source):
        nats_source.nats_client.request.return_value = {
            "offset": 0,
            "total": 2,
            "streams": [
                _stream_info(
                    "stream-a",
                    config={"subjects": ["a.>"]},
                    state={"messages": 10},
                ),
                _stream_info(
                    "stream-b",
                    config={"subjects": ["b.>"]},
                    state={"messages": 5},
                ),
            ],
        }

        result = list(nats_source.get_topic_list())

        assert len(result) == 2
        assert result[0].topic_name == "stream-a"
        assert result[1].topic_name == "stream-b"
        nats_source.nats_client.request.assert_called_once()
        assert nats_source.nats_client.request.call_args.args[0] == "$JS.API.STREAM.LIST"

    def test_pagination_fetches_all_streams(self, nats_source):
        nats_source.nats_client.request.side_effect = [
            {
                "offset": 0,
                "streams": [_stream_info("s1"), _stream_info("s2")],
                "total": 4,
            },
            {
                "offset": 2,
                "streams": [_stream_info("s3"), _stream_info("s4")],
                "total": 4,
            },
        ]

        result = list(nats_source.get_topic_list())

        assert len(result) == 4
        assert [r.topic_name for r in result] == ["s1", "s2", "s3", "s4"]
        offsets = [
            json.loads(call.kwargs["payload"])["offset"] for call in nats_source.nats_client.request.call_args_list
        ]
        assert offsets == [0, 2]

    def test_error_response_is_not_reported_as_empty_catalog(self, nats_source):
        nats_source.nats_client.request.return_value = {
            "error": {"code": 503, "err_code": 10008, "description": "JetStream unavailable"}
        }

        with pytest.raises(ConnectionError, match="JetStream unavailable"):
            list(nats_source.get_topic_list())

    def test_empty_streams_list_stops(self, nats_source):
        nats_source.nats_client.request.return_value = {"offset": 0, "streams": [], "total": 0}
        result = list(nats_source.get_topic_list())
        assert result == []

    def test_truncated_page_is_not_reported_as_complete(self, nats_source):
        nats_source.nats_client.request.return_value = {"offset": 0, "streams": [], "total": 2}

        with pytest.raises(ConnectionError, match="incomplete"):
            list(nats_source.get_topic_list())

    def test_topic_metadata_parsed_correctly(self, nats_source):
        nats_source.nats_client.request.return_value = {
            "offset": 0,
            "total": 1,
            "streams": [
                _stream_info(
                    "crawler-jobs",
                    config={
                        "subjects": ["crawler.>"],
                        "retention": "limits",
                        "max_age": 86_400_000_000_000,
                        "num_replicas": 1,
                        "storage": "file",
                    },
                    state={"messages": 42, "bytes": 1024, "num_consumers": 3},
                )
            ],
        }

        result = list(nats_source.get_topic_list())

        assert len(result) == 1
        meta: NatsTopicMetadata = result[0].topic_metadata
        assert meta.name == "crawler-jobs"
        assert meta.config is not None
        assert meta.state is not None
        assert meta.config.subjects == ["crawler.>"]
        assert meta.config.max_age == 86_400_000_000_000
        assert meta.state.num_consumers == 3


class TestNatsSchemaKv:
    def test_missing_schema_key_is_optional(self, nats_source):
        nats_source.service_connection.schemaKvBucket = "SCHEMAS"
        nats_source.nats_client.request.return_value = {
            "error": {"code": 404, "err_code": 10037, "description": "no message found"}
        }

        assert nats_source._fetch_schema_from_kv("orders") is None

    def test_schema_api_failure_is_not_reported_as_missing_schema(self, nats_source):
        nats_source.service_connection.schemaKvBucket = "SCHEMAS"
        nats_source.nats_client.request.return_value = {
            "error": {"code": 503, "err_code": 10008, "description": "JetStream unavailable"}
        }

        with pytest.raises(ConnectionError, match="JetStream unavailable"):
            nats_source._fetch_schema_from_kv("orders")


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

    def test_fetch_skips_missing_sequences(self, nats_source):
        details = _make_details("s1", state=NatsStreamState(messages=2, first_seq=1, last_seq=2))
        nats_source.nats_client.request.side_effect = [
            {"error": {"code": 404, "err_code": 10037, "description": "no message found"}},
            self._make_msg_resp(1, "ok"),
        ]
        msgs = nats_source._fetch_sample_messages(details)
        assert msgs == ["ok"]

    def test_fetch_scans_past_sequence_gaps_to_collect_sample(self, nats_source):
        details = _make_details("s1", state=NatsStreamState(messages=10, first_seq=1, last_seq=15))
        missing = {"error": {"code": 404, "err_code": 10037, "description": "no message found"}}
        nats_source.nats_client.request.side_effect = [
            missing,
            missing,
            missing,
            missing,
            missing,
            *(self._make_msg_resp(seq, str(seq)) for seq in range(10, 0, -1)),
        ]

        msgs = nats_source._fetch_sample_messages(details)

        assert msgs == [str(seq) for seq in range(10, 0, -1)]
        assert nats_source.nats_client.request.call_count == 15

    def test_fetch_raises_non_missing_api_errors(self, nats_source):
        details = _make_details("s1", state=NatsStreamState(messages=1, first_seq=1, last_seq=1))
        nats_source.nats_client.request.return_value = {
            "error": {"code": 503, "err_code": 10008, "description": "JetStream unavailable"}
        }

        with pytest.raises(ConnectionError, match="JetStream unavailable"):
            nats_source._fetch_sample_messages(details)

    def test_fetch_raises_transport_errors(self, nats_source):
        details = _make_details("s1", state=NatsStreamState(messages=1, first_seq=1, last_seq=1))
        nats_source.nats_client.request.side_effect = RuntimeError("connection lost")

        with pytest.raises(RuntimeError, match="connection lost"):
            nats_source._fetch_sample_messages(details)

    def test_fetch_skips_binary_payloads(self, nats_source):
        details = _make_details("s1", state=NatsStreamState(messages=2, first_seq=1, last_seq=2))
        nats_source.nats_client.request.side_effect = [
            {"message": {"seq": 2, "data": base64.b64encode(b"\xff\xfe").decode()}},
            self._make_msg_resp(1, "text"),
        ]

        assert nats_source._fetch_sample_messages(details) == ["text"]

    def test_fetch_enforces_total_sample_byte_limit(self, nats_source):
        details = _make_details("s1", state=NatsStreamState(messages=2, first_seq=1, last_seq=2))
        nats_source.nats_client.request.side_effect = [
            self._make_msg_resp(2, "1234"),
            self._make_msg_resp(1, "5678"),
        ]

        with patch(
            "metadata.ingestion.source.messaging.nats.metadata._SAMPLE_BYTE_LIMIT",
            5,
            create=True,
        ):
            msgs = nats_source._fetch_sample_messages(details)

        assert msgs == ["1234"]

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


class TestNatsConnectionLifecycle:
    def test_service_spec_owns_and_closes_the_client(self):
        from metadata.ingestion.source.messaging.nats.service_spec import ServiceSpec

        assert ServiceSpec.connection_class is not None
        assert ServiceSpec.connection_class.endswith(".NatsConnection")
        client = MagicMock(spec=NatsClient)
        with patch(
            "metadata.ingestion.source.messaging.nats.connection.get_connection",
            return_value=client,
        ):
            connection = OwnedNatsConnection(MagicMock())
            assert connection.client is client
            metadata = MagicMock()
            expected = MagicMock()
            with patch(
                "metadata.ingestion.source.messaging.nats.connection.test_connection",
                return_value=expected,
            ) as delegated_test:
                assert connection.test_connection(metadata, timeout_seconds=7) is expected
            delegated_test.assert_called_once_with(
                metadata,
                client,
                connection.service_connection,
                None,
                7,
            )
            connection.close()

        client.close.assert_called_once()


class TestNatsTestConnection:
    def _make_client(self) -> MagicMock:
        return MagicMock(spec=NatsClient)

    def test_get_streams_lists_jetstream_metadata(self):
        client = self._make_client()
        client.request.return_value = {"streams": []}
        _get_streams(client)
        client.request.assert_called_once_with("$JS.API.STREAM.LIST")

    def test_get_streams_raises_on_api_error(self):
        client = self._make_client()
        client.request.return_value = {"error": {"description": "no JetStream found"}}
        with pytest.raises(ConnectionError, match="JetStream API error"):
            _get_streams(client)

    def test_check_schema_kv_bucket_reports_not_configured(self):
        client = self._make_client()
        conn = MagicMock()
        conn.schemaKvBucket = None
        with pytest.raises(ConnectionError, match="not configured"):
            _check_schema_kv_bucket(client, conn)
        client.request.assert_not_called()

    def test_check_schema_kv_bucket_succeeds_when_bucket_found(self):
        client = self._make_client()
        client.request.return_value = {"config": {"name": "KV_my-bucket"}}
        conn = MagicMock()
        conn.schemaKvBucket = "my-bucket"
        _check_schema_kv_bucket(client, conn)

    def test_check_schema_kv_bucket_raises_when_bucket_not_found(self):
        client = self._make_client()
        client.request.return_value = {"error": {"description": "stream not found"}}
        conn = MagicMock()
        conn.schemaKvBucket = "missing-bucket"
        with pytest.raises(ConnectionError, match="missing-bucket"):
            _check_schema_kv_bucket(client, conn)

    def test_connection_runs_distinct_topic_and_schema_steps(self):
        client = self._make_client()
        client.request.side_effect = [
            {"streams": []},
            {"config": {"name": "KV_SCHEMAS"}},
        ]
        connection = NatsConnectionConfig(
            natsServers="nats://localhost:4222",
            schemaKvBucket="SCHEMAS",
        )
        expected = MagicMock()

        def execute_steps(**kwargs):
            assert set(kwargs["test_fn"]) == {
                "GetTopics",
                "CheckSchemaKvBucket",
            }
            kwargs["test_fn"]["GetTopics"]()
            kwargs["test_fn"]["CheckSchemaKvBucket"]()
            return expected

        with patch(
            "metadata.ingestion.source.messaging.nats.connection.test_connection_steps",
            side_effect=execute_steps,
        ) as steps:
            result = run_nats_connection_test(
                metadata=MagicMock(),
                client=client,
                service_connection=connection,
                timeout_seconds=9,
            )

        assert result is expected
        assert steps.call_args.kwargs["service_type"] == "Nats"
        assert steps.call_args.kwargs["timeout_seconds"] == 9
        assert [call.args[0] for call in client.request.call_args_list] == [
            "$JS.API.STREAM.LIST",
            "$JS.API.STREAM.INFO.KV_SCHEMAS",
        ]
