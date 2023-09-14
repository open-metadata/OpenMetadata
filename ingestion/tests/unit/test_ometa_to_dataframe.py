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
import os
import unittest
from unittest.mock import patch

import pyarrow.parquet as pq

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.datalake.metadata import DatalakeSource
from metadata.mixins.pandas.pandas_mixin import PandasInterfaceMixin
from metadata.readers.dataframe.reader_factory import SupportedTypes

from .topology.database.test_datalake import mock_datalake_config

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

resp_parquet_file = (
    pq.ParquetFile(os.path.join(ROOT_DIR, "test_ometa_to_dataframe.parquet"))
    .read()
    .to_pandas()
)
method_resp_file = [resp_parquet_file]


class TestStringMethods(unittest.TestCase):
    def test_dl_column_parser(self):
        with patch(
            "metadata.utils.datalake.datalake_utils.fetch_dataframe",
            return_value=method_resp_file,
        ) as exec_mock_method:
            resp = exec_mock_method("key", "string")
            assert type(resp) == list

    @patch(
        "metadata.ingestion.source.database.database_service.DatabaseServiceSource.test_connection"
    )
    def test_return_ometa_dataframes_sampled(self, test_connection):
        with patch(
            "metadata.mixins.pandas.pandas_mixin.fetch_dataframe",
            return_value=[resp_parquet_file],
        ):
            config = OpenMetadataWorkflowConfig.parse_obj(mock_datalake_config)
            datalake_source = DatalakeSource.create(
                mock_datalake_config["source"],
                config.workflowConfig.openMetadataServerConfig,
            )
            resp = PandasInterfaceMixin().return_ometa_dataframes_sampled(
                service_connection_config=datalake_source.service_connection,
                table=Table(
                    id="cec14ccf-123f-4271-8c90-0ae54cc4227e",
                    columns=[],
                    name="test",
                    databaseSchema=EntityReference(
                        name="Test",
                        id="cec14ccf-123f-4271-8c90-0ae54cc4227e",
                        type="databaseSchema",
                    ),
                    fileFormat=SupportedTypes.PARQUET.value,
                ),
                client=None,
                profile_sample_config=None,
            )

            assert resp == method_resp_file
            assert type(resp) == list

    @patch(
        "metadata.ingestion.source.database.database_service.DatabaseServiceSource.test_connection"
    )
    def test_return_ometa_dataframes_sampled_fail(self, test_connection):
        with patch(
            "metadata.mixins.pandas.pandas_mixin.fetch_dataframe",
            return_value=None,
        ):
            with self.assertRaises(TypeError) as context:
                config = OpenMetadataWorkflowConfig.parse_obj(mock_datalake_config)
                datalake_source = DatalakeSource.create(
                    mock_datalake_config["source"],
                    config.workflowConfig.openMetadataServerConfig,
                )
                resp = PandasInterfaceMixin().return_ometa_dataframes_sampled(
                    service_connection_config=datalake_source.service_connection,
                    table=Table(
                        id="cec14ccf-123f-4271-8c90-0ae54cc4227e",
                        columns=[],
                        name="test",
                        databaseSchema=EntityReference(
                            name="Test",
                            id="cec14ccf-123f-4271-8c90-0ae54cc4227e",
                            type="databaseSchema",
                        ),
                        fileFormat=None,
                    ),
                    client=None,
                    profile_sample_config=None,
                )

            self.assertEqual(context.exception.args[0], "Couldn't fetch test")
