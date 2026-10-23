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
"""Unit tests for common broker message decoding."""

import json
from unittest.mock import MagicMock, patch

import pytest
from cachetools import LRUCache
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.schema_registry_client import Schema, SchemaReference
from google.protobuf.message_factory import GetMessageClass

from metadata.generated.schema.type.schema import SchemaType
from metadata.ingestion.source.messaging.common_broker_source import (
    AVRO_DESERIALIZER_CACHE_SIZE,
    PROTOBUF_DECODER_CACHE_SIZE,
    PROTOBUF_SCHEMA_CACHE_SIZE,
    CommonBrokerSource,
    strip_confluent_framing,
)
from metadata.parsers.protobuf_parser import ProtobufParser, ProtobufParserConfig

CONFLUENT_HEADER = b"\x00\x00\x00\x00\x01"


class _BrokerSource(CommonBrokerSource):
    """CommonBrokerSource without the server and broker connections."""

    def __init__(self, schema_registry_client=None):
        self.schema_registry_client = schema_registry_client
        self._avro_deserializers = LRUCache(maxsize=AVRO_DESERIALIZER_CACHE_SIZE)
        self._protobuf_writer_schemas = LRUCache(maxsize=PROTOBUF_SCHEMA_CACHE_SIZE)
        self._protobuf_decoders = LRUCache(maxsize=PROTOBUF_DECODER_CACHE_SIZE)

    @classmethod
    def create(cls, config_dict, metadata, pipeline_name=None):
        raise NotImplementedError


def _source(schema_registry_client=None):
    return _BrokerSource(schema_registry_client)


def test_decode_message_avro_skips_re_deserialization_for_decoded_values():
    source = _source()
    decoded_payload = {"event_id": "1", "status": "ok"}

    with patch("metadata.ingestion.source.messaging.common_broker_source.AvroDeserializer") as mock_deserializer:
        result = CommonBrokerSource.decode_message(source, decoded_payload, "ignored-schema", SchemaType.Avro)

    mock_deserializer.assert_not_called()
    assert result == str(decoded_payload)


def test_decode_message_avro_deserializes_bytes_payload():
    source = _source()

    with patch("metadata.ingestion.source.messaging.common_broker_source.AvroDeserializer") as mock_deserializer:
        mock_deserializer.return_value.return_value = {"event_id": "2"}
        result = CommonBrokerSource.decode_message(source, b"binary-payload", "avro-schema", SchemaType.Avro)

    mock_deserializer.assert_called_once_with(
        schema_str="avro-schema",
        schema_registry_client=source.schema_registry_client,
    )
    mock_deserializer.return_value.assert_called_once_with(b"binary-payload", None)
    assert result == str({"event_id": "2"})


def test_avro_deserializer_is_built_once_per_schema():
    source = _source()

    with patch("metadata.ingestion.source.messaging.common_broker_source.AvroDeserializer") as mock_deserializer:
        mock_deserializer.return_value.return_value = {"event_id": "3"}
        for _ in range(5):
            CommonBrokerSource.decode_message(source, b"binary-payload", "avro-schema", SchemaType.Avro)
        CommonBrokerSource.decode_message(source, b"binary-payload", "other-avro-schema", SchemaType.Avro)

    assert mock_deserializer.call_count == 2


def test_decode_message_json_payload_is_readable():
    source = _source()
    payload = json.dumps({"email": "user@example.com"}).encode("utf-8")

    assert CommonBrokerSource.decode_message(source, payload, "", SchemaType.JSON) == payload.decode("utf-8")


def test_decode_message_strips_confluent_framing_from_json():
    source = _source()
    body = json.dumps({"email": "user@example.com"}).encode("utf-8")

    result = CommonBrokerSource.decode_message(source, CONFLUENT_HEADER + body, "", SchemaType.JSON)

    assert result == body.decode("utf-8")


