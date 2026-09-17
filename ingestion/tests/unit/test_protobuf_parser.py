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
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import grpc_tools.protoc
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
        resource_path = f"{os.path.dirname(__file__)}/resources/protobuf_parser/"  # noqa: PTH120
        schema_name = "employee"
        file_list = os.listdir(resource_path)  # noqa: PTH208
        schema_text = ""
        for file_name in file_list:
            file_path = os.path.join(resource_path, file_name)  # noqa: PTH118
            with open(file_path, "r") as file:  # noqa: PTH123
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


@pytest.mark.parametrize("schema_name", ["../outside", r"..\outside", r"C:\outside"])
def test_schema_name_does_not_control_temporary_file_paths(tmp_path, schema_name):
    parser = ProtobufParser(
        config=ProtobufParserConfig(
            schema_name=schema_name,
            schema_text='syntax = "proto3"; message SafeRecord {}',
            base_file_path=str(tmp_path / "protobuf"),
        )
    )

    parsed_schema = parser.parse_protobuf_schema()

    assert parsed_schema is not None
    assert parsed_schema[0].name.root == "SafeRecord"
    assert not (tmp_path / "protobuf" / "outside.proto").exists()
    assert not (tmp_path / "outside.proto").exists()


def test_absolute_schema_name_does_not_control_temporary_file_paths(tmp_path):
    outside_path = tmp_path / "outside"
    parser = ProtobufParser(
        config=ProtobufParserConfig(
            schema_name=str(outside_path),
            schema_text='syntax = "proto3"; message SafeRecord {}',
            base_file_path=str(tmp_path / "protobuf"),
        )
    )

    parsed_schema = parser.parse_protobuf_schema()

    assert parsed_schema is not None
    assert parsed_schema[0].name.root == "SafeRecord"
    assert not outside_path.with_suffix(".proto").exists()


def test_parse_preserves_configured_temporary_parent(tmp_path):
    base_file_path = tmp_path / "protobuf"
    base_file_path.mkdir()
    sentinel = base_file_path / "keep.txt"
    sentinel.write_text("keep", encoding="UTF-8")
    parser = ProtobufParser(
        config=ProtobufParserConfig(
            schema_name="safe_schema",
            schema_text='syntax = "proto3"; message SafeSchema {}',
            base_file_path=str(base_file_path),
        )
    )

    parsed_schema = parser.parse_protobuf_schema()

    assert parsed_schema is not None
    assert parsed_schema[0].name.root == "SafeSchema"
    assert sentinel.read_text(encoding="UTF-8") == "keep"
    assert {path.name for path in base_file_path.iterdir()} == {"keep.txt"}


def test_parse_uses_only_top_level_message_when_topic_name_does_not_match(tmp_path):
    parser = ProtobufParser(
        config=ProtobufParserConfig(
            schema_name="loans",
            schema_text="""
                syntax = "proto3";
                package org.example.loans;

                message MyLoanRecord {
                    int32 my_field1 = 1;
                    double my_field2 = 2;
                    string my_field3 = 3;
                }
            """,
            base_file_path=str(tmp_path / "protobuf"),
        )
    )

    parsed_schema = parser.parse_protobuf_schema()

    assert parsed_schema is not None
    assert parsed_schema[0].name.root == "MyLoanRecord"
    assert parsed_schema[0].dataType.name == "RECORD"
    assert [(field.name.root, field.dataType.name) for field in parsed_schema[0].children] == [
        ("my_field1", "INT"),
        ("my_field2", "DOUBLE"),
        ("my_field3", "STRING"),
    ]


def test_parse_does_not_guess_when_multiple_top_level_messages_do_not_match_topic(tmp_path):
    base_file_path = tmp_path / "protobuf"
    base_file_path.mkdir()
    sentinel = base_file_path / "keep.txt"
    sentinel.write_text("keep", encoding="UTF-8")
    parser = ProtobufParser(
        config=ProtobufParserConfig(
            schema_name="loan_events",
            schema_text="""
                syntax = "proto3";

                message LoanCreated {}
                message LoanApproved {}
            """,
            base_file_path=str(base_file_path),
        )
    )

    assert parser.parse_protobuf_schema() is None
    assert sentinel.read_text(encoding="UTF-8") == "keep"
    assert not (base_file_path / "generated").exists()
    assert not (base_file_path / "interfaces").exists()


