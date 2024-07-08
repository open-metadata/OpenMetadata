#  Copyright 2024 Collate
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
Unit tests for GCS Object store source
"""
import datetime
import uuid
from collections import namedtuple
from typing import List
from unittest import TestCase
from unittest.mock import patch

import pandas as pd

from metadata.generated.schema.entity.data.container import (
    ContainerDataModel,
    FileFormat,
)
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
    MetadataEntry,
    StorageContainerConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import SourceUrl
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.source.storage.gcs.metadata import (
    GCSBucketResponse,
    GCSContainerDetails,
    GCSSource,
)
from metadata.ingestion.source.storage.storage_service import (
    OPENMETADATA_TEMPLATE_FILE_NAME,
)
from metadata.readers.file.base import ReadException
from metadata.readers.file.config_source_factory import get_reader

MockBucketResponse = namedtuple("MockBucketResponse", ["name", "time_created"])
MockObjectFilePath = namedtuple("MockObjectFilePath", ["name"])

MOCK_OBJECT_STORE_CONFIG = {
    "source": {
        "type": "gcs",
        "serviceName": "gcs_test",
        "serviceConnection": {
            "config": {
                "type": "GCS",
                "credentials": {"gcpConfig": "/tmp/credentials.json"},
            }
        },
        "sourceConfig": {
            "config": {
                "type": "StorageMetadata",
                "containerFilterPattern": {"includes": ["^test_*"]},
                "storageMetadataConfigSource": {
                    "securityConfig": {"gcpConfig": "/tmp/credentials.json"},
                    "prefixConfig": {
                        "containerName": "test_bucket",
                        "objectPrefix": "manifest",
                    },
                },
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
MOCK_BUCKETS_RESPONSE = [
    MockBucketResponse(
        name="test_transactions", time_created=datetime.datetime(2000, 1, 1)
    ),
    MockBucketResponse(name="test_sales", time_created=datetime.datetime(2000, 2, 2)),
    MockBucketResponse(name="events", time_created=datetime.datetime(2000, 3, 3)),
]

MOCK_METADATA_FILE_RESPONSE = {
    "entries": [
        {
            "dataPath": "transactions",
            "structureFormat": "csv",
            "isPartitioned": False,
        }
    ]
}
EXPECTED_BUCKETS: List[GCSBucketResponse] = [
    GCSBucketResponse(
        name="test_transactions",
        project_id="test_project",
        creation_date=datetime.datetime(2000, 1, 1),
    ),
    GCSBucketResponse(
        name="test_sales",
        project_id="test_project",
        creation_date=datetime.datetime(2000, 2, 2),
    ),
]
MOCK_OBJECT_FILE_PATHS = [
    MockObjectFilePath(name="transactions/transactions_1.csv"),
    MockObjectFilePath(name="transactions/transactions_2.csv"),
]


def _get_str_value(data):
    if data:
        if isinstance(data, str):
            return data
        return data.value

    return None


def custom_column_compare(self, other):
    return (
        self.name == other.name
        and self.displayName == other.displayName
        and self.description == other.description
        and self.dataTypeDisplay == other.dataTypeDisplay
        and self.children == other.children
        and _get_str_value(self.arrayDataType) == _get_str_value(other.arrayDataType)
    )


class StorageUnitTest(TestCase):
    """
    Validate how we work with object store metadata
    """

    @patch(
        "metadata.ingestion.source.storage.storage_service.StorageServiceSource.test_connection"
    )
    def __init__(self, method_name: str, test_connection) -> None:
        super().__init__(method_name)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(MOCK_OBJECT_STORE_CONFIG)

        # This already validates that the source can be initialized
        self.object_store_source = GCSSource.create(
            MOCK_OBJECT_STORE_CONFIG["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.gcs_reader = get_reader(
            config_source=GCSConfig(),
            client=self.object_store_source.gcs_clients.storage_client.clients[0],
        )

    def test_create_from_invalid_source(self):
        """
        An invalid config raises an error
        """
        not_object_store_source = {
            "type": "gcs",
            "serviceName": "mysql_local",
            "serviceConnection": {
                "config": {
                    "type": "Mysql",
                    "username": "openmetadata_user",
                    "authType": {"password": "openmetadata_password"},
                    "hostPort": "localhost:3306",
                    "databaseSchema": "openmetadata_db",
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "StorageMetadata",
                    "storageMetadataConfigSource": {
                        "securityConfig": {"gcpConfig": "/tmp/credentials.json"},
                        "prefixConfig": {
                            "containerName": "test_bucket",
                            "objectPrefix": "manifest",
                        },
                    },
                }
            },
        }
        self.assertRaises(
            InvalidSourceException,
            GCSSource.create,
            not_object_store_source,
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_gcs_buckets_fetching(self):
        self.object_store_source.storage_client.clients[
            0
        ].list_buckets = lambda: MOCK_BUCKETS_RESPONSE
        self.assertListEqual(self.object_store_source.fetch_buckets(), EXPECTED_BUCKETS)

    def test_load_metadata_file_gcs(self):
        metadata_entry: List[MetadataEntry] = self.return_metadata_entry()

        self.assertEqual(1, len(metadata_entry))
        self.assertEqual(
            MetadataEntry(
                dataPath="transactions",
                structureFormat="csv",
                isPartitioned=False,
            ),
            metadata_entry[0],
        )

    def test_no_metadata_file_returned_when_file_not_present(self):
        with self.assertRaises(ReadException):
            self.gcs_reader.read(
                path=OPENMETADATA_TEMPLATE_FILE_NAME,
                bucket_name="test",
                verbose=False,
            )

    def test_generate_unstructured_container(self):
        bucket_response = GCSBucketResponse(
            name="test_bucket",
            project_id="test_project",
            creation_date=datetime.datetime(2000, 1, 1),
        )
        self.object_store_source._fetch_metric = lambda bucket_name, metric: 100.0
        self.assertEqual(
            GCSContainerDetails(
                name=bucket_response.name,
                prefix="/",
                number_of_objects=100,
                size=100,
                file_formats=[],
                data_model=None,
                creation_date=bucket_response.creation_date.isoformat(),
                sourceUrl=SourceUrl(
                    __root__="https://console.cloud.google.com/storage/browser/test_bucket;tab=objects?project=test_project"
                ),
                fullPath="gs://test_bucket",
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
                displayName="transaction_id",
            ),
            Column(
                name=ColumnName(__root__="transaction_value"),
                dataType=DataType.INT,
                dataTypeDisplay="INT",
                displayName="transaction_value",
            ),
        ]
        self.object_store_source.extract_column_definitions = (
            lambda bucket_name, sample_key, config_source, client, metadata_entry: columns
        )

        entity_ref = EntityReference(id=uuid.uuid4(), type="container")

        self.assertEqual(
            GCSContainerDetails(
                name="transactions",
                prefix="/transactions",
                number_of_objects=100,
                size=100,
                file_formats=[FileFormat.csv],
                data_model=ContainerDataModel(isPartitioned=False, columns=columns),
                creation_date=datetime.datetime(2000, 1, 1).isoformat(),
                parent=entity_ref,
                sourceUrl=SourceUrl(
                    __root__=f"https://console.cloud.google.com/storage/browser/_details/test_bucket/transactions;tab=live_object?project=test_project"
                ),
                fullPath="gs://test_bucket/transactions",
            ),
            self.object_store_source._generate_container_details(
                GCSBucketResponse(
                    name="test_bucket",
                    project_id="test_project",
                    creation_date=datetime.datetime(2000, 1, 1),
                ),
                MetadataEntry(
                    dataPath="transactions",
                    structureFormat="csv",
                    isPartitioned=False,
                ),
                parent=entity_ref,
            ),
        )

    #  Most of the parsing support are covered in test_datalake unit tests related to the Data lake implementation
    def test_extract_column_definitions(self):
        with patch(
            "metadata.ingestion.source.storage.storage_service.fetch_dataframe",
            return_value=(
                [
                    pd.DataFrame.from_dict(
                        [
                            {"transaction_id": 1, "transaction_value": 100},
                            {"transaction_id": 2, "transaction_value": 200},
                            {"transaction_id": 3, "transaction_value": 300},
                        ]
                    )
                ],
                None,
            ),
        ):
            Column.__eq__ = custom_column_compare
            self.assertListEqual(
                [
                    Column(
                        name=ColumnName(__root__="transaction_id"),
                        dataType=DataType.INT,
                        dataTypeDisplay="INT",
                        displayName="transaction_id",
                    ),
                    Column(
                        name=ColumnName(__root__="transaction_value"),
                        dataType=DataType.INT,
                        dataTypeDisplay="INT",
                        displayName="transaction_value",
                    ),
                ],
                self.object_store_source.extract_column_definitions(
                    bucket_name="test_bucket",
                    sample_key="test.json",
                    config_source=None,
                    client=None,
                    metadata_entry=self.return_metadata_entry()[0],
                ),
            )

    def test_get_sample_file_prefix_for_structured_and_partitioned_metadata(self):
        input_metadata = MetadataEntry(
            dataPath="transactions",
            structureFormat="parquet",
            isPartitioned=True,
            partitionColumns=[Column(name="date", dataType=DataType.DATE)],
        )
        self.assertEqual(
            "transactions/",
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
        self.assertEqual(
            "transactions/",
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
        self.object_store_source.gcs_clients.storage_client.cliens[
            0
        ].list_blobs = lambda bucket, prefix, max_results: MOCK_OBJECT_FILE_PATHS

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
            in [
                "transactions/transactions_1.csv",
                "transactions/transactions_2.csv",
                "transactions/",
            ]
        )

    def return_metadata_entry(self):
        container_config = StorageContainerConfig.parse_obj(MOCK_METADATA_FILE_RESPONSE)
        return container_config.entries
