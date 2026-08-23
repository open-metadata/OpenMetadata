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
Unit tests for Salesforce Data 360 utility functions
"""

import pytest

from metadata.generated.schema.entity.data.table import ConstraintType
from metadata.ingestion.source.database.data360.constant import (
    Constant,
    MetadataTypesConstant,
    ResponseConstant,
)
from metadata.ingestion.source.database.data360.utils import (
    add_column_suffix,
    combine_ci_fields,
    decode_html_entities,
    get_json_config,
    get_metadata_type,
    get_schema_name,
    get_table_constraints,
    get_table_partition,
)


def test_get_metadata_type_maps_known_schemas():
    assert get_metadata_type(Constant.DATA_LAKE_OBJECTS) == MetadataTypesConstant.DATA_LAKE_OBJECT
    assert get_metadata_type(Constant.DATA_MODEL_OBJECTS) == MetadataTypesConstant.DATA_MODEL_OBJECT
    assert get_metadata_type(Constant.CALCULATED_INSIGHTS) == MetadataTypesConstant.CALCULATED_INSIGHT


def test_get_metadata_type_returns_none_for_unknown_schema():
    assert get_metadata_type("Unknown Schema") is None


def test_get_table_constraints_builds_primary_key():
    primary_keys = [{ResponseConstant.NAME: "id"}, {ResponseConstant.NAME: "region"}]
    constraints = get_table_constraints(primary_keys)
    assert len(constraints) == 1
    assert constraints[0].constraintType == ConstraintType.PRIMARY_KEY
    assert constraints[0].columns == ["id", "region"]


def test_get_table_constraints_with_no_primary_keys():
    assert get_table_constraints([]) == []


def test_combine_ci_fields_tags_dimensions_and_measures():
    table = {
        ResponseConstant.DIMENSIONS: [{ResponseConstant.NAME: "region"}],
        ResponseConstant.MEASURES: [{ResponseConstant.NAME: "total"}],
    }
    combine_ci_fields(table)
    fields = table[ResponseConstant.FIELDS]
    assert len(fields) == 2
    assert fields[0][Constant.FIELD_TYPE] == Constant.DIMENSION
    assert fields[1][Constant.FIELD_TYPE] == Constant.MEASURE


def test_combine_ci_fields_defaults_to_empty_lists():
    table = {}
    combine_ci_fields(table)
    assert table[ResponseConstant.FIELDS] == []


def test_get_table_partition_builds_partition_column():
    partition = get_table_partition("event_date")
    assert partition.columns is not None
    assert partition.columns[0].columnName == "event_date"


@pytest.mark.parametrize(
    "table_name,expected_schema",
    [
        ("account_dll", Constant.DATA_LAKE_OBJECTS),
        ("account_dlm", Constant.DATA_MODEL_OBJECTS),
        ("revenue_cio", Constant.CALCULATED_INSIGHTS),
    ],
)
def test_get_schema_name_infers_from_suffix(table_name, expected_schema):
    assert get_schema_name(table_name) == expected_schema


def test_get_schema_name_raises_for_unknown_suffix():
    with pytest.raises(ValueError, match="Cannot infer schema"):
        get_schema_name("unknown_suffix")


def test_get_json_config_returns_none_for_unknown_type():
    assert get_json_config("UnknownType") is None


def test_get_json_config_calculated_insight_uses_batch_size_and_total():
    config = get_json_config(MetadataTypesConstant.CALCULATED_INSIGHT)
    assert config is not None
    assert config[Constant.LIMIT] == Constant.BATCH_SIZE
    assert config[ResponseConstant.TOTAL_SIZE] == ResponseConstant.TOTAL


def test_get_json_config_dataspaces_uses_limit_and_total_size():
    config = get_json_config(MetadataTypesConstant.DATASPACES)
    assert config is not None
    assert config[Constant.LIMIT] == Constant.LIMIT
    assert config[ResponseConstant.TOTAL_SIZE] == ResponseConstant.TOTAL_SIZE
    assert config[ResponseConstant.ITEMS] == ResponseConstant.DATASPACES


def test_add_column_suffix_appends_when_missing():
    assert add_column_suffix("Revenue") == "Revenue__c"


def test_add_column_suffix_is_idempotent():
    assert add_column_suffix("Revenue__c") == "Revenue__c"


def test_decode_html_entities_unescapes():
    assert decode_html_entities("SELECT * FROM Account WHERE Amount &gt; 100") == (
        "SELECT * FROM Account WHERE Amount > 100"
    )


def test_decode_html_entities_handles_empty_string():
    assert decode_html_entities("") == ""