def test_decode_message_protobuf_decodes_bytes_payload():
    schema = 'syntax = "proto3";\nmessage Loan { string id = 1; int32 amount = 2; }'
    # Confluent framing: magic byte, schema id 1, message index [0]; then id="L-1", amount=5.
    payload = b"\x00\x00\x00\x00\x01\x00" + b"\x0a\x03L-1\x10\x05"

    result = CommonBrokerSource.decode_message(_source(), payload, schema, SchemaType.Protobuf, topic_name="loan")

    assert json.loads(result) == {"id": "L-1", "amount": 5}


def test_protobuf_decoder_is_built_once_per_schema():
    source = _source()

    with patch("metadata.ingestion.source.messaging.common_broker_source.ProtobufMessageDecoder") as mock_decoder:
        mock_decoder.return_value.return_value = "{}"
        for _ in range(5):
            CommonBrokerSource.decode_message(source, b"payload", "schema", SchemaType.Protobuf, topic_name="t")
        CommonBrokerSource.decode_message(source, b"payload", "other-schema", SchemaType.Protobuf, topic_name="t")

    assert mock_decoder.call_count == 2
    mock_decoder.assert_any_call("t", "schema", {})


def test_protobuf_decoder_compile_failure_is_not_retried():
    source = _source()

    with patch("metadata.ingestion.source.messaging.common_broker_source.ProtobufMessageDecoder") as mock_decoder:
        mock_decoder.side_effect = RuntimeError("protoc exited with code 1")
        for _ in range(3):
            with pytest.raises(RuntimeError, match="protoc"):
                CommonBrokerSource.decode_message(source, b"payload", "bad", SchemaType.Protobuf, topic_name="t")

    assert mock_decoder.call_count == 1


def test_decode_message_non_avro_handles_bytes_and_decoded_values():
    source = _source()
    decoded_payload = {"foo": "bar"}

    bytes_result = CommonBrokerSource.decode_message(source, b"plain-text", "ignored-schema", SchemaType.Other)
    decoded_result = CommonBrokerSource.decode_message(source, decoded_payload, "ignored-schema", SchemaType.Other)

    assert bytes_result == "plain-text"
    assert decoded_result == str(decoded_payload)


def test_strip_confluent_framing_leaves_unframed_payloads_alone():
    assert strip_confluent_framing(b"plain-text") == b"plain-text"
    assert strip_confluent_framing(b"\x00\x00") == b"\x00\x00"


def test_decode_message_rejects_undecodable_binary():
    """A payload that is not valid UTF-8 must raise so the caller skips it."""
    with pytest.raises(UnicodeDecodeError):
        CommonBrokerSource.decode_message(_source(), b"\xff\xfe\x00binary", "", SchemaType.Other)


def test_strip_confluent_framing_handles_a_header_only_payload():
    assert strip_confluent_framing(CONFLUENT_HEADER) == b""


def _registry(name: str) -> SchemaRegistryClient:
    return SchemaRegistryClient.new_client({"url": f"mock://{name}"})


def _message_class(schema: str, full_name: str):
    parser = ProtobufParser(ProtobufParserConfig(schema_name="loans", schema_text=schema))
    return GetMessageClass(parser.compile_file_descriptor().pool.FindMessageTypeByName(full_name))


MONEY_V1 = 'syntax = "proto3";\npackage org.example.money;\nmessage Money { int64 units = 1; }'
MONEY_V2 = 'syntax = "proto3";\npackage org.example.money;\nmessage Money { string currency = 1; int64 units = 2; }'
# A topic message holding Money amount = 1 with units = 5, encoded against MONEY_V1.
AMOUNT_RECORD = b"\x0a\x02\x08\x05"


def _money_topic_schema(message: str, money_version: int = 1) -> Schema:
    return Schema(
        f'syntax = "proto3";\npackage org.example.{message.lower()};\nimport "money.proto";\n'
        f"message {message} {{ org.example.money.Money amount = 1; }}",
        "PROTOBUF",
        references=[SchemaReference("money.proto", "money.proto", money_version)],
    )


