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
Test suite for the action module implementation
"""

import os
from unittest import mock

import pytest
from jinja2 import Environment
from pytest import mark

from metadata.great_expectations.table_mapper import TablePart
from metadata.great_expectations.utils.ometa_config_handler import render_template

_GX_0_18 = "0.18"

try:
    import great_expectations as gx

    from metadata.great_expectations.action import OpenMetadataValidationAction

    _gx_version_ok = gx.__version__.startswith(_GX_0_18)
except ImportError:
    _gx_version_ok = False

skip_gx = pytest.mark.skipif(
    not _gx_version_ok,
    reason=(
        "Great Expectations not installed or version mismatch "
        f"(required: {_GX_0_18})"
    ),
)


@skip_gx
@mark.parametrize(
    "input,expected",
    [
        (None, "list_entities"),
        ("service_name", "get_by_name"),
    ],
)
def test_get_table_entity(input, expected, mocked_ometa, mocked_ge_data_context):
    """Test get table entity"""

    ometa_validation = OpenMetadataValidationAction(
        data_context=mocked_ge_data_context,
        config_file_path="my/config/path",
        database_service_name=input,
    )

    res = ometa_validation._get_table_entity("database", "schema", "table")
    assert res._type == expected


@skip_gx
@mark.parametrize(
    "input,expected",
    [
        (None, "list_entities"),
        ("service_name", "get_by_name"),
    ],
)
def test_get_table_entity_database_service_name(
    input, expected, mocked_ometa, mocked_ge_data_context
):
    """Test get table entity"""

    ometa_validation = OpenMetadataValidationAction(
        data_context=mocked_ge_data_context,
        config_file_path="my/config/path",
        database_service_name=input,
    )

    res = ometa_validation._get_table_entity("database", "schema", "table")
    assert res._type == expected


def test_create_jinja_environment(fixture_jinja_environment):
    """Test create jinja environment"""
    assert isinstance(fixture_jinja_environment, Environment)


@mock.patch.dict(os.environ, {"API_VERSION": "v1"})
def test_render_template(fixture_jinja_environment):
    """Test create jinja environment"""
    tmplt = render_template(fixture_jinja_environment)
    assert tmplt == "hostPort: http://localhost:8585\napiVersion: v1"


@skip_gx
def test_table_config_map_initialization(
    mocked_ometa, mocked_ge_data_context, table_config_map_fixture
):
    """Test that expectation_suite_table_config_map parameter works"""
    action = OpenMetadataValidationAction(
        data_context=mocked_ge_data_context,
        config_file_path="my/config/path",
        expectation_suite_table_config_map=table_config_map_fixture,
    )

    assert action.expectation_suite_table_config_map == table_config_map_fixture
    assert action.table_mapper is not None


@skip_gx
def test_table_config_map_returns_mapped_values(
    mocked_ometa, mocked_ge_data_context, table_config_map_fixture
):
    """Test that mapped values are actually returned for known suite"""
    action = OpenMetadataValidationAction(
        data_context=mocked_ge_data_context,
        config_file_path="my/config/path",
        database_name="default_db",
        schema_name="default_schema",
        table_name="default_table",
        expectation_suite_table_config_map=table_config_map_fixture,
    )

    # When we ask for a suite that's in the map, should get mapped values
    assert (
        action.table_mapper.get_part_name(TablePart.DATABASE, "test_suite")
        == "mapped_db"
    )
    assert (
        action.table_mapper.get_part_name(TablePart.SCHEMA, "test_suite")
        == "mapped_schema"
    )
    assert (
        action.table_mapper.get_part_name(TablePart.TABLE, "test_suite")
        == "mapped_table"
    )

    # When we ask for a suite NOT in the map, should get defaults
    assert (
        action.table_mapper.get_part_name(TablePart.DATABASE, "unknown_suite")
        == "default_db"
    )
    assert (
        action.table_mapper.get_part_name(TablePart.SCHEMA, "unknown_suite")
        == "default_schema"
    )
    assert (
        action.table_mapper.get_part_name(TablePart.TABLE, "unknown_suite")
        == "default_table"
    )


@skip_gx
def test_backward_compatibility_without_config_map(
    mocked_ometa, mocked_ge_data_context
):
    """Test that existing behavior still works without config map"""
    action = OpenMetadataValidationAction(
        data_context=mocked_ge_data_context,
        config_file_path="my/config/path",
        database_service_name="test_service",
    )

    result = action._get_table_entity("database", "schema", "table")
    assert result._type == "get_by_name"
