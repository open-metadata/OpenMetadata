#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
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
from typing import Optional

import grpc_tools.protoc
from pydantic import BaseModel

from metadata.utils.helpers import snake_to_camel
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ProtobufDataTypes(Enum):
    """
    Enum for Protobuf Datatypes
    """

    # Field type unknown.
    TYPE_UNKNOWN = 0
    # Field type double.
    TYPE_DOUBLE = 1
    # Field type float.
    TYPE_FLOAT = 2
    # Field type int64.
    TYPE_INT64 = 3
    # Field type uint64.
    TYPE_UINT64 = 4
    # Field type int32.
    TYPE_INT32 = 5
    # Field type fixed64.
    TYPE_FIXED64 = 6
    # Field type fixed32.
    TYPE_FIXED32 = 7
    # Field type bool.
    TYPE_BOOL = 8
    # Field type string.
    TYPE_STRING = 9
    # Field type group. Proto2 syntax only, and deprecated.
    TYPE_GROUP = 10
    # Field type message.
    TYPE_MESSAGE = 11
    # Field type bytes.
    TYPE_BYTES = 12
    # Field type uint32.
    TYPE_UINT32 = 13
    # Field type enum.
    TYPE_ENUM = 14
    # Field type sfixed32.
    TYPE_SFIXED32 = 15
    # Field type sfixed64.
    TYPE_SFIXED64 = 16
    # Field type sint32.
    TYPE_SINT32 = 17
    # Field type sint64.
    TYPE_SINT64 = 18


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
            logger.warning(
                f"Unable to create protobuf directory structure for {self.config.schema_name}: {exc}"
            )
        return None

    def get_protobuf_python_object(self, proto_path: str, file_path: str):
        """
        Method to create protobuf python module and get object
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
            py_file = glob.glob(
                str(
                    generated_src_dir_path.joinpath(f"{self.config.schema_name}_pb2.py")
                )
            )[0]
            module_name = Path(py_file).stem
            message = importlib.import_module(module_name)

            # get the class and create a object instance
            class_ = getattr(message, snake_to_camel(self.config.schema_name))
            instance = class_()
            return instance
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unable to create protobuf python module for {self.config.schema_name}: {exc}"
            )
        return None

    def parse_protobuf_schema(self) -> Optional[dict]:
        """
        Method to parse the protobuf schema
        """

        try:
            proto_path, file_path = self.create_proto_files()
            instance = self.get_protobuf_python_object(
                proto_path=proto_path, file_path=file_path
            )

            # processing the object and parsing the schema
            parsed_schema = {}
            parsed_schema["name"] = instance.DESCRIPTOR.name
            parsed_schema["full_name"] = instance.DESCRIPTOR.full_name
            parsed_schema["fields"] = []

            for field in instance.DESCRIPTOR.fields:
                field_dict = {
                    "name": field.name,
                    "full_name": field.full_name,
                    "type": ProtobufDataTypes(field.type).name,
                }
                parsed_schema["fields"].append(field_dict)

            # Clean up the tmp folder
            if Path(self.config.base_file_path).exists():
                shutil.rmtree(self.config.base_file_path)

            return parsed_schema
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unable to parse protobuf schema for {self.config.schema_name}: {exc}"
            )
        return None
