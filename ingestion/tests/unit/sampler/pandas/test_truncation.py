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
Test that DatalakeSampler truncates oversized cell values during fetch_sample_data.
"""
import sys
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest

if sys.version_info < (3, 9):
    pytest.skip(
        "requires python 3.9+ due to incompatibility with object patch",
        allow_module_level=True,
    )

import pandas as pd

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.sampler.models import SampleConfig
from metadata.sampler.pandas.sampler import DatalakeSampler
from metadata.utils.constants import SAMPLE_DATA_MAX_CELL_LENGTH


class FakeClient:
    def __init__(self):
        self._client = None


class FakeConnection:
    def __init__(self):
        self.client = FakeClient()


OVERSIZED_TEXT = "x" * (SAMPLE_DATA_MAX_CELL_LENGTH + 50_000)
AT_LIMIT_TEXT = "y" * SAMPLE_DATA_MAX_CELL_LENGTH
SMALL_TEXT = "z" * 100


def _make_df():
    return pd.DataFrame(
        {
            "name": ["oversized", "at_limit", "small"],
            "body": [OVERSIZED_TEXT, AT_LIMIT_TEXT, SMALL_TEXT],
            "age": [25, 30, 35],
        }
    )


TABLE_ENTITY = Table(
    id=uuid4(),
    name="huge_text",
    databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name="schema"),
    fileFormat="csv",
    columns=[
        EntityColumn(name=ColumnName("name"), dataType=DataType.STRING),
        EntityColumn(name=ColumnName("body"), dataType=DataType.STRING),
        EntityColumn(name=ColumnName("age"), dataType=DataType.INT),
    ],
)


def _build_sampler(**kwargs):
    with (
        patch.object(
            DatalakeSampler,
            "get_dataframes",
            return_value=DatalakeColumnWrapper(
                dataframes=lambda: iter([_make_df()]),
                columns=None,
                raw_data=None,
            ),
        ),
        patch.object(DatalakeSampler, "get_client", return_value=Mock()),
    ):
        return DatalakeSampler(
            service_connection_config=DatalakeConnection(configSource={}),
            ometa_client=None,
            entity=TABLE_ENTITY,
            sample_config=SampleConfig(),
            **kwargs,
        )


class TestDatalakeSamplerTruncation:
    """Verify that DatalakeSampler truncates values exceeding SAMPLE_DATA_MAX_CELL_LENGTH."""

    @patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    def test_fetch_sample_data_truncates_oversized_cells(self, _):
        sampler = _build_sampler()
        sample_data = sampler.fetch_sample_data()

        for row in sample_data.rows:
            for cell in row:
                if isinstance(cell, str):
                    assert len(cell) <= SAMPLE_DATA_MAX_CELL_LENGTH

    @patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    def test_oversized_body_is_truncated_to_limit(self, _):
        sampler = _build_sampler()
        sample_data = sampler.fetch_sample_data()

        body_idx = next(
            i for i, col in enumerate(sample_data.columns) if str(col.root) == "body"
        )
        oversized_row = next(
            row for row in sample_data.rows if row[0] == "oversized"
        )
        assert len(oversized_row[body_idx]) == SAMPLE_DATA_MAX_CELL_LENGTH

    @patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    def test_value_at_limit_is_not_truncated(self, _):
        sampler = _build_sampler()
        sample_data = sampler.fetch_sample_data()

        body_idx = next(
            i for i, col in enumerate(sample_data.columns) if str(col.root) == "body"
        )
        at_limit_row = next(
            row for row in sample_data.rows if row[0] == "at_limit"
        )
        assert len(at_limit_row[body_idx]) == SAMPLE_DATA_MAX_CELL_LENGTH

    @patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    def test_small_value_is_unchanged(self, _):
        sampler = _build_sampler()
        sample_data = sampler.fetch_sample_data()

        body_idx = next(
            i for i, col in enumerate(sample_data.columns) if str(col.root) == "body"
        )
        small_row = next(row for row in sample_data.rows if row[0] == "small")
        assert small_row[body_idx] == SMALL_TEXT