def test_topics_sharing_a_packaged_reference_both_decode():
    registry = _registry("shared-reference")
    registry.register_schema("money.proto", Schema(MONEY_V1, "PROTOBUF"))
    source = _source(registry)

    for message in ("Loan", "Deposit"):
        schema = source._get_protobuf_schema(_money_topic_schema(message))
        result = CommonBrokerSource.decode_message(
            source, AMOUNT_RECORD, schema, SchemaType.Protobuf, topic_name=message.lower()
        )

        assert json.loads(result) == {"amount": {"units": "5"}}, message


def test_writer_schema_reads_the_reference_version_it_pins():
    registry = _registry("pinned-reference")
    registry.register_schema("money.proto", Schema(MONEY_V1, "PROTOBUF"))
    registry.register_schema("money.proto", Schema(MONEY_V2, "PROTOBUF"))
    loan_id = registry.register_schema("loan-value", _money_topic_schema("Loan", money_version=1))
    # Confluent framing: magic byte, the Loan schema id, message index [0].
    record = b"\x00" + loan_id.to_bytes(4, "big") + b"\x00" + AMOUNT_RECORD

    result = CommonBrokerSource.decode_message(_source(registry), record, "", SchemaType.Protobuf, topic_name="loan")

    assert json.loads(result) == {"amount": {"units": "5"}}


def test_unregistered_imports_and_options_are_dropped():
    source = _source(_registry("unregistered-import"))
    schema = source._get_protobuf_schema(
        Schema(
            'syntax = "proto3";\npackage org.example;\nimport "confluent/meta.proto";\n'
            'option java_package = "org.example";\nmessage Loan { string id = 1; }',
            "PROTOBUF",
        )
    )

    result = CommonBrokerSource.decode_message(source, b"\x0a\x03L-1", schema, SchemaType.Protobuf, topic_name="loan")

    assert json.loads(result) == {"id": "L-1"}


def test_record_written_with_an_older_schema_is_read_with_that_schema():
    registry = _registry("writer-schema")
    v1 = 'syntax = "proto3";\nmessage Loan { string id = 1; }'
    # v2 puts a message ahead of Loan, so the v1 record's message index [0] now names Header.
    v2 = 'syntax = "proto3";\nmessage Header { int32 version = 1; }\nmessage Loan { string id = 1; }'
    v1_id = registry.register_schema("loans-value", Schema(v1, "PROTOBUF"))
    registry.register_schema("loans-value", Schema(v2, "PROTOBUF"))
    # Confluent framing: magic byte, the v1 schema id, message index [0]; then the v1 Loan.
    loan = _message_class(v1, "Loan")(id="L-1")
    record = b"\x00" + v1_id.to_bytes(4, "big") + b"\x00" + loan.SerializeToString()

    result = CommonBrokerSource.decode_message(_source(registry), record, v2, SchemaType.Protobuf, topic_name="loans")

    assert json.loads(result) == {"id": "L-1"}


def test_record_is_skipped_when_its_writer_schema_cannot_be_fetched():
    registry = MagicMock()
    registry.get_schema.side_effect = RuntimeError("schema 7 not found")
    source = _source(registry)
    # The topic schema could read this payload, but it may not be the schema that wrote it.
    schema = 'syntax = "proto3";\nmessage Loan { string id = 1; }'
    # Confluent framing: magic byte, schema id 7, message index [0]; then id="L-1".
    payload = b"\x00\x00\x00\x00\x07\x00" + b"\x0a\x03L-1"

    for _ in range(3):
        with pytest.raises(RuntimeError, match="schema 7 not found"):
            CommonBrokerSource.decode_message(source, payload, schema, SchemaType.Protobuf, topic_name="loans")

    registry.get_schema.assert_called_once_with(7)


def test_unframed_record_is_read_with_the_topic_schema():
    registry = MagicMock()
    schema = 'syntax = "proto3";\nmessage Loan { string id = 1; }'

    result = CommonBrokerSource.decode_message(
        _source(registry), b"\x0a\x03L-1", schema, SchemaType.Protobuf, topic_name="loans"
    )

    assert json.loads(result) == {"id": "L-1"}
    registry.get_schema.assert_not_called()
