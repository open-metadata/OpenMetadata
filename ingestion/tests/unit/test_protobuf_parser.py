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
Protobuf parser tests
"""

import os

import pytest

from metadata.generated.schema.entity.data.table import Column
from metadata.parsers.protobuf_parser import ProtobufParser, ProtobufParserConfig
from metadata.utils.messaging_utils import merge_and_clean_protobuf_schema


@pytest.fixture(scope="class")
def protobuf_base_path(worker_id):
    worker_suffix = f"_{worker_id}" if worker_id != "master" else ""
    return f"/tmp/protobuf_openmetadata{worker_suffix}"


@pytest.fixture(scope="class")
def sample_protobuf_schema():
    return """
    syntax = "proto3";
    package persons;
    enum Gender {
        M = 0; // male
        F = 1; // female
        O = 2; // other
    }

    message Result {
        string url = 1;
        string title = 2;
        repeated string snippets = 3;
    }

    message PersonInfo {
        int32 age = 1; // age in years
        Gender gender = 2;
        Result gender_new = 3;
        int32 height = 4; // height in cm
        fixed32 height_new = 5; // height in cm
        bool my_bool = 6;
        repeated string repeated_string = 7;
    }
    """


@pytest.fixture(scope="class")
def protobuf_parser(sample_protobuf_schema, protobuf_base_path):
    schema_name = "person_info"
    return ProtobufParser(
        config=ProtobufParserConfig(
            schema_name=schema_name,
            schema_text=sample_protobuf_schema,
            base_file_path=protobuf_base_path,
        )
    )


@pytest.fixture(scope="class")
def parsed_schema(protobuf_parser):
    return protobuf_parser.parse_protobuf_schema()


@pytest.mark.usefixtures("parsed_schema")
class ProtobufParserTests:
    """
    Check methods from protobuf_parser.py
    """

    def test_schema_name(self, parsed_schema):
        assert parsed_schema[0].name.root == "PersonInfo"

    def test_schema_type(self, parsed_schema):
        assert parsed_schema[0].dataType.name == "RECORD"

    def test_field_names(self, parsed_schema):
        field_names = {str(field.name.root) for field in parsed_schema[0].children}
        assert field_names == {
            "height",
            "gender",
            "age",
            "gender_new",
            "height_new",
            "my_bool",
            "repeated_string",
        }

    def test_field_types(self, parsed_schema):
        field_types = {str(field.dataType.name) for field in parsed_schema[0].children}
        assert field_types == {"INT", "ENUM", "RECORD", "FIXED", "STRING", "BOOLEAN"}

    def test_column_types(self, protobuf_parser):
        parsed_schema = protobuf_parser.parse_protobuf_schema(cls=Column)
        field_types = {str(field.dataType.name) for field in parsed_schema[0].children}
        assert field_types == {"INT", "ENUM", "RECORD", "STRING", "BOOLEAN"}

    def test_complex_protobuf_schema_files(self, protobuf_base_path):
        """
        We'll read the files under ./ingestion/tests/unit/resources/protobuf_parser and parse them
        This will be similar in way to how we get the data from kafka source
        """
        resource_path = f"{os.path.dirname(__file__)}/resources/protobuf_parser/"
        schema_name = "employee"
        file_list = os.listdir(resource_path)
        schema_text = ""
        for file_name in file_list:
            file_path = os.path.join(resource_path, file_name)
            with open(file_path, "r") as file:
                schema_text = schema_text + file.read()
        schema_text = merge_and_clean_protobuf_schema(schema_text)
        protobuf_parser = ProtobufParser(
            config=ProtobufParserConfig(
                schema_name=schema_name,
                schema_text=schema_text,
                base_file_path=protobuf_base_path,
            )
        )
        parsed_schema = protobuf_parser.parse_protobuf_schema()
        assert parsed_schema[0].name.root == "Employee"
        assert len(parsed_schema[0].children) == 4
        assert parsed_schema[0].children[3].name.root == "contact"
        assert parsed_schema[0].children[3].children[0].name.root == "email"
        assert parsed_schema[0].children[3].children[1].name.root == "phone"
