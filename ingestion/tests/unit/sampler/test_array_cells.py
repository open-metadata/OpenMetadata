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
Test that the datalake and storage samplers return parquet list cells as lists (#36878).
"""

import json
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from metadata.generated.schema.entity.data.container import Container, FileFormat
from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table, TableData
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
    LocalConfig,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.mixins.container_mixin import OMetaContainerMixin
from metadata.ingestion.ometa.mixins.table_mixin import _sanitize_sample_data_value
from metadata.pii.algorithms.preprocessing import preprocess_values
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.readers.dataframe.parquet import ParquetDataFrameReader
from metadata.sampler.pandas.sampler import DatalakeSampler
from metadata.sampler.sampler_config import DatabaseSamplerConfig
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.sampler.storage.sampler import StorageSampler


def _make_df():
    # pyarrow's to_pandas() gives each cell of a list column as a numpy array, and a
    # list nested in a struct as an array inside the struct's dict.
    return pd.DataFrame(
        {
            "id": [1, 2],
            "emails": [
                np.array(["jane.doe@example.com", "j@corp.io"], dtype=object),
                np.array(["bob@example.org"], dtype=object),
            ],
            "contact": [
                {"phones": np.array(["+1 212 555 0199"], dtype=object)},
                {"phones": np.array([], dtype=object)},
            ],
            "aliases": [
                np.array([np.array(["Jane", "J."], dtype=object)], dtype=object),
                np.array([np.array(["Bob"], dtype=object)], dtype=object),
            ],
        }
    )


EXPECTED_ROWS = [
    [1, ["jane.doe@example.com", "j@corp.io"], {"phones": ["+1 212 555 0199"]}, [["Jane", "J."]]],
    [2, ["bob@example.org"], {"phones": []}, [["Bob"]]],
]


def _assert_lists(rows):
    first = rows[0]
    assert type(first[1]) is list
    assert type(first[2]["phones"]) is list
    assert type(first[3]) is list and type(first[3][0]) is list
    assert rows == EXPECTED_ROWS


TABLE_ENTITY = Table(
    id=uuid4(),
    name="contacts",
    databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name="schema"),
    fileFormat="parquet",
    columns=[
        EntityColumn(name=ColumnName("id"), dataType=DataType.INT),
        EntityColumn(name=ColumnName("emails"), dataType=DataType.ARRAY),
        EntityColumn(name=ColumnName("contact"), dataType=DataType.STRUCT),
        EntityColumn(name=ColumnName("aliases"), dataType=DataType.ARRAY),
    ],
)


class FakeConnection:
    def __init__(self):
        self.client = Mock(_client=None)


class TestDatalakeSamplerArrayCells:
    @patch(
        "metadata.sampler.pandas.sampler.get_ssl_connection",
        return_value=FakeConnection(),
    )
    def test_list_cells_are_returned_as_lists(self, _):
        with (
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
            sample_data = sampler.fetch_sample_data()

        _assert_lists(sample_data.rows)


class _ParquetStorageSampler(StorageSampler):
    def get_client(self):
        return Mock()

    def _get_sample_file_path(self):
        return "contacts.parquet"

    def _get_bucket_name(self):
        return "bucket"

    def _get_config_source(self):
        return Mock()


CONTAINER_ENTITY = Container(
    id=Uuid(root=uuid.uuid4()),
    name=EntityName(root="contacts"),
    fullyQualifiedName=FullyQualifiedEntityName(root="service.contacts"),
    service=EntityReference(id=Uuid(root=uuid.uuid4()), type="storageService"),
    fileFormats=[FileFormat.parquet],
)


class TestStorageSamplerArrayCells:
    def test_list_cells_are_returned_as_lists(self):
        with patch(
            "metadata.sampler.storage.sampler.fetch_dataframe_first_chunk",
            return_value=iter([_make_df()]),
        ):
            sampler = _ParquetStorageSampler(
                service_connection_config=MagicMock(),
                ometa_client=None,
                entity=CONTAINER_ENTITY,
            )
            sample_data = sampler.fetch_sample_data(columns=None)

        _assert_lists(sample_data.rows)


def _datalake_sampler(frames, limit=100):
    with patch("metadata.sampler.pandas.sampler.get_ssl_connection", return_value=FakeConnection()):
        sampler = DatalakeSampler(
            service_connection_config=DatalakeConnection(configSource={}),
            ometa_client=None,
            entity=TABLE_ENTITY,
            config=DatabaseSamplerConfig(),
        )
    sampler._table = DatalakeColumnWrapper(dataframes=lambda: iter(frames), columns=None, raw_data=None)
    sampler.sample_limit = limit
    return sampler


class _DiscardedArray(np.ndarray):
    def tolist(self):
        raise AssertionError("A discarded row was converted")


def test_row_budget_filters_before_converting_across_chunks():
    discarded = np.array(["discarded"]).view(_DiscardedArray)
    frames = [
        pd.DataFrame({"id": [None, 1], "values": [None, np.array(["first"])], "unused": [None, None]}),
        pd.DataFrame({"id": [2, 3, 4], "values": [np.array(["filtered"]), np.array(["second"]), discarded]}),
    ]
    sampler = _datalake_sampler(frames, limit=2)
    cols, rows = sampler.get_col_row(
        sampler.raw_dataset,
        columns=[SimpleNamespace(name="id"), SimpleNamespace(name="values")],
        sample_query="id != 2",
    )
    assert cols == ["id", "values"]
    assert rows == [[1, ["first"]], [3, ["second"]]]


@pytest.mark.parametrize("selected_columns", [False, True])
@pytest.mark.parametrize("sample_query", [None, "id != 2"])
def test_partial_null_rows_count_toward_global_budget(selected_columns, sample_query):
    discarded = np.array(["discarded"]).view(_DiscardedArray)
    frames = [
        pd.DataFrame(
            {
                "id": [None, 1],
                "values": [None, np.array(["first"])],
                "missing": [None, np.nan],
                "unused": ["ignored", "ignored"],
            }
        ),
        pd.DataFrame(
            {
                "id": [2, 3, 4],
                "values": [np.array(["filtered"]), np.array(["second"]), discarded],
                "missing": [pd.NaT, pd.NaT, pd.NaT],
                "unused": ["ignored", "ignored", "ignored"],
            }
        ),
    ]
    if not selected_columns:
        frames = [frame.drop(columns="unused") for frame in frames]
    sampler = _datalake_sampler(frames, limit=2)
    columns = [SimpleNamespace(name=name) for name in ["id", "values", "missing"]] if selected_columns else None
    cols, rows = sampler.get_col_row(sampler.raw_dataset, columns=columns, sample_query=sample_query)
    assert cols == ["id", "values", "missing"]
    second = [2, ["filtered"], None] if sample_query is None else [3, ["second"], None]
    assert rows == [[1, ["first"], None], second]


def test_zero_and_none_row_budget():
    frame = pd.DataFrame({"values": [np.array(["first"]), np.array(["second"])]})
    assert _datalake_sampler([frame], limit=0).fetch_sample_data().rows == []
    assert _datalake_sampler([frame], limit=None).fetch_sample_data().rows == [[["first"]], [["second"]]]


@pytest.mark.parametrize("sampler_kind", ["datalake", "storage"])
@pytest.mark.parametrize("physical_type", ["timestamp", "timestamp_utc", "timestamp_new_york", "map"])
def test_physical_parquet_nested_values_survive_consumers(tmp_path, sampler_kind, physical_type):
    if physical_type.startswith("timestamp"):
        timezone = {"timestamp": None, "timestamp_utc": "UTC", "timestamp_new_york": "America/New_York"}[physical_type]
        value_type = pa.list_(pa.timestamp("ns", tz=timezone))
        values = [[pd.Timestamp("2026-01-02T03:04:05.123456789", tz=timezone), None]]
        # PyArrow normalizes nested timezone timestamps to UTC before returning numpy cells.
        timestamp = (
            "2026-01-02T08:04:05.123456789" if timezone == "America/New_York" else "2026-01-02T03:04:05.123456789"
        )
        expected = [timestamp, None]
        expected_text = [timestamp]
    else:
        value_type = pa.list_(pa.map_(pa.string(), pa.list_(pa.string())))
        values = [[[("contact", ["jane@example.com"]), ("contact", ["bob@example.com"])]]]
        expected = [[["contact", ["jane@example.com"]], ["contact", ["bob@example.com"]]]]
        expected_text = ["contact", "jane@example.com", "contact", "bob@example.com"]
    path = tmp_path / "nested.parquet"
    pq.write_table(pa.table({"values": pa.array(values, type=value_type)}), path)
    parquet_file = pq.ParquetFile(path)
    assert parquet_file.schema_arrow.field("values").type == value_type
    reader = ParquetDataFrameReader(config_source=LocalConfig(), client=None)
    frames = list(reader._read_parquet_in_batches(parquet_file, batch_size=1))
    if sampler_kind == "datalake":
        sample = _datalake_sampler(frames).fetch_sample_data()
    else:
        with patch("metadata.sampler.storage.sampler.fetch_dataframe_first_chunk", return_value=iter(frames)):
            sample = _ParquetStorageSampler(
                service_connection_config=MagicMock(), ometa_client=None, entity=CONTAINER_ENTITY
            ).fetch_sample_data(columns=None)
    assert sample.rows == [[expected]]
    assert preprocess_values([sample.rows[0][0]]) == expected_text
    table_payload = TableData(columns=sample.columns, rows=[[_sanitize_sample_data_value(sample.rows[0][0])]])
    assert json.loads(table_payload.model_dump_json())["rows"] == [[expected]]
    container_payload = OMetaContainerMixin()._serialize_sample_data(sample, "service.contacts")
    assert container_payload is not None
    assert json.loads(container_payload)["rows"] == [[expected]]


def test_object_array_timestamps_and_native_sequences_preserve_scalar_values():
    values = np.array([np.datetime64("2026-01-02T03:04:05.000000001"), np.datetime64("NaT")], dtype=object)
    normalized = SamplerInterface._array_to_list({"values": (values, [1, True, "text", None])})
    assert normalized == {"values": [["2026-01-02T03:04:05.000000001", None], [1, True, "text", None]]}
