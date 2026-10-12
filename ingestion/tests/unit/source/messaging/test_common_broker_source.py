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
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from cachetools import LRUCache

from metadata.generated.schema.type.schema import SchemaType
from metadata.ingestion.source.messaging.common_broker_source import (
    AVRO_DESERIALIZER_CACHE_SIZE,
    CommonBrokerSource,
    strip_confluent_framing,
)

CONFLUENT_HEADER = b"\x00\x00\x00\x00\x01"


def _source():
    return SimpleNamespace(
        schema_registry_client=object(),
        _avro_deserializers=LRUCache(maxsize=AVRO_DESERIALIZER_CACHE_SIZE),
    )


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


def test_decode_message_protobuf_is_not_supported():
    assert CommonBrokerSource.decode_message(_source(), b"anything", "", SchemaType.Protobuf) == ""


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
