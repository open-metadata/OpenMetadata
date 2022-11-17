#  Copyright 2022 Collate
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
Test suite for the action module implementation
"""

import os
from unittest import mock

from jinja2 import Environment
from pytest import mark

from metadata.great_expectations.action import OpenMetadataValidationAction
from metadata.great_expectations.utils.ometa_config_handler import render_template


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
        ometa_service_name=input,
    )

    res = ometa_validation._get_table_entity("database", "schema", "table")
    assert res._type == expected


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
