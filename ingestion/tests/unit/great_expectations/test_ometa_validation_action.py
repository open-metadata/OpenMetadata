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

from metadata.great_expectations.utils.ometa_config_handler import render_template

_GX_1_XX = "1."

try:
    import great_expectations as gx

    from metadata.great_expectations.action import OpenMetadataValidationAction
    from metadata.great_expectations.table_mapper import TablePart

    _gx_version_ok = gx.__version__.startswith(_GX_1_XX)
except ImportError:
    _gx_version_ok = False

skip_gx = pytest.mark.skipif(
    not _gx_version_ok,
    reason=f"Great Expectations not installed or version mismatch (required: {_GX_1_XX}x.x)",
)


def build_action(mocked_ometa=None, **kwargs):
    """Build an action with its OpenMetadata connection already resolved.

    `run` is what opens the connection, so tests that exercise anything downstream
    of it have to inject the client themselves.
    """
    action = OpenMetadataValidationAction(**kwargs)
    if mocked_ometa is not None:
        action.ometa_conn = mocked_ometa
    return action


def test_create_jinja_environment(fixture_jinja_environment):
    """Test create jinja environment"""
    assert isinstance(fixture_jinja_environment, Environment)


@mock.patch.dict(os.environ, {"API_VERSION": "v1"})
def test_render_template(fixture_jinja_environment):
    """Test create jinja environment"""
    tmplt = render_template(fixture_jinja_environment)
    assert tmplt == "hostPort: http://localhost:8585\napiVersion: v1"


@skip_gx
@mark.parametrize(
    "input,expected",
    [
        (None, "list_entities"),
        ("service_name", "get_by_name"),
    ],
)
def test_get_table_entity(input, expected, mocked_ometa):
    """Test get table entity"""
    action = build_action(mocked_ometa, config_file_path="my/config/path", database_service_name=input)

    res = action._get_table_entity("database", "schema", "table")
    assert res._type == expected


@skip_gx
@mark.parametrize(
    "database,schema_name,table_name,expected",
    [
        (None, "schema", "table", "database_name"),
        ("database", None, "table", "schema_name"),
        ("database", "schema", None, "table_name"),
        (None, None, None, "database_name, schema_name, table_name"),
    ],
)
def test_get_table_entity_requires_every_name_part(database, schema_name, table_name, expected, mocked_ometa):
    """Test an incomplete table name is rejected rather than resolved to a `None` FQN part"""
    action = build_action(mocked_ometa, database_service_name="service_name")

    with pytest.raises(ValueError, match=expected):
        action._get_table_entity(database, schema_name, table_name)


@skip_gx
def test_table_config_map_initialization(table_config_map_fixture):
    """Test that expectation_suite_table_config_map parameter works"""
    action = OpenMetadataValidationAction(
        config_file_path="my/config/path",
        expectation_suite_table_config_map=table_config_map_fixture,
    )

    assert action.expectation_suite_table_config_map == table_config_map_fixture
    assert action.table_mapper is not None


@skip_gx
def test_table_config_map_returns_mapped_values(table_config_map_fixture):
    """Test that mapped values are actually returned for known suite"""
    action = OpenMetadataValidationAction(
        config_file_path="my/config/path",
        database_name="default_db",
        schema_name="default_schema",
        table_name="default_table",
        expectation_suite_table_config_map=table_config_map_fixture,
    )

    # When we ask for a suite that's in the map, should get mapped values
    assert action.table_mapper.get_part_name(TablePart.DATABASE, "test_suite") == "mapped_db"
    assert action.table_mapper.get_part_name(TablePart.SCHEMA, "test_suite") == "mapped_schema"
    assert action.table_mapper.get_part_name(TablePart.TABLE, "test_suite") == "mapped_table"

    # When we ask for a suite NOT in the map, should get defaults
    assert action.table_mapper.get_part_name(TablePart.DATABASE, "unknown_suite") == "default_db"
    assert action.table_mapper.get_part_name(TablePart.SCHEMA, "unknown_suite") == "default_schema"
    assert action.table_mapper.get_part_name(TablePart.TABLE, "unknown_suite") == "default_table"


@skip_gx
def test_backward_compatibility_without_config_map(mocked_ometa):
    """Test that existing behavior still works without config map"""
    action = build_action(mocked_ometa, config_file_path="my/config/path", database_service_name="test_service")

    assert action.expectation_suite_table_config_map is None
    assert action._get_table_entity("database", "schema", "table")._type == "get_by_name"


