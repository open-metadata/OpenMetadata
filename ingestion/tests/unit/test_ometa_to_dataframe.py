#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Test Ometa Dataframe utility tests"""

from unittest.mock import patch

import pyarrow.parquet as pq
import pytest
from pandas import DataFrame

from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.datalake.metadata import DatalakeSource
from metadata.mixins.pandas.pandas_mixin import PandasInterfaceMixin
from metadata.utils.gcs_utils import read_parquet_from_gcs

from .topology.database.test_datalake import mock_datalake_config

resp_parquet_file = (
    pq.ParquetFile("ingestion/tests/unit/test_ometa_to_dataframe.parquet")
    .read()
    .to_pandas()
)
method_resp_file = [resp_parquet_file]


def test_dl_column_parser():
    with patch(
        "metadata.utils.gcs_utils.read_parquet_from_gcs", return_value=method_resp_file
    ) as exec_mock_method:
        resp = exec_mock_method("key", "string")
        assert type(resp) == list


@patch(
    "metadata.ingestion.source.database.database_service.DatabaseServiceSource.test_connection"
)
def test_return_ometa_dataframes_sampled(test_connection):
    with patch(
        "metadata.mixins.pandas.pandas_mixin.ometa_to_dataframe",
        return_value=resp_parquet_file,
    ):
        mock_datalake_config
        config = OpenMetadataWorkflowConfig.parse_obj(mock_datalake_config)
        datalake_source = DatalakeSource.create(
            mock_datalake_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        resp = PandasInterfaceMixin().return_ometa_dataframes_sampled(
            datalake_source.service_connection, None, None, None
        )

        assert resp == method_resp_file
        assert type(resp) == list



@patch(
    "metadata.ingestion.source.database.database_service.DatabaseServiceSource.test_connection"
)
def test_return_ometa_dataframes_sampled_fail(test_connection):
    with patch(
        "metadata.mixins.pandas.pandas_mixin.ometa_to_dataframe",
        return_value=None,
    ):
        mock_datalake_config
        config = OpenMetadataWorkflowConfig.parse_obj(mock_datalake_config)
        datalake_source = DatalakeSource.create(
            mock_datalake_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        resp = PandasInterfaceMixin().return_ometa_dataframes_sampled(
            datalake_source.service_connection, None, None, None
        )

        assert resp == []
        assert type(resp) == list
