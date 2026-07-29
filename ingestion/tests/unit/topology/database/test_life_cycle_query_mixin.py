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
Unit tests for the shared LifeCycleQueryMixin.

Covers alias parsing of the query model and population of the created/updated
life cycle aspects, including backward-compatibility for sources whose query only
returns a created timestamp.
"""

from datetime import datetime
from unittest.mock import MagicMock

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.source.database.life_cycle_query_mixin import (
    LifeCycleQueryByTable,
    LifeCycleQueryMixin,
)
from metadata.utils.time_utils import datetime_to_timestamp

TABLE_NAME = "my_table"
TABLE_FQN = "service.db.schema.my_table"
CREATED_AT = datetime(2023, 1, 1, 10, 0, 0)
UPDATED_AT = datetime(2024, 6, 15, 12, 30, 0)


def _run_get_life_cycle_data(life_cycle_data):
    mixin = LifeCycleQueryMixin()
    mixin.life_cycle_query_dict = MagicMock(return_value={TABLE_NAME: life_cycle_data})
    return list(
        mixin.get_life_cycle_data(
            entity=Table,
            entity_name=TABLE_NAME,
            entity_fqn=TABLE_FQN,
            query="SELECT 1",
        )
    )


class TestLifeCycleQueryByTable:
    def test_parses_created_and_updated_aliases(self):
        model = LifeCycleQueryByTable.model_validate(
            {
                "TABLE_NAME": TABLE_NAME,
                "CREATED_AT": CREATED_AT,
                "UPDATED_AT": UPDATED_AT,
            }
        )

        assert model.table_name == TABLE_NAME
        assert model.created_at == CREATED_AT
        assert model.updated_at == UPDATED_AT

    def test_updated_at_is_optional(self):
        model = LifeCycleQueryByTable.model_validate({"TABLE_NAME": TABLE_NAME, "CREATED_AT": CREATED_AT})

        assert model.updated_at is None


class TestGetLifeCycleData:
    def test_populates_updated_when_present(self):
        life_cycle_data = LifeCycleQueryByTable(table_name=TABLE_NAME, created_at=CREATED_AT, updated_at=UPDATED_AT)

        results = _run_get_life_cycle_data(life_cycle_data)

        assert len(results) == 1
        life_cycle = results[0].right.life_cycle
        assert life_cycle.created.timestamp.root == datetime_to_timestamp(CREATED_AT, milliseconds=True)
        assert life_cycle.updated is not None
        assert life_cycle.updated.timestamp.root == datetime_to_timestamp(UPDATED_AT, milliseconds=True)

    def test_updated_absent_keeps_created_only(self):
        life_cycle_data = LifeCycleQueryByTable(table_name=TABLE_NAME, created_at=CREATED_AT)

        results = _run_get_life_cycle_data(life_cycle_data)

        assert len(results) == 1
        life_cycle = results[0].right.life_cycle
        assert life_cycle.created.timestamp.root == datetime_to_timestamp(CREATED_AT, milliseconds=True)
        assert life_cycle.updated is None
