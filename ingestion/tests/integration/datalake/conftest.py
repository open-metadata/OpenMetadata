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

import os
from copy import deepcopy

import boto3
import pytest
from moto import mock_aws

from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow

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


DATA_QUALITY_CONFIG = {
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
        "sourceConfig": {
            "config": {
                "type": "TestSuite",
                "entityFullyQualifiedName": 'datalake_for_integration_tests.default.MyBucket."users.csv"',
            }
        },
    },
    "processor": {
        "type": "orm-test-runner",
        "config": {
            "testCases": [
                {
                    "name": "first_name_includes_john",
                    "testDefinitionName": "columnValuesToBeInSet",
                    "columnName": "first_name",
                    "parameterValues": [
                        {
                            "name": "allowedValues",
                            "value": "['John']",
                        }
                    ],
                },
                {
                    "name": "first_name_is_john",
                    "testDefinitionName": "columnValuesToBeInSet",
                    "columnName": "first_name",
                    "parameterValues": [
                        {
                            "name": "allowedValues",
                            "value": "['John']",
                        },
                        {
                            "name": "matchEnum",
                            "value": "True",
                        },
                    ],
                },
            ]
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        },
    },
}


@pytest.fixture(scope="module", autouse=True)
def aws():
    with mock_aws():
        yield boto3.client("s3", region_name="us-east-1")


@pytest.fixture(scope="class", autouse=True)
def setup_s3(request) -> None:
    # Mock our S3 bucket and ingest a file
    boto3.DEFAULT_SESSION = None
    request.cls.s3_client = boto3.client(
        "s3",
        region_name="us-west-1",
    )
    s3 = boto3.resource(
        "s3",
        region_name="us-west-1",
        aws_access_key_id="fake_access_key",
        aws_secret_access_key="fake_secret_key",
    )
    request.cls.s3_client.create_bucket(
        Bucket=BUCKET_NAME,
        CreateBucketConfiguration={"LocationConstraint": "us-west-1"},
    )
    s3.meta.client.head_bucket(Bucket=BUCKET_NAME)
    current_dir = os.path.dirname(__file__)
    resources_dir = os.path.join(current_dir, "resources")

    resources_paths = [
        os.path.join(path, filename)
        for path, _, files in os.walk(resources_dir)
        for filename in files
    ]

    request.cls.s3_keys = []

    for path in resources_paths:
        key = os.path.relpath(path, resources_dir)
        request.cls.s3_keys.append(key)
        request.cls.s3_client.upload_file(Filename=path, Bucket=BUCKET_NAME, Key=key)
    yield
    bucket = s3.Bucket(BUCKET_NAME)
    for key in bucket.objects.all():
        key.delete()
    bucket.delete()


@pytest.fixture(scope="class")
def run_ingestion(metadata):
    ingestion_workflow = MetadataWorkflow.create(INGESTION_CONFIG)
    ingestion_workflow.execute()
    ingestion_workflow.raise_from_status()
    ingestion_workflow.stop()
    yield
    db_service = metadata.get_by_name(
        entity=DatabaseService, fqn="datalake_for_integration_tests"
    )
    metadata.delete(DatabaseService, db_service.id, recursive=True, hard_delete=True)


@pytest.fixture
def run_test_suite_workflow(run_ingestion):
    ingestion_workflow = TestSuiteWorkflow.create(DATA_QUALITY_CONFIG)
    ingestion_workflow.execute()
    ingestion_workflow.raise_from_status()
    ingestion_workflow.stop()


@pytest.fixture()
def run_profiler(run_ingestion):
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
    profiler_workflow.raise_from_status()
    profiler_workflow.stop()
