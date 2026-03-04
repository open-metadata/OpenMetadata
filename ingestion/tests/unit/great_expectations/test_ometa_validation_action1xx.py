#  Copyright 2022 Collate
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
Test suite for GX 1.x action module implementation
"""

import pytest

_GX_1_XX = "1."

try:
    import great_expectations as gx

    from metadata.great_expectations.action1xx import OpenMetadataValidationAction1xx
    from metadata.great_expectations.table_mapper import (
        TableConfig,
        TableMapper,
        TablePart,
    )

    _gx_version_ok = gx.__version__.startswith(_GX_1_XX)
except ImportError:
    _gx_version_ok = False

skip_gx1xx = pytest.mark.skipif(
    not _gx_version_ok, reason=f"Great Expectations 1.x required"
)


@skip_gx1xx
def test_gx1xx_config_map_initialization():
    """Test GX 1.x action accepts config map parameter"""
    config_map = {
        "test_suite": {
            "database_name": "test_db",
            "schema_name": "test_schema",
            "table_name": "test_table",
        }
    }

    action = OpenMetadataValidationAction1xx(
        database_name="default_db", expectation_suite_table_config_map=config_map
    )

    assert action.expectation_suite_table_config_map == config_map


@skip_gx1xx
def test_gx1xx_mapping_actually_works():
    """Test that TableMapper in GX 1.x returns correct mapped values"""
    config_map = {
        "mapped_suite": {
            "database_name": "mapped_db",
            "schema_name": "mapped_schema",
            "table_name": "mapped_table",
        }
    }

    action = OpenMetadataValidationAction1xx(
        database_name="default_db",
        schema_name="default_schema",
        table_name="default_table",
        expectation_suite_table_config_map=config_map,
    )

    # Convert dict configs to TableConfig objects like run() method does
    converted_config_map = {
        k: TableConfig.model_validate(v)
        for k, v in action.expectation_suite_table_config_map.items()
    }

    # Create a TableMapper like run() method does
    mapper = TableMapper(
        default_database_name=action.database_name,
        default_schema_name=action.schema_name,
        default_table_name=action.table_name,
        expectation_suite_table_config_map=converted_config_map,
    )

    # Verify mapped suite returns mapped values
    assert mapper.get_part_name(TablePart.DATABASE, "mapped_suite") == "mapped_db"
    assert mapper.get_part_name(TablePart.SCHEMA, "mapped_suite") == "mapped_schema"
    assert mapper.get_part_name(TablePart.TABLE, "mapped_suite") == "mapped_table"

    # Verify unknown suite returns defaults
    assert mapper.get_part_name(TablePart.DATABASE, "unknown") == "default_db"
    assert mapper.get_part_name(TablePart.SCHEMA, "unknown") == "default_schema"
    assert mapper.get_part_name(TablePart.TABLE, "unknown") == "default_table"


@skip_gx1xx
def test_gx1xx_backward_compatibility():
    """Test GX 1.x still works without config map"""
    action = OpenMetadataValidationAction1xx(
        database_name="test_db", schema_name="test_schema", table_name="test_table"
    )

    # Should initialize without errors
    assert action.database_name == "test_db"
    assert action.expectation_suite_table_config_map is None
