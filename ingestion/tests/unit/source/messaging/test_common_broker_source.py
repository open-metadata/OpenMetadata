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

from types import SimpleNamespace
from unittest.mock import patch

from metadata.generated.schema.type.schema import SchemaType
from metadata.ingestion.source.messaging.common_broker_source import CommonBrokerSource


def test_decode_message_avro_skips_re_deserialization_for_decoded_values():
    source = SimpleNamespace(schema_registry_client=object())
    decoded_payload = {"event_id": "1", "status": "ok"}

    with patch("metadata.ingestion.source.messaging.common_broker_source.AvroDeserializer") as mock_deserializer:
        result = CommonBrokerSource.decode_message(source, decoded_payload, "ignored-schema", SchemaType.Avro)

    mock_deserializer.assert_not_called()
    assert result == str(decoded_payload)


def test_decode_message_avro_deserializes_bytes_payload():
    source = SimpleNamespace(schema_registry_client=object())

    with patch("metadata.ingestion.source.messaging.common_broker_source.AvroDeserializer") as mock_deserializer:
        mock_deserializer.return_value.return_value = {"event_id": "2"}
        result = CommonBrokerSource.decode_message(source, b"binary-payload", "avro-schema", SchemaType.Avro)

    mock_deserializer.assert_called_once_with(
        schema_str="avro-schema",
        schema_registry_client=source.schema_registry_client,
    )
    mock_deserializer.return_value.assert_called_once_with(b"binary-payload", None)
    assert result == str({"event_id": "2"})


def test_decode_message_non_avro_handles_bytes_and_decoded_values():
    source = SimpleNamespace(schema_registry_client=object())
    decoded_payload = {"foo": "bar"}

    bytes_result = CommonBrokerSource.decode_message(source, b"plain-text", "ignored-schema", SchemaType.Other)
    decoded_result = CommonBrokerSource.decode_message(source, decoded_payload, "ignored-schema", SchemaType.Other)

    assert bytes_result == "plain-text"
    assert decoded_result == str(decoded_payload)
