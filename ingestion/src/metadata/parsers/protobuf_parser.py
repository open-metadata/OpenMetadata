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
Utils module to parse the protobuf schema
"""

import tempfile
import traceback
from enum import Enum
from importlib.resources import files
from pathlib import Path
from typing import TypeVar

import grpc_tools.protoc
from google.protobuf import descriptor_pb2, descriptor_pool
from google.protobuf.descriptor import Descriptor, FileDescriptor
from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.schema import DataTypeTopic, FieldModel
from metadata.utils.helpers import snake_to_camel
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

ProtobufField = TypeVar("ProtobufField", FieldModel, Column)

PROTO_FILE_NAME = "schema.proto"
DESCRIPTOR_SET_FILE_NAME = "schema.desc"
GRPC_TOOLS_PROTO_PATH = files("grpc_tools").joinpath("_proto")


class ProtobufDataTypes(Enum):
    """
    Enum for Protobuf Datatypes
    """

    UNKNOWN = 0
    DOUBLE = 1
    FLOAT = 2
    INT = 3, 4, 5, 13, 17, 18
    FIXED = 6, 7, 15, 16
    BOOLEAN = 8
    STRING = 9
    UNION = 10
    RECORD = 11
    BYTES = 12
    ENUM = 14

    def __new__(cls, *values):
        obj = object.__new__(cls)
        # first value is canonical value
        obj._value_ = values[0]
        for other_value in values[1:]:
            cls._value2member_map_[other_value] = obj
        obj._all_values = values
        return obj

    def __repr__(self):
        value = ", ".join([repr(v) for v in self._all_values])
        return (
            f"<"  # pylint: disable=no-member
            f"{(self.__class__.__name__,)}"
            f"{self._name_}"
            f"{value}"
            f">"
        )


class ProtobufParserConfig(BaseModel):
    """
    Protobuf Parser Config class
    :param schema_name: Name of protobuf schema
    :param schema_text: Protobuf schema definition in text format
    :param base_file_path: Optional parent directory for temporary parser files.
    """

    schema_name: str
    schema_text: str
    base_file_path: str | None = Field(default=None)


class ProtobufParser:
    """
    Protobuf Parser class
    """

    config: ProtobufParserConfig

    def __init__(self, config: ProtobufParserConfig):
        self.config = config

    def _compile_descriptor_set(self, working_directory: Path) -> descriptor_pb2.FileDescriptorSet:
        """Compile the configured schema into a descriptor set."""
        interface_directory = working_directory / "interfaces"
        interface_directory.mkdir()
        proto_file = interface_directory / PROTO_FILE_NAME
        proto_file.write_text(self.config.schema_text, encoding="UTF-8")
        descriptor_set_file = working_directory / DESCRIPTOR_SET_FILE_NAME

        exit_code = grpc_tools.protoc.main(
            [
                "protoc",
                f"--proto_path={interface_directory}",
                f"--proto_path={GRPC_TOOLS_PROTO_PATH}",
                f"--descriptor_set_out={descriptor_set_file}",
                "--include_imports",
                str(proto_file),
            ]
        )
        if exit_code:
            raise RuntimeError(f"protoc exited with code {exit_code}")

        descriptor_set = descriptor_pb2.FileDescriptorSet()
        descriptor_set.ParseFromString(descriptor_set_file.read_bytes())
        return descriptor_set

    @staticmethod
    def _get_file_descriptor(descriptor_set: descriptor_pb2.FileDescriptorSet) -> FileDescriptor:
        """Load the compiled schema into an isolated descriptor pool."""
        descriptor_protos = {descriptor.name: descriptor for descriptor in descriptor_set.file}
        descriptor_pool_ = descriptor_pool.DescriptorPool()
        added_descriptors = set()

        def add_descriptor(descriptor_name: str) -> None:
            if descriptor_name in added_descriptors:
                return
            descriptor = descriptor_protos.get(descriptor_name)
            if descriptor is None:
                raise ValueError(f"Missing Protobuf dependency: {descriptor_name}")
            for dependency_name in descriptor.dependency:
                add_descriptor(dependency_name)
            descriptor_pool_.Add(descriptor)
            added_descriptors.add(descriptor_name)

        add_descriptor(PROTO_FILE_NAME)
        return descriptor_pool_.FindFileByName(PROTO_FILE_NAME)

    def _get_message_descriptor(self, file_descriptor: FileDescriptor) -> Descriptor | None:
        """Select the root message represented by the topic schema."""
        message_types = file_descriptor.message_types_by_name
        message_descriptor = message_types.get(snake_to_camel(self.config.schema_name))
        if message_descriptor is None and len(message_types) == 1:
            message_descriptor = next(iter(message_types.values()))
        if message_descriptor is None:
            logger.warning(
                "Unable to determine the Protobuf message for %s. Available messages: %s",
                self.config.schema_name,
                ", ".join(message_types),
            )
        return message_descriptor

    def parse_protobuf_schema(self, cls: type[ProtobufField] = FieldModel) -> list[ProtobufField] | None:
        """
        Method to parse the protobuf schema
        """

        try:
            base_file_path = self.config.base_file_path
            temporary_parent = Path(base_file_path).expanduser() if base_file_path and base_file_path.strip() else None
            if temporary_parent:
                temporary_parent.mkdir(parents=True, exist_ok=True)

            with tempfile.TemporaryDirectory(prefix="protobuf_om_", dir=temporary_parent) as temporary_directory:
                descriptor_set = self._compile_descriptor_set(Path(temporary_directory))
                file_descriptor = self._get_file_descriptor(descriptor_set)
                message_descriptor = self._get_message_descriptor(file_descriptor)
                if message_descriptor is None:
                    return None

                return [
                    cls.model_validate(
                        {
                            "name": message_descriptor.name,
                            "dataType": "RECORD",
                            "children": self.get_protobuf_fields(message_descriptor.fields, cls=cls),
                        }
                    )
                ]
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning("Unable to parse protobuf schema for %s: %s", self.config.schema_name, exc)
        return None

    def _get_field_type(self, type_: int, cls: type[ProtobufField] = FieldModel) -> str:
        if type_ > 18:
            return DataType.UNKNOWN.value
        data_type = ProtobufDataTypes(type_).name
        if cls is Column and data_type == DataTypeTopic.FIXED.value:
            return DataType.INT.value
        return data_type

    def get_protobuf_fields(
        self,
        fields,
        cls: type[ProtobufField] = FieldModel,
    ) -> list[ProtobufField]:
        """
        Recursively convert the parsed schema into required models
        """
        field_models: list[ProtobufField] = []

        for field in fields:
            try:
                field_models.append(
                    cls.model_validate(
                        {
                            "name": field.name,
                            "dataType": self._get_field_type(field.type, cls=cls),
                            "children": self.get_protobuf_fields(field.message_type.fields, cls=cls)
                            if field.type == 11
                            else None,
                        }
                    )
                )
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning("Unable to parse the protobuf schema into models: %s", exc)

        return field_models