def test_reparse_same_schema_name_uses_latest_schema(tmp_path):
    def parse(schema_text):
        return ProtobufParser(
            config=ProtobufParserConfig(
                schema_name="event",
                schema_text=schema_text,
                base_file_path=str(tmp_path),
            )
        ).parse_protobuf_schema()

    first_schema = parse('syntax = "proto3"; package org.example; message Event { string first_field = 1; }')
    second_schema = parse('syntax = "proto3"; package org.example; message Event { int32 second_field = 1; }')

    assert first_schema is not None
    assert second_schema is not None
    assert [(field.name.root, field.dataType.name) for field in first_schema[0].children] == [("first_field", "STRING")]
    assert [(field.name.root, field.dataType.name) for field in second_schema[0].children] == [("second_field", "INT")]


def test_parse_accepts_topic_name_that_is_not_a_python_identifier(tmp_path):
    parser = ProtobufParser(
        config=ProtobufParserConfig(
            schema_name="loan.events-v1",
            schema_text='syntax = "proto3"; message LoanEvent { string event_id = 1; }',
            base_file_path=str(tmp_path),
        )
    )

    parsed_schema = parser.parse_protobuf_schema()

    assert parsed_schema is not None
    assert parsed_schema[0].name.root == "LoanEvent"


def test_none_temporary_parent_does_not_create_relative_none_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    parser = ProtobufParser(
        config=ProtobufParserConfig(
            schema_name="event",
            schema_text='syntax = "proto3"; message Event {}',
            base_file_path=None,
        )
    )

    assert parser.parse_protobuf_schema() is not None
    assert not (tmp_path / "None").exists()


def test_whitespace_temporary_parent_uses_system_temporary_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    parser = ProtobufParser(
        config=ProtobufParserConfig(
            schema_name="event",
            schema_text='syntax = "proto3"; message Event {}',
            base_file_path="  \t",
        )
    )

    assert parser.parse_protobuf_schema() is not None
    assert list(tmp_path.iterdir()) == []


def test_parse_well_known_type_after_reference_preprocessing(tmp_path):
    schema_text = merge_and_clean_protobuf_schema(
        'syntax = "proto3";\n'
        'import "details.proto";\n'
        'import "google/protobuf/timestamp.proto";\n'
        "message Details { string source = 1; }\n"
        "message Event {\n"
        "  Details details = 1;\n"
        "  google.protobuf.Timestamp created_at = 2;\n"
        "}"
    )
    parser = ProtobufParser(
        config=ProtobufParserConfig(
            schema_name="event",
            schema_text=schema_text,
            base_file_path=str(tmp_path),
        )
    )

    parsed_schema = parser.parse_protobuf_schema()

    assert parsed_schema is not None
    assert parsed_schema[0].name.root == "Event"
    assert [(field.name.root, field.dataType.name) for field in parsed_schema[0].children] == [
        ("details", "RECORD"),
        ("created_at", "RECORD"),
    ]
    assert [(field.name.root, field.dataType.name) for field in parsed_schema[0].children[0].children] == [
        ("source", "STRING"),
    ]
    assert [(field.name.root, field.dataType.name) for field in parsed_schema[0].children[1].children] == [
        ("seconds", "INT"),
        ("nanos", "INT"),
    ]


def test_protoc_failure_reports_exit_code(tmp_path, caplog):
    parser = ProtobufParser(
        config=ProtobufParserConfig(
            schema_name="event",
            schema_text='syntax = "proto3"; message Event { invalid field = 1; }',
            base_file_path=str(tmp_path),
        )
    )

    assert parser.parse_protobuf_schema() is None
    assert "protoc exited with code" in caplog.text


def test_concurrent_parses_use_isolated_temporary_directories(tmp_path, monkeypatch):
    parser_count = 4
    compile_barrier = Barrier(parser_count)
    protoc_main = grpc_tools.protoc.main

    def synchronized_protoc(args):
        compile_barrier.wait(timeout=10)
        return protoc_main(args)

    monkeypatch.setattr(grpc_tools.protoc, "main", synchronized_protoc)

    def parse(index):
        parsed_schema = ProtobufParser(
            config=ProtobufParserConfig(
                schema_name="event",
                schema_text=f'syntax = "proto3"; message Event {{ string field_{index} = 1; }}',
                base_file_path=str(tmp_path),
            )
        ).parse_protobuf_schema()
        return parsed_schema[0].children[0].name.root if parsed_schema else None

    with ThreadPoolExecutor(max_workers=parser_count) as executor:
        parsed_names = list(executor.map(parse, range(parser_count)))

    assert parsed_names == [f"field_{index}" for index in range(parser_count)]
    assert list(tmp_path.iterdir()) == []
