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
"""
Unit tests for Object store source
"""
import datetime
import io
import json
from typing import List
from unittest import TestCase
from unittest.mock import patch

import pandas as pd
from botocore.response import StreamingBody

from metadata.generated.schema.entity.data.container import (
    ContainerDataModel,
    FileFormat,
)
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.generated.schema.metadataIngestion.objectstore.containerMetadataConfig import (
    MetadataEntry,
    ObjectStoreContainerConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.datalake.metadata import DatalakeSource
from metadata.ingestion.source.objectstore.s3.metadata import (
    S3BucketResponse,
    S3ContainerDetails,
    S3Source,
)

MOCK_OBJECT_STORE_CONFIG = {
    "source": {
        "type": "s3",
        "serviceName": "s3_test",
        "serviceConnection": {
            "config": {"type": "S3", "awsConfig": {"awsRegion": "us-east-1"}}
        },
        "sourceConfig": {
            "config": {
                "type": "ObjectStoreMetadata",
                "containerFilterPattern": {"includes": ["^test_*"]},
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}
MOCK_S3_BUCKETS_RESPONSE = {
    "Buckets": [
        {"Name": "test_transactions", "CreationDate": datetime.datetime(2000, 1, 1)},
        {"Name": "test_sales", "CreationDate": datetime.datetime(2000, 2, 2)},
        {"Name": "events", "CreationDate": datetime.datetime(2000, 3, 3)},
    ]
}
MOCK_S3_METADATA_FILE_RESPONSE = {
    "entries": [
        {
            "dataPath": "transactions",
            "structureFormat": "csv",
            "isPartitioned": False,
        }
    ]
}
EXPECTED_S3_BUCKETS: List[S3BucketResponse] = [
    S3BucketResponse(
        Name="test_transactions", CreationDate=datetime.datetime(2000, 1, 1)
    ),
    S3BucketResponse(Name="test_sales", CreationDate=datetime.datetime(2000, 2, 2)),
]
MOCK_S3_OBJECT_FILE_PATHS = {
    "Contents": [
        {"Key": "transactions/", "Size": 0},
        {"Key": "transactions/transactions_1.csv", "Size": 69},
        {"Key": "transactions/transactions_2.csv", "Size": 55},
    ]
}


class ObjectStoreUnitTest(TestCase):
    """
    Validate how we work with object store metadata
    """

    @patch(
        "metadata.ingestion.source.objectstore.objectstore_service.ObjectStoreServiceSource.test_connection"
    )
    def __init__(self, method_name: str, test_connection) -> None:
        super().__init__(method_name)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(MOCK_OBJECT_STORE_CONFIG)

        # This already validates that the source can be initialized
        self.object_store_source = S3Source.create(
            MOCK_OBJECT_STORE_CONFIG["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_create_from_invalid_source(self):
        """
        An invalid config raises an error
        """
        not_object_store_source = {
            "type": "s3",
            "serviceName": "mysql_local",
            "serviceConnection": {
                "config": {
                    "type": "Mysql",
                    "username": "openmetadata_user",
                    "password": "openmetadata_password",
                    "hostPort": "localhost:3306",
                    "databaseSchema": "openmetadata_db",
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "ObjectStoreMetadata",
                }
            },
        }
        self.assertRaises(
            InvalidSourceException,
            S3Source.create,
            not_object_store_source,
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_s3_buckets_fetching(self):
        self.object_store_source.s3_client.list_buckets = (
            lambda: MOCK_S3_BUCKETS_RESPONSE
        )
        self.assertListEqual(
            self.object_store_source.fetch_buckets(), EXPECTED_S3_BUCKETS
        )

    def test_load_metadata_file(self):
        self.object_store_source._is_metadata_file_present = lambda bucket_name: True
        self.object_store_source.s3_client.get_object = (
            lambda Bucket, Key: self._compute_mocked_metadata_file_response()
        )
        container_config: ObjectStoreContainerConfig = (
            self.object_store_source._load_metadata_file(bucket_name="test")
        )

        self.assertEqual(1, len(container_config.entries))
        self.assertEqual(
            MetadataEntry(
                dataPath="transactions",
                structureFormat="csv",
                isPartitioned=False,
            ),
            container_config.entries[0],
        )

    def test_no_metadata_file_returned_when_file_not_present(self):
        self.object_store_source._is_metadata_file_present = lambda bucket_name: False
        self.assertIsNone(
            self.object_store_source._load_metadata_file(bucket_name="test")
        )

    def test_generate_unstructured_container(self):
        bucket_response = S3BucketResponse(
            Name="test_bucket", CreationDate=datetime.datetime(2000, 1, 1)
        )
        self.object_store_source._fetch_metric = lambda bucket_name, metric: 100.0
        self.assertEqual(
            S3ContainerDetails(
                name=bucket_response.name,
                prefix="/",
                number_of_objects=100,
                size=100,
                file_formats=[],
                data_model=None,
                creation_date=bucket_response.creation_date.isoformat(),
            ),
            self.object_store_source._generate_unstructured_container(
                bucket_response=bucket_response
            ),
        )

    def test_generate_structured_container(self):
        self.object_store_source._get_sample_file_path = (
            lambda bucket_name, metadata_entry: "transactions/file_1.csv"
        )
        self.object_store_source._fetch_metric = lambda bucket_name, metric: 100.0
        columns: List[Column] = [
            Column(
                name=ColumnName(__root__="transaction_id"),
                dataType=DataType.INT,
                dataTypeDisplay="INT",
                dataLength=1,
            ),
            Column(
                name=ColumnName(__root__="transaction_value"),
                dataType=DataType.INT,
                dataTypeDisplay="INT",
                dataLength=1,
            ),
        ]
        self.object_store_source.extract_column_definitions = (
            lambda bucket_name, sample_key: columns
        )
        self.assertEquals(
            S3ContainerDetails(
                name="test_bucket.transactions",
                prefix="/transactions",
                number_of_objects=100,
                size=100,
                file_formats=[FileFormat.csv],
                data_model=ContainerDataModel(isPartitioned=False, columns=columns),
                creation_date=datetime.datetime(2000, 1, 1).isoformat(),
            ),
            self.object_store_source._generate_container_details(
                S3BucketResponse(
                    Name="test_bucket", CreationDate=datetime.datetime(2000, 1, 1)
                ),
                MetadataEntry(
                    dataPath="transactions",
                    structureFormat="csv",
                    isPartitioned=False,
                ),
            ),
        )

    #  Most of the parsing support are covered in test_datalake unit tests related to the Data lake implementation
    def test_extract_column_definitions(self):
        DatalakeSource.get_s3_files = lambda client, key, bucket_name, client_kwargs: [
            pd.DataFrame.from_dict(
                [
                    {"transaction_id": 1, "transaction_value": 100},
                    {"transaction_id": 2, "transaction_value": 200},
                    {"transaction_id": 3, "transaction_value": 300},
                ]
            )
        ]
        self.assertListEqual(
            [
                Column(
                    name=ColumnName(__root__="transaction_id"),
                    dataType=DataType.INT,
                    dataTypeDisplay="INT",
                    dataLength=1,
                ),
                Column(
                    name=ColumnName(__root__="transaction_value"),
                    dataType=DataType.INT,
                    dataTypeDisplay="INT",
                    dataLength=1,
                ),
            ],
            self.object_store_source.extract_column_definitions(
                bucket_name="test_bucket", sample_key="test.json"
            ),
        )

    def test_get_sample_file_prefix_for_structured_and_partitioned_metadata(self):
        input_metadata = MetadataEntry(
            dataPath="transactions",
            structureFormat="parquet",
            isPartitioned=True,
            partitionColumn="date",
        )
        self.assertEquals(
            "transactions/date",
            self.object_store_source._get_sample_file_prefix(
                metadata_entry=input_metadata
            ),
        )

    def test_get_sample_file_prefix_for_unstructured_metadata(self):
        input_metadata = MetadataEntry(dataPath="transactions")
        self.assertIsNone(
            self.object_store_source._get_sample_file_prefix(
                metadata_entry=input_metadata
            )
        )

    def test_get_sample_file_prefix_for_structured_and_not_partitioned_metadata(self):
        input_metadata = MetadataEntry(
            dataPath="transactions",
            structureFormat="csv",
            isPartitioned=False,
        )
        self.assertEquals(
            "transactions",
            self.object_store_source._get_sample_file_prefix(
                metadata_entry=input_metadata
            ),
        )

    def test_get_sample_file_path_with_invalid_prefix(self):
        self.object_store_source._get_sample_file_prefix = (
            lambda metadata_entry: "/transactions"
        )
        self.assertIsNone(
            self.object_store_source._get_sample_file_path(
                bucket_name="test_bucket",
                metadata_entry=MetadataEntry(
                    dataPath="invalid_path",
                    structureFormat="csv",
                    isPartitioned=False,
                ),
            )
        )

    def test_get_sample_file_path_randomly(self):
        self.object_store_source._get_sample_file_prefix = (
            lambda metadata_entry: "/transactions"
        )
        self.object_store_source.prefix_exits = lambda bucket_name, prefix: True
        self.object_store_source.s3_client.list_objects_v2 = (
            lambda Bucket, Prefix: MOCK_S3_OBJECT_FILE_PATHS
        )

        candidate = self.object_store_source._get_sample_file_path(
            bucket_name="test_bucket",
            metadata_entry=MetadataEntry(
                dataPath="/transactions",
                structureFormat="csv",
                isPartitioned=False,
            ),
        )
        self.assertTrue(
            candidate
            in ["transactions/transactions_1.csv", "transactions/transactions_2.csv"]
        )

    @staticmethod
    def _compute_mocked_metadata_file_response():
        body_encoded = json.dumps(MOCK_S3_METADATA_FILE_RESPONSE).encode()
        body = StreamingBody(io.BytesIO(body_encoded), len(body_encoded))
        return {"Body": body}
