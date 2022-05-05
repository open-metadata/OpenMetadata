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
Fixtures for test suite
"""

from unittest import mock

from pytest import fixture

from ingestion.src.metadata.great_expectations.action import (
    OpenMetadataValidationAction,
)


def mocked_ometa_object():
    """Mocked function for `_create_ometa_connection`."""

    class FQDN:
        def __init__(self):
            self.__root__ = "database.schema.table"

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


@fixture
def mocked_ometa():
    """Mocks OMeta obkect"""
    with mock.patch.object(
        OpenMetadataValidationAction,
        "_create_ometa_connection",
        side_effect=mocked_ometa_object,
    ) as mocked_obj:
        yield mocked_obj


@fixture
def mocked_ge_data_context():
    with mock.patch("great_expectations.DataContext") as mocked_data_context:
        yield mocked_data_context
