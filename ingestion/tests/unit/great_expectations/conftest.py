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
from unittest import mock

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
        entities = [Entity("list_entities")]

    class OmetaMock:
        def get_by_name(self, *args, **kwargs):
            return Entity("get_by_name")

        def list_entities(self, *args, **kwargs):
            return ListEntities()

    return OmetaMock()


@fixture(scope="module")
def mocked_ometa():
    """Mocks OMeta obkect"""
    from metadata.great_expectations.action import OpenMetadataValidationAction

    with mock.patch.object(
        OpenMetadataValidationAction,
        "_create_ometa_connection",
        side_effect=mocked_ometa_object,
    ) as mocked_obj:
        yield mocked_obj


@fixture(scope="module")
def mocked_ge_data_context():
    with mock.patch("great_expectations.DataContext") as mocked_data_context:
        yield mocked_data_context


@fixture(scope="module")
def mocked_ge_column_result():
    return {
        "success": True,
        "expectation_config": {
            "kwargs": {
                "column": "my_column",
                "regex": "abc.*",
                "value_set": [1, 2],
                "min_value": 10,
                "max_value": 20,
            }
        },
        "result": {"unexpected_percent": 0.0},
    }


@fixture(scope="module")
def mocked_ge_table_result():
    return {
        "success": True,
        "expectation_config": {
            "kwargs": {
                "min_value": 10,
                "max_value": 10,
                "value": 10,
            }
        },
        "result": {"observed_value": 10},
    }


@fixture(scope="module")
def fixture_jinja_environment():
    return create_jinja_environment(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "resources")
    )
