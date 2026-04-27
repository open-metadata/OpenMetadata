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

import glob
import importlib
import shutil
import sys
import traceback
from enum import Enum
from pathlib import Path
from typing import List, Optional, Type, Union

import grpc_tools.protoc
from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.schema import DataTypeTopic, FieldModel
from metadata.utils.helpers import snake_to_camel
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


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
    :param base_file_path: A temporary directory will be created under this path for
      generating the files required for protobuf parsing and compiling. By default
      the directory will be created under "/tmp/protobuf_openmetadata" unless it is
      specified in the parameter.
    """

    schema_name: str
    schema_text: str
    base_file_path: Optional[str] = "/tmp/protobuf_openmetadata"

def _resolve_message_class(module, schema_name: str):
    """
    Resolve the top-level Protobuf message class from a compiled _pb2 module.
 
    FIX for issue #15274:
    The old code did getattr(module, snake_to_camel(schema_name)) which only
    worked when the Protobuf message name matched the topic/schema name exactly.
    If they differed (e.g. topic='loans', message='MyLoanRecord'), getattr
    returned None and downstream code crashed with:
        'NoneType' object has no attribute 'DESCRIPTOR'
 
    New strategy (two-step with fallback):
 
    Step 1 — Legacy exact-name match (backward compatible):
        Try snake_to_camel(schema_name) first.
        If it resolves to a valid class, use it — zero regression for
        existing setups where message name matches topic name.
 
    Step 2 — DESCRIPTOR introspection (the actual fix):
        Ask the compiled module itself what messages are defined inside it
        using pb2_module.DESCRIPTOR.message_types_by_name.
        Pick the first declared message — no guessing, no string manipulation.
 
    :param module: The compiled _pb2 Python module
    :param schema_name: The Kafka topic / schema name (e.g. "loans")
    :return: An instantiated Protobuf message object, or None on failure
    """
    from google.protobuf.message import Message  # already a required dep
 
    # ------------------------------------------------------------------
    # Step 1: Legacy path — try PascalCase of schema_name (old behavior)
    # ------------------------------------------------------------------
    camel_name = snake_to_camel(schema_name)
    candidate = getattr(module, camel_name, None)
    if (
        candidate is not None
        and isinstance(candidate, type)
        and issubclass(candidate, Message)
    ):
        logger.debug(
            f"Resolved protobuf message '{camel_name}' via name match for schema '{schema_name}'"
        )
        return candidate()
 
    # ------------------------------------------------------------------
    # Step 2: DESCRIPTOR introspection — works regardless of message name
    # ------------------------------------------------------------------
    file_descriptor = getattr(module, "DESCRIPTOR", None)
    if file_descriptor is None:
        logger.warning(
            f"Unable to resolve protobuf message for '{schema_name}': "
            "compiled pb2 module has no DESCRIPTOR attribute."
        )
        return None
 
    declared_messages = list(file_descriptor.message_types_by_name.keys())
 
    if not declared_messages:
        logger.warning(
            f"Unable to resolve protobuf message for '{schema_name}': "
            "DESCRIPTOR reports no top-level messages in schema."
        )
        return None
 
    # If multiple top-level messages exist, log which one we pick so
    # operators can debug if the wrong one is chosen.
    chosen_name = declared_messages[0]
    if len(declared_messages) > 1:
        logger.debug(
            f"Schema '{schema_name}' defines multiple top-level messages "
            f"{declared_messages}. Using '{chosen_name}' for field extraction."
        )
 
    message_class = getattr(module, chosen_name, None)
    if message_class is None:
        logger.warning(
            f"Unable to resolve protobuf message for '{schema_name}': "
            f"DESCRIPTOR lists '{chosen_name}' but it is not an attribute of the pb2 module."
        )
        return None
 
    logger.debug(
        f"Resolved protobuf message '{chosen_name}' via DESCRIPTOR introspection "
        f"for schema '{schema_name}' (message name differs from schema name)"
    )
    return message_class()


class ProtobufParser:
    """
    Protobuf Parser class
    """

    config: ProtobufParserConfig

    def __init__(self, config):
        self.config = config
        self.proto_interface_dir = f"{self.config.base_file_path}/interfaces"
        self.generated_src_dir = f"{self.config.base_file_path}/generated/"

    def load_module(self, module):
        """
        Get the python module from path
        """
        module_path = module
        return __import__(module_path, fromlist=[module])

    def create_proto_files(self):
        """
        Method to generate the protobuf directory and file structure
        """
        try:
            # Create a temporary directory for saving all the files if not already present
            generated_src_dir_path = Path(self.generated_src_dir)
            generated_src_dir_path.mkdir(parents=True, exist_ok=True)
            proto_interface_dir_path = Path(self.proto_interface_dir)
            proto_interface_dir_path.mkdir(parents=True, exist_ok=True)

            # Create a .proto file under the interfaces directory with schema text
            file_path = f"{self.proto_interface_dir}/{self.config.schema_name}.proto"
            with open(file_path, "w", encoding="UTF-8") as file:
                file.write(self.config.schema_text)
            proto_path = "generated=" + self.proto_interface_dir
            return proto_path, file_path
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to create protobuf directory structure for {self.config.schema_name}: {exc}")
        return None

    def get_protobuf_python_object(self, proto_path: str, file_path: str):
        """
        Method to create protobuf python module and get object
        FIX (#15274): Replaced direct getattr(message, snake_to_camel(schema_name))
        with _resolve_message_class() which falls back to DESCRIPTOR introspection
        when the message name does not match the schema/topic name.
        """
        try:
            # compile the .proto file and create python class
            grpc_tools.protoc.main(
                [
                    "protoc",
                    file_path,
                    f"--proto_path={proto_path}",
                    f"--python_out={self.config.base_file_path}",
                ]
            )

            # import the python file
            sys.path.append(self.generated_src_dir)
            generated_src_dir_path = Path(self.generated_src_dir)
            py_file = glob.glob(str(generated_src_dir_path.joinpath(f"{self.config.schema_name}_pb2.py")))[0]
            module_name = Path(py_file).stem
            message = importlib.import_module(module_name)

            instance = _resolve_message_class(message, self.config.schema_name)
            return instance
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to create protobuf python module for {self.config.schema_name}: {exc}")
        return None

    def parse_protobuf_schema(self, cls: Type[BaseModel] = FieldModel) -> Optional[List[Union[FieldModel, Column]]]:
        """
        Method to parse the protobuf schema
        """

        try:
            proto_path, file_path = self.create_proto_files()
            instance = self.get_protobuf_python_object(proto_path=proto_path, file_path=file_path)

            field_models = [
                cls(
                    name=instance.DESCRIPTOR.name,
                    dataType="RECORD",
                    children=self.get_protobuf_fields(instance.DESCRIPTOR.fields, cls=cls),
                )
            ]

            # Clean up the tmp folder
            if Path(self.config.base_file_path).exists():
                shutil.rmtree(self.config.base_file_path)

            return field_models
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to parse protobuf schema for {self.config.schema_name}: {exc}")
        return None

    def _get_field_type(self, type_: int, cls: Type[BaseModel] = FieldModel) -> str:
        if type_ > 18:
            return DataType.UNKNOWN.value
        data_type = ProtobufDataTypes(type_).name
        if cls == Column and data_type == DataTypeTopic.FIXED.value:
            return DataType.INT.value
        return data_type

    def get_protobuf_fields(
        self, fields, cls: Type[BaseModel] = FieldModel
    ) -> Optional[List[Union[FieldModel, Column]]]:
        """
        Recursively convert the parsed schema into required models
        """
        field_models = []

        for field in fields:
            try:
                field_models.append(
                    cls(
                        name=field.name,
                        dataType=self._get_field_type(field.type, cls=cls),
                        children=self.get_protobuf_fields(field.message_type.fields, cls=cls)
                        if field.type == 11
                        else None,
                    )
                )
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(f"Unable to parse the protobuf schema into models: {exc}")

        return field_models
