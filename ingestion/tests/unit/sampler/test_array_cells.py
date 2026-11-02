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

import uuid
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import numpy as np
import pandas as pd

from metadata.generated.schema.entity.data.container import Container, FileFormat
from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.sampler.pandas.sampler import DatalakeSampler
from metadata.sampler.sampler_config import DatabaseSamplerConfig
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
