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
Test Datalake Profiler workflow

To run this we need OpenMetadata server up and running.

No sample data is required beforehand
"""

import os
from copy import deepcopy
from unittest import TestCase

import boto3
import botocore
from moto import mock_s3

from metadata.generated.schema.entity.data.table import ColumnProfile
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.api.workflow import ProfilerWorkflow
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)

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
class DatalakeProfilerTestE2E(TestCase):
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

        # check that we are not running our test againsta real bucket
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

        # Ingest our S3 data
        ingestion_workflow = Workflow.create(INGESTION_CONFIG)
        ingestion_workflow.execute()
        ingestion_workflow.raise_from_status()
        ingestion_workflow.print_status()
        ingestion_workflow.stop()

    def test_datalake_profiler_workflow(self):
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

        table_profile = self.metadata.get_profile_data(
            'datalake_for_integration_tests.default.MyBucket."profiler_test_.csv"',
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
        )

        column_profile = self.metadata.get_profile_data(
            'datalake_for_integration_tests.default.MyBucket."profiler_test_.csv".first_name',
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
            profile_type=ColumnProfile,
        )

        assert table_profile.entities
        assert column_profile.entities

    def tearDown(self):
        s3 = boto3.resource(
            "s3",
            region_name="us-weat-1",
        )
        bucket = s3.Bucket(BUCKET_NAME)
        for key in bucket.objects.all():
            key.delete()
        bucket.delete()

        service_id = str(
            self.metadata.get_by_name(
                entity=DatabaseService, fqn="datalake_for_integration_tests"
            ).id.__root__
        )

        self.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )
