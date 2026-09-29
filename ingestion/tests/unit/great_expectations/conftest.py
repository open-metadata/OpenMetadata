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
Fixtures for test suite
"""

import os

from pytest import fixture

from metadata.great_expectations.utils.ometa_config_handler import (
    create_jinja_environment,
)


def mocked_ometa_object():
    """Mocked function for `_create_ometa_connection`."""

    class FQDN:
        def __init__(self):
            self.root = "database.schema.table"

    class Entity:
        def __init__(self, _type):
            self.fullyQualifiedName = FQDN()  # pylint: disable=invalid-name
            self._type = _type

    class ListEntities:
        entities = [Entity("list_entities")]  # noqa: RUF012

    class OmetaMock:
        def get_by_name(self, *args, **kwargs):
            return Entity("get_by_name")

        def list_entities(self, *args, **kwargs):
            return ListEntities()

    return OmetaMock()


class MockedExpectationConfiguration(dict):
    """Stands in for a GX `ExpectationConfiguration`.

    GX exposes it as a dict-like object whose keys are also reachable as attributes,
    which is how the action reads `kwargs` and `meta` off it.
    """

    @property
    def kwargs(self):
        return self["kwargs"]

    @property
    def meta(self):
        return self["meta"]


@fixture(scope="module")
def mocked_ometa():
    """Mocks OMeta object"""
    return mocked_ometa_object()


@fixture(scope="module")
def mocked_gx_column_result():
    return {
        "success": True,
        "expectation_config": MockedExpectationConfiguration(
            {
                "type": "expect_column_values_to_match_regex",
                "meta": {"description": "column must match the regex"},
                "kwargs": {
                    "column": "my_column",
                    "batch_id": "my_datasource-my_asset",
                    "regex": "abc.*",
                    "value_set": [1, 2],
                    "min_value": 10,
                    "max_value": 20,
                },
            }
        ),
        # The percentages are what GX actually reports; the action is expected to drop
        # them so counts and percentages never share a chart axis.
        "result": {
            "element_count": 10000,
            "unexpected_count": 3,
            "unexpected_percent": 0.03,
            "unexpected_percent_total": 0.03,
            "missing_count": 1,
            "missing_percent": 0.01,
        },
    }


@fixture(scope="module")
def mocked_gx_table_result():
    return {
        "success": True,
        "expectation_config": MockedExpectationConfiguration(
            {
                "type": "expect_table_row_count_to_equal",
                "meta": {},
                "kwargs": {
                    "min_value": 10,
                    "max_value": 10,
                    "value": 10,
                },
            }
        ),
        "result": {"observed_value": 10},
    }


@fixture(scope="module")
def mocked_gx_result_meta():
    """Metadata GX attaches to a validation result"""
    return {
        "active_batch_definition": {
            "datasource_name": "my_datasource",
            "data_asset_name": "my_asset",
        },
        "batch_spec": {"type": "table", "table_name": "users", "schema_name": None},
    }


@fixture(scope="module")
def fixture_jinja_environment():
    return create_jinja_environment(os.path.join(os.path.dirname(os.path.abspath(__file__)), "resources"))  # noqa: PTH100, PTH118, PTH120


@fixture(scope="module")
def table_config_map_fixture():
    """Simple config map for testing new expectation_suite_table_config_map feature"""
    return {
        "test_suite": {
            "database_name": "mapped_db",
            "schema_name": "mapped_schema",
            "table_name": "mapped_table",
        }
    }
