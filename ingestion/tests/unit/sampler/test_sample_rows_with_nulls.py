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
Test that the datalake sampler keeps rows that have some null cells.
"""

from unittest.mock import Mock, patch
from uuid import uuid4

import pandas as pd

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.sampler.pandas.sampler import DatalakeSampler
from metadata.sampler.sampler_config import DatabaseSamplerConfig

TABLE_ENTITY = Table(
    id=uuid4(),
    name="users",
    databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name="schema"),
    fileFormat="csv",
    columns=[
        EntityColumn(name=ColumnName("id"), dataType=DataType.INT),
        EntityColumn(name=ColumnName("email"), dataType=DataType.STRING),
        EntityColumn(name=ColumnName("middle_name"), dataType=DataType.STRING),
        EntityColumn(name=ColumnName("score"), dataType=DataType.FLOAT),
        EntityColumn(name=ColumnName("signup"), dataType=DataType.DATETIME),
        EntityColumn(name=ColumnName("phones"), dataType=DataType.ARRAY),
    ],
)


def _make_df():
    # middle_name is empty in every row, and the last row is empty everywhere.
    return pd.DataFrame(
        {
            "id": [1, 2, 3, None],
            "email": ["jane.doe@example.com", "bob@example.org", None, None],
            "middle_name": [None, None, None, None],
            "score": [1.5, float("nan"), 2.0, float("nan")],
            "signup": pd.to_datetime(["2024-01-02", None, "2024-03-04", None]),
            "phones": [["+1 212 555 0199"], [], None, None],
        }
    )


class FakeConnection:
    def __init__(self):
        self.client = Mock(_client=None)


def _fetch_sample_rows():
    with (
        patch(
            "metadata.sampler.pandas.sampler.get_ssl_connection",
            return_value=FakeConnection(),
        ),
        patch.object(
            DatalakeSampler,
            "get_dataframes",
            return_value=DatalakeColumnWrapper(dataframes=lambda: iter([_make_df()]), columns=None, raw_data=None),
        ),
        patch.object(DatalakeSampler, "get_client", return_value=Mock()),
    ):
        sampler = DatalakeSampler(
            service_connection_config=DatalakeConnection(configSource={}),
            ometa_client=None,
            entity=TABLE_ENTITY,
            config=DatabaseSamplerConfig(),
        )
        return sampler.fetch_sample_data().rows


def test_rows_with_null_cells_are_kept():
    rows = _fetch_sample_rows()

    assert [row[0] for row in rows] == [1.0, 2.0, 3.0]


def test_missing_values_are_returned_as_none():
    rows = _fetch_sample_rows()

    assert rows[0] == [1.0, "jane.doe@example.com", None, 1.5, pd.Timestamp("2024-01-02"), ["+1 212 555 0199"]]
    assert rows[1] == [2.0, "bob@example.org", None, None, None, []]
    assert rows[2] == [3.0, None, None, 2.0, pd.Timestamp("2024-03-04"), None]
