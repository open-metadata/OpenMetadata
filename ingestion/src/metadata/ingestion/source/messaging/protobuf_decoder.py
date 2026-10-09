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
Decode Protobuf topic messages into JSON for sample data
"""

import io
import json

from confluent_kafka.schema_registry.serde import SchemaId
from google.protobuf import descriptor_pb2
from google.protobuf.descriptor import Descriptor
from google.protobuf.json_format import MessageToDict
from google.protobuf.message_factory import GetMessageClass

from metadata.parsers.protobuf_parser import ProtobufParser, ProtobufParserConfig

PROTOBUF_SCHEMA_TYPE = "PROTOBUF"

# Confluent wire format magic bytes: 0 is followed by a schema id, 1 by a schema guid.
# A bare Protobuf message can never start with either: its first byte is a field tag,
# and field number 0 is invalid.
CONFLUENT_MAGIC_BYTES = (0, 1)


class ProtobufMessageDecoder:
    """
    Decode the messages of a topic whose value schema is Protobuf.

    The schema is compiled once. Confluent-framed messages name the message type
    they carry through their message indexes; bare messages are read as the root
    message the schema parser picks for the topic.
    """

    def __init__(self, topic_name: str, schema_text: str):
        parser = ProtobufParser(ProtobufParserConfig(schema_name=topic_name, schema_text=schema_text))
        self._file_descriptor = parser.compile_file_descriptor()
        self._file_proto = descriptor_pb2.FileDescriptorProto()
        self._file_descriptor.CopyToProto(self._file_proto)
        self._root_descriptor = parser.get_message_descriptor(self._file_descriptor)

    def __call__(self, record: bytes) -> str:
        payload, message_indexes = self._read_frame(record)
        message = GetMessageClass(self._get_descriptor(message_indexes))()
        message.ParseFromString(payload)
        # Proto3 omits fields holding their default value; a sample should show them.
        decoded = MessageToDict(message, preserving_proto_field_name=True, always_print_fields_with_no_presence=True)
        return json.dumps(decoded, ensure_ascii=False)

    @staticmethod
    def _read_frame(record: bytes) -> tuple[bytes, list[int] | None]:
        if not record or record[0] not in CONFLUENT_MAGIC_BYTES:
            return record, None
        schema_id = SchemaId(PROTOBUF_SCHEMA_TYPE)
        payload = schema_id.from_bytes(io.BytesIO(record))
        return payload.read(), schema_id.message_indexes

    def _get_descriptor(self, message_indexes: list[int] | None) -> Descriptor:
        if message_indexes is None:
            if self._root_descriptor is None:
                raise ValueError("Cannot pick the Protobuf message type of an unframed payload")
            return self._root_descriptor

        names = []
        messages = self._file_proto.message_type
        for index in message_indexes:
            names.append(messages[index].name)
            messages = messages[index].nested_type
        full_name = ".".join(filter(None, [self._file_proto.package, *names]))
        return self._file_descriptor.pool.FindMessageTypeByName(full_name)
