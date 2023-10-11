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

"""Datalake ingestion integration tests"""

from copy import deepcopy
import os
from unittest import TestCase

import boto3
import botocore
from metadata.generated.schema.entity.data.table import DataType, Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import OpenMetadataJWTClientConfig
from metadata.ingestion.ometa.models import EntityList
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow
from moto import mock_s3
import pytest

BUCKET_NAME = "MyBucket"

INGESTION_CONFIG = {
    "source": {
        "type": "datalake",
        "serviceName": "datalake_for_integration_tests",
        "serviceConnection": {
            "config": {
                "type": "Datalake",
                "configSource": {
                    "securityConfig": {
                        "awsAccessKeyId": "fake_access_key",
                        "awsSecretAccessKey": "fake_secret_key",
                        "awsRegion": "us-weat-1",
                    }
                },
                "bucketName": f"{BUCKET_NAME}",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

@mock_s3
class DatalakeTestE2E(TestCase):
    """datalake profiler E2E test"""

    @classmethod
    def setUpClass(cls) -> None:
        server_config = OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(
                jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            ),
        )  # type: ignore
        cls.metadata = OpenMetadata(server_config)

    def setUp(self) -> None:
        # Mock our S3 bucket and ingest a file
        boto3.DEFAULT_SESSION = None
        self.client = boto3.client(
            "s3",
            region_name="us-weat-1",
        )

        # check that we are not running our test against a real bucket
        try:
            s3 = boto3.resource(
                "s3",
                region_name="us-west-1",
                aws_access_key_id="fake_access_key",
                aws_secret_access_key="fake_secret_key",
            )
            s3.meta.client.head_bucket(Bucket=BUCKET_NAME)
        except botocore.exceptions.ClientError:
            pass
        else:
            err = f"{BUCKET_NAME} should not exist."
            raise EnvironmentError(err)
        self.client.create_bucket(
            Bucket=BUCKET_NAME,
            CreateBucketConfiguration={"LocationConstraint": "us-west-1"},
        )
        current_dir = os.path.dirname(__file__)
        resources_dir = os.path.join(current_dir, "resources")

        resources_paths = [
            os.path.join(path, filename)
            for path, _, files in os.walk(resources_dir)
            for filename in files
        ]

        self.s3_keys = []

        for path in resources_paths:
            key = os.path.relpath(path, resources_dir)
            self.s3_keys.append(key)
            self.client.upload_file(Filename=path, Bucket=BUCKET_NAME, Key=key)

    @pytest.mark.order(10000)
    def test_ingestion(self):
        """test ingestion of datalake data"""
        # Ingest our S3 data
        ingestion_workflow = MetadataWorkflow.create(INGESTION_CONFIG)
        ingestion_workflow.execute()
        ingestion_workflow.raise_from_status()
        ingestion_workflow.stop()

        resp: EntityList[Table] = self.metadata.list_entities(
            entity=Table,
            params={
                "database": "datalake_for_integration_tests.default"
            }
        ) # type: ignore

        entities = resp.entities
        self.assertEqual(len(entities), 3)
        names = [entity.name.__root__ for entity in entities]
        self.assertListEqual(sorted(["names.json", "new_users.parquet", "users.csv"]), sorted(names))

        for entity in entities:
            columns = entity.columns
            for column in columns:
                if column.dataType == DataType.JSON:
                    assert column.children

    @pytest.mark.order(10001)
    def test_profiler(self):
        """Test profiler ingestion"""
        workflow_config = deepcopy(INGESTION_CONFIG)
        workflow_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
            }
        )
        workflow_config["processor"] = {
            "type": "orm-profiler",
            "config": {},
        }

        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == 0

        csv_ = self.metadata.get_by_name(
            entity=Table,
            fqn='datalake_for_integration_tests.default.MyBucket."users.csv"',
            fields=["tableProfilerConfig"],
        )
        parquet_ = self.metadata.get_by_name(
            entity=Table,
            fqn='datalake_for_integration_tests.default.MyBucket."new_users.parquet"',
            fields=["tableProfilerConfig"],
        )
        json_ = self.metadata.get_by_name(
            entity=Table,
            fqn='datalake_for_integration_tests.default.MyBucket."names.json"',
            fields=["tableProfilerConfig"],
        )
        csv_sample_data = self.metadata.get_sample_data(csv_)
        parquet_sample_data = self.metadata.get_sample_data(parquet_)
        json_sample_data = self.metadata.get_sample_data(json_)
        
        assert csv_sample_data.sampleData.rows
        assert parquet_sample_data.sampleData.rows
        assert json_sample_data.sampleData.rows