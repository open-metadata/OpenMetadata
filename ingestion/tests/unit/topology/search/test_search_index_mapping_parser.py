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
Test the Elasticsearch and OpenSearch index mapping parsers
"""

import logging

import pytest

from metadata.generated.schema.entity.data.searchIndex import DataType
from metadata.ingestion.source.search.elasticsearch import parser as es_parser
from metadata.ingestion.source.search.opensearch import parser as os_parser

parse_es_index_mapping = es_parser.parse_es_index_mapping
parse_os_index_mapping = os_parser.parse_os_index_mapping

PARSERS = [parse_es_index_mapping, parse_os_index_mapping]

# caplog.at_level() must name this logger: other suites pin "metadata" to INFO via
# set_loggers_level, and raising only the root logger leaves the debug record filtered.
PARSER_LOGGER = es_parser.logger.name

MAPPING_WITH_PROPERTIES = {
    "properties": {
        "customer_id": {"type": "keyword"},
        "address": {
            "properties": {
                "city": {"type": "text", "description": "City name"},
            }
        },
    }
}


class TestIndexMappingParser:
    """Behaviour shared by the Elasticsearch and OpenSearch mapping parsers."""

    @pytest.mark.parametrize("parse", PARSERS)
    @pytest.mark.parametrize("mapping", [None, {}])
    def test_missing_mapping_yields_no_fields(self, parse, mapping):
        assert parse(mapping) == []

    @pytest.mark.parametrize("parse", PARSERS)
    @pytest.mark.parametrize("mapping", [None, {}])
    def test_missing_mapping_logs_no_error(self, parse, mapping, caplog):
        with caplog.at_level(logging.DEBUG, logger=PARSER_LOGGER):
            parse(mapping)

        assert not [record for record in caplog.records if record.levelno >= logging.WARNING]
        assert "No mappings to parse" in caplog.text

    @pytest.mark.parametrize("parse", PARSERS)
    def test_mapping_without_properties_yields_no_fields(self, parse):
        assert parse({"_meta": {"managed": True}}) == []

    @pytest.mark.parametrize("parse", PARSERS)
    def test_properties_are_parsed_into_fields(self, parse):
        fields = parse(MAPPING_WITH_PROPERTIES)

        assert [field.name.root for field in fields] == ["customer_id", "address"]
        assert fields[0].dataType == DataType.KEYWORD
        assert fields[0].children is None

    @pytest.mark.parametrize("parse", PARSERS)
    def test_nested_properties_become_children(self, parse):
        address = parse(MAPPING_WITH_PROPERTIES)[1]

        assert address.dataType == DataType.OBJECT
        assert [child.name.root for child in address.children] == ["city"]
        assert address.children[0].description.root == "City name"

    @pytest.mark.parametrize("parse", PARSERS)
    def test_unknown_data_type_falls_back_to_unknown(self, parse):
        fields = parse({"properties": {"weird": {"type": "not_a_real_es_type"}}})

        assert fields[0].dataType == DataType.UNKNOWN
        assert fields[0].dataTypeDisplay == "not_a_real_es_type"
