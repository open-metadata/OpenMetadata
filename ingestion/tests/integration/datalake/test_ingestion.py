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

"""Datalake ingestion integration tests"""

import pytest

from metadata.generated.schema.entity.data.table import DataType, Table
from metadata.ingestion.ometa.models import EntityList
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from .conftest import BUCKET_NAME


class TestDatalake:
    """datalake profiler E2E test"""

    metadata: OpenMetadata = None
    s3_client = None

    @pytest.fixture(autouse=True)
    def set_metadata(self, metadata):
        self.metadata = metadata

    @pytest.mark.order(10000)
    def test_ingestion(self, run_ingestion):
        """test ingestion of datalake data"""
        # Ingest our S3 data
        resp: EntityList[Table] = self.metadata.list_entities(
            entity=Table, params={"database": "datalake_for_integration_tests.default"}
        )  # type: ignore

        entities = resp.entities
        assert len(entities) == 5
        names = [entity.name.root for entity in entities]
        assert {
            "names.json",
            "names.jsonl",
            "new_users.parquet",
            "users/users.csv",
            "profiler_test_.csv",
        } == set(names)

        for entity in entities:
            columns = entity.columns
            for column in columns:
                if column.dataType == DataType.JSON:
                    assert column.children

    def test_auto_classification(self, run_auto_classification):
        """Also excluding the test for parquet files until the above is fixed"""
        csv_ = self.metadata.get_by_name(
            entity=Table,
            fqn=f'datalake_for_integration_tests.default.{BUCKET_NAME}."users/users.csv"',
            fields=["tableProfilerConfig"],
        )
        # parquet_ = self.metadata.get_by_name(
        #     entity=Table,
        #     fqn='datalake_for_integration_tests.default.MyBucket."new_users.parquet"',
        #     fields=["tableProfilerConfig"],
        # )
        json_ = self.metadata.get_by_name(
            entity=Table,
            fqn=f'datalake_for_integration_tests.default.{BUCKET_NAME}."names.json"',
            fields=["tableProfilerConfig"],
        )

        jsonl_ = self.metadata.get_by_name(
            entity=Table,
            fqn=f'datalake_for_integration_tests.default.{BUCKET_NAME}."names.jsonl"',
            fields=["tableProfilerConfig"],
        )

        csv_sample_data = self.metadata.get_sample_data(csv_)
        # parquet_sample_data = self.metadata.get_sample_data(parquet_)
        json_sample_data = self.metadata.get_sample_data(json_)
        jsonl_sample_data = self.metadata.get_sample_data(jsonl_)

        assert csv_sample_data.sampleData.rows
        # assert parquet_sample_data.sampleData.rows
        assert json_sample_data.sampleData.rows
        assert jsonl_sample_data.sampleData.rows
