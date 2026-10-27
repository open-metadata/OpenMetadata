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
"""GCS file readers must read as the impersonated service account the client was built with.

gcsfs resolves its own identity from ADC, so without the token the readers silently fall
back to the base service account and 403 when only the target account can read the bucket.
"""

from unittest.mock import patch

import pytest
from google.auth.credentials import AnonymousCredentials
from google.auth.impersonated_credentials import Credentials as ImpersonatedCredentials
from google.cloud.storage import Client

from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.ingestion.source.storage.gcs.client import MultiProjectClient
from metadata.readers.dataframe.avro import AvroDataFrameReader
from metadata.readers.dataframe.dsv import DSVDataFrameReader
from metadata.readers.dataframe.json import JSONDataFrameReader
from metadata.readers.dataframe.mf4 import MF4DataFrameReader
from metadata.readers.dataframe.parquet import ParquetDataFrameReader
from metadata.readers.file.gcs import get_gcs_impersonated_token


class _StopReadError(Exception):
    """Raised by the patched filesystem so the test stops right after it was built."""


@pytest.fixture
def impersonated():
    return ImpersonatedCredentials(
        source_credentials=AnonymousCredentials(),
        target_principal="target@my-project.iam.gserviceaccount.com",
        target_scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )


def test_token_is_the_impersonated_credentials_of_a_storage_client(impersonated):
    assert get_gcs_impersonated_token(Client(project="p1", credentials=impersonated)) is impersonated


def test_token_is_the_impersonated_credentials_of_a_multi_project_client(impersonated):
    client = MultiProjectClient(client_class=Client, project_ids=["p1", "p2"], credentials=impersonated)
    assert get_gcs_impersonated_token(client) is impersonated


def test_no_token_for_base_identity_clients():
    assert get_gcs_impersonated_token(Client(project="p1", credentials=AnonymousCredentials())) is None
    base_identity = MultiProjectClient(client_class=Client, project_ids=["p1"], credentials=AnonymousCredentials())
    assert get_gcs_impersonated_token(base_identity) is None
    assert get_gcs_impersonated_token(None) is None


def _read(reader):
    with pytest.raises(_StopReadError):
        result = reader._read(key="folder/file", bucket_name="bucket")
        for _ in result.dataframes():
            pass


@pytest.mark.parametrize(
    "reader_class",
    [ParquetDataFrameReader, JSONDataFrameReader, AvroDataFrameReader, MF4DataFrameReader],
)
def test_gcsfs_readers_use_the_client_identity(reader_class, impersonated):
    with patch("gcsfs.GCSFileSystem", side_effect=_StopReadError) as mock_gcsfs:
        _read(reader_class(GCSConfig(), Client(project="p1", credentials=impersonated)))
        _read(reader_class(GCSConfig(), Client(project="p1", credentials=AnonymousCredentials())))

    assert [c.kwargs for c in mock_gcsfs.call_args_list] == [{"token": impersonated}, {"token": None}]


def test_csv_reader_uses_the_client_identity(impersonated):
    with patch("pandas.read_csv", side_effect=_StopReadError) as mock_read_csv:
        _read(DSVDataFrameReader(GCSConfig(), Client(project="p1", credentials=impersonated)))
        _read(DSVDataFrameReader(GCSConfig(), Client(project="p1", credentials=AnonymousCredentials())))

    assert [c.kwargs["storage_options"] for c in mock_read_csv.call_args_list] == [{"token": impersonated}, None]
