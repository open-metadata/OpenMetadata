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
A failed avro parse must never echo the file content into the logs
"""

import io
import json
import logging

from metadata.parsers.avro_parser import parse_avro_schema
from metadata.readers.dataframe.avro import AvroDataFrameReader

INGESTION_LOGGER = "metadata.Ingestion"
SENSITIVE_VALUE = "super_secret_value_12345"
SENSITIVE_KEY = "secret_key"

MISSING_TYPE_SCHEMA = json.dumps({SENSITIVE_KEY: SENSITIVE_VALUE})

# avro raises a bare AvroException here, not a SchemaParseException, and quotes the symbols
DUPLICATE_SYMBOL_SCHEMA = json.dumps({"type": "enum", "name": "my_enum", "symbols": [SENSITIVE_VALUE, SENSITIVE_VALUE]})


def _assert_no_leak(records):
    for record in records:
        assert SENSITIVE_VALUE not in record.getMessage()
        assert SENSITIVE_KEY not in record.getMessage()


def test_schema_parse_failure_does_not_leak_content(caplog):
    with caplog.at_level(logging.DEBUG, logger=INGESTION_LOGGER):
        result = parse_avro_schema(MISSING_TYPE_SCHEMA)

    assert result is None
    assert caplog.records
    _assert_no_leak(caplog.records)


def test_non_schema_parse_avro_failure_does_not_leak_content(caplog):
    with caplog.at_level(logging.DEBUG, logger=INGESTION_LOGGER):
        result = parse_avro_schema(DUPLICATE_SYMBOL_SCHEMA)

    assert result is None
    assert caplog.records
    _assert_no_leak(caplog.records)


def test_parse_failure_reports_exception_type(caplog):
    with caplog.at_level(logging.WARNING, logger=INGESTION_LOGGER):
        parse_avro_schema(MISSING_TYPE_SCHEMA)

    assert "SchemaParseException" in caplog.text


def test_reader_failure_reports_exception_type(caplog):
    corrupt_file = io.BytesIO(MISSING_TYPE_SCHEMA.encode())

    with caplog.at_level(logging.WARNING, logger=INGESTION_LOGGER):
        columns = AvroDataFrameReader._get_avro_columns(corrupt_file)

    assert columns is None
    assert "ValueError" in caplog.text
    _assert_no_leak(caplog.records)