@skip_gx
def test_database_name_is_optional():
    """The database is resolved from the execution engine when it is not configured"""
    action = OpenMetadataValidationAction(schema_name="test_schema", table_name="test_table")

    assert action.database_name is None
    assert action.table_mapper.get_part_name(TablePart.DATABASE, "any_suite") is None


@skip_gx
@mark.parametrize(
    "meta,expected",
    [
        (None, {}),
        ({}, {}),
        ({"batch_spec": None}, {}),
        (
            {"batch_spec": {"type": "table", "table_name": "users", "schema_name": None}},
            {"type": "table", "table_name": "users", "schema_name": None},
        ),
        (
            {"batch_spec": {"query": "SELECT 1", "temp_table_schema_name": None}},
            {"query": "SELECT 1", "temp_table_schema_name": None},
        ),
    ],
)
def test_get_checkpoint_batch_spec(meta, expected):
    """Test that SQL batch specs are returned and a missing one degrades gracefully"""
    assert OpenMetadataValidationAction._get_checkpoint_batch_spec(meta) == expected


@skip_gx
def test_get_checkpoint_batch_spec_rejects_non_sql_datasource():
    """Test that expectations not run against a relational database are rejected"""
    with pytest.raises(ValueError, match="relational database"):
        OpenMetadataValidationAction._get_checkpoint_batch_spec({"batch_spec": {"path": "data.csv"}})


@skip_gx
def test_get_execution_engine_database(mocked_gx_result_meta):
    """Test the database falls back to the one of the execution engine"""
    from sqlalchemy.engine.url import make_url

    urls = {"my_datasource": make_url("postgresql://user:pwd@host:5432/my_database")}

    assert OpenMetadataValidationAction._get_execution_engine_database(mocked_gx_result_meta, urls) == "my_database"
    assert OpenMetadataValidationAction._get_execution_engine_database(mocked_gx_result_meta, {}) is None
    assert OpenMetadataValidationAction._get_execution_engine_database(None, urls) is None


@skip_gx
def test_get_test_case_description(mocked_gx_column_result):
    """Test the description set on the GX expectation is carried over to the test case"""
    action = OpenMetadataValidationAction()

    assert action._get_test_case_description(mocked_gx_column_result) == "column must match the regex"


@skip_gx
def test_get_test_case_description_without_meta(mocked_gx_table_result):
    """Test an expectation without a description does not fail the run"""
    action = OpenMetadataValidationAction()

    assert action._get_test_case_description(mocked_gx_table_result) == ""


@skip_gx
def test_get_test_case_params_value(mocked_gx_column_result):
    """Test parameters are read off the expectation config, without the GX internals"""
    action = OpenMetadataValidationAction()

    params = {param.name: param.value for param in action._get_test_case_params_value(mocked_gx_column_result)}

    assert params == {"regex": "abc.*", "value_set": "[1, 2]", "min_value": "10", "max_value": "20"}


@skip_gx
def test_get_test_case_params_definition(mocked_gx_column_result):
    """Test parameter definitions stay in sync with the parameter values"""
    action = OpenMetadataValidationAction()

    definitions = sorted(param.name for param in action._get_test_case_params_definition(mocked_gx_column_result))
    values = sorted(param.name for param in action._get_test_case_params_value(mocked_gx_column_result))

    assert definitions == values


@skip_gx
def test_get_test_result_value(mocked_gx_column_result):
    """Test the numeric fields of the GX result are turned into test result values"""
    action = OpenMetadataValidationAction()

    results = {result.name: result.value for result in action._get_test_result_value(mocked_gx_column_result)}

    assert results == {"unexpected_count": "3", "missing_count": "1", "element_count": "10000"}


@skip_gx
def test_get_test_result_value_drops_percentages(mocked_gx_column_result):
    """Test percentages are not reported alongside counts.

    OpenMetadata charts every result value of a test case on one axis, so a percentage
    sitting next to a row count is flattened into the baseline and unreadable.
    """
    action = OpenMetadataValidationAction()

    names = {result.name for result in action._get_test_result_value(mocked_gx_column_result)}

    assert not [name for name in names if "percent" in name]


@skip_gx
def test_get_test_result_value_keeps_observed_value(mocked_gx_table_result):
    """Test expectations reporting a single observed value still report it"""
    action = OpenMetadataValidationAction()

    results = {result.name: result.value for result in action._get_test_result_value(mocked_gx_table_result)}

    assert results == {"observed_value": "10"}
