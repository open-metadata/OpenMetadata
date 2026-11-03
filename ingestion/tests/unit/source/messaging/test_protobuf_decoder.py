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
"""Unit tests for decoding Protobuf topic messages.

Payloads are produced by Confluent's own ProtobufSerializer, so the framing and the
message indexes come from the reference encoder rather than from the decoder's assumptions.
"""

import json
from textwrap import dedent

import pytest
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.protobuf import ProtobufSerializer
from confluent_kafka.serialization import MessageField, SerializationContext
from google.protobuf.message import DecodeError
from google.protobuf.message_factory import GetMessageClass

from metadata.ingestion.source.messaging.protobuf_decoder import ProtobufMessageDecoder
from metadata.parsers.protobuf_parser import ProtobufParser, ProtobufParserConfig

TOPIC = "loans"

SCHEMA = dedent(
    """
    syntax = "proto3";
    package org.example.loans;

    message MyLoanRecord {
      int32 my_field1 = 1;
      double my_field2 = 2;
      string my_field3 = 3;
    }

    message Envelope {
      message Borrower {
        string name = 1;
        repeated string tags = 2;
      }
      Borrower borrower = 1;
      int64 amount = 2;
    }
    """
).strip()


def _message_class(schema: str, full_name: str):
    parser = ProtobufParser(ProtobufParserConfig(schema_name=TOPIC, schema_text=schema))
    return GetMessageClass(parser.compile_file_descriptor().pool.FindMessageTypeByName(full_name))


def _serialize(message) -> bytes:
    registry = SchemaRegistryClient.new_client({"url": "mock://protobuf-decoder"})
    serializer = ProtobufSerializer(type(message), registry, {"use.deprecated.format": False})
    return serializer(message, SerializationContext(TOPIC, MessageField.VALUE))


@pytest.fixture(scope="module")
def decoder():
    return ProtobufMessageDecoder(TOPIC, SCHEMA)


def test_decodes_first_message_of_a_framed_payload(decoder):
    message = _message_class(SCHEMA, "org.example.loans.MyLoanRecord")(my_field1=7, my_field2=1.5, my_field3="ok")

    assert json.loads(decoder(_serialize(message))) == {"my_field1": 7, "my_field2": 1.5, "my_field3": "ok"}


def test_keeps_default_values_and_non_ascii_text(decoder):
    message = _message_class(SCHEMA, "org.example.loans.MyLoanRecord")(my_field3="préstamo")

    result = decoder(_serialize(message))

    assert "préstamo" in result
    assert json.loads(result) == {"my_field1": 0, "my_field2": 0.0, "my_field3": "préstamo"}


def test_follows_message_indexes_to_a_later_top_level_message(decoder):
    envelope_class = _message_class(SCHEMA, "org.example.loans.Envelope")
    envelope = envelope_class(amount=100, borrower=envelope_class.Borrower(name="ada", tags=["vip"]))

    assert json.loads(decoder(_serialize(envelope))) == {
        "borrower": {"name": "ada", "tags": ["vip"]},
        "amount": "100",
    }


def test_follows_message_indexes_to_a_nested_message(decoder):
    borrower = _message_class(SCHEMA, "org.example.loans.Envelope.Borrower")(name="grace", tags=["a", "b"])

    assert json.loads(decoder(_serialize(borrower))) == {"name": "grace", "tags": ["a", "b"]}


def test_decodes_an_unframed_payload_as_the_root_message():
    schema = 'syntax = "proto3";\nmessage Loan { string id = 1; }'
    payload = _message_class(schema, "Loan")(id="L-1").SerializeToString()

    assert json.loads(ProtobufMessageDecoder(TOPIC, schema)(payload)) == {"id": "L-1"}


def test_decodes_a_schema_without_a_package():
    schema = 'syntax = "proto3";\nmessage Loan { string id = 1; }\nmessage Other { int32 n = 1; }'
    other = _message_class(schema, "Other")(n=3)

    assert json.loads(ProtobufMessageDecoder(TOPIC, schema)(_serialize(other))) == {"n": 3}


def test_unframed_payload_without_a_resolvable_root_message_raises(decoder):
    payload = _message_class(SCHEMA, "org.example.loans.MyLoanRecord")(my_field1=1).SerializeToString()

    with pytest.raises(ValueError, match="unframed"):
        decoder(payload)


def test_out_of_range_message_index_raises(decoder):
    # Magic byte, schema id 1, then the zigzag index array [5]: one entry of value 5.
    with pytest.raises(IndexError):
        decoder(b"\x00\x00\x00\x00\x01\x02\x0a")


def test_corrupt_payload_raises(decoder):
    with pytest.raises(DecodeError):
        decoder(b"\x00\x00\x00\x00\x01\x00\xff\xff\xff")
