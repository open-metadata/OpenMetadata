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

import os
from copy import deepcopy

import pytest

from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    ProfileSampleType,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.sampler.models import PartitionProfilerConfig
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow

from ..containers import MinioContainerConfigs, get_minio_container

BUCKET_NAME = "my-bucket"

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
        "type": "testsuite",
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
                "entityFullyQualifiedName": f'datalake_for_integration_tests.default.{BUCKET_NAME}."users/users.csv"',
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
                    "computePassedFailedRowCount": True,
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
                # Helps us ensure that the passedRows and failedRows are proper ints, even when coming from Pandas
                {
                    "name": "first_name_is_unique",
                    "testDefinitionName": "columnValuesToBeUnique",
                    "columnName": "first_name",
                    "computePassedFailedRowCount": True,
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
    # Helps us validate we are properly encoding the names of Ingestion Pipelines when sending status updates
    "ingestionPipelineFQN": f'datalake_for_integration_tests.default.{BUCKET_NAME}."users/users.csv".testSuite.uuid',
}


@pytest.fixture(scope="session")
def ingestion_fqn():
    return f'datalake_for_integration_tests.default.{BUCKET_NAME}."users/users.csv".testSuite.uuid'


@pytest.fixture(scope="session")
def minio_container():
    with get_minio_container(MinioContainerConfigs()) as container:
        yield container


@pytest.fixture(scope="class", autouse=True)
def setup_s3(minio_container) -> None:
    # Mock our S3 bucket and ingest a file
    client = minio_container.get_client()
    if client.bucket_exists(BUCKET_NAME):
        return
    client.make_bucket(BUCKET_NAME)
    current_dir = os.path.dirname(__file__)
    resources_dir = os.path.join(current_dir, "resources")

    resources_paths = [
        os.path.join(path, filename)
        for path, _, files in os.walk(resources_dir)
        for filename in files
    ]
    for path in resources_paths:
        key = os.path.relpath(path, resources_dir)
        client.fput_object(BUCKET_NAME, key, path)
    return


@pytest.fixture(scope="class")
def ingestion_config(minio_container):
    ingestion_config = deepcopy(INGESTION_CONFIG)
    ingestion_config["source"]["serviceConnection"]["config"]["configSource"].update(
        {
            "securityConfig": {
                "awsAccessKeyId": minio_container.access_key,
                "awsSecretAccessKey": minio_container.secret_key,
                "awsRegion": "us-west-1",
                "endPointURL": f"http://localhost:{minio_container.get_exposed_port(minio_container.port)}",
            }
        }
    )
    return ingestion_config


@pytest.fixture(scope="class")
def run_ingestion(metadata, ingestion_config):
    ingestion_workflow = MetadataWorkflow.create(ingestion_config)
    ingestion_workflow.execute()
    ingestion_workflow.raise_from_status()
    ingestion_workflow.stop()
    yield
    db_service = metadata.get_by_name(
        entity=DatabaseService, fqn="datalake_for_integration_tests"
    )
    metadata.delete(DatabaseService, db_service.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="class")
def run_test_suite_workflow(run_ingestion, ingestion_config):
    workflow_config = deepcopy(DATA_QUALITY_CONFIG)
    workflow_config["source"]["sourceConfig"]["config"]["serviceConnections"] = [
        {
            "serviceName": ingestion_config["source"]["serviceName"],
            "serviceConnection": ingestion_config["source"]["serviceConnection"],
        }
    ]
    ingestion_workflow = TestSuiteWorkflow.create(workflow_config)
    ingestion_workflow.execute()
    ingestion_workflow.raise_from_status()
    ingestion_workflow.stop()


@pytest.fixture(scope="class")
def run_sampled_test_suite_workflow(metadata, run_ingestion, ingestion_config):
    metadata.create_or_update_table_profiler_config(
        fqn='datalake_for_integration_tests.default.my-bucket."users/users.csv"',
        table_profiler_config=TableProfilerConfig(
            profileSampleType=ProfileSampleType.PERCENTAGE,
            profileSample=50.0,
            partitioning=None,
        ),
    )
    workflow_config = deepcopy(DATA_QUALITY_CONFIG)
    workflow_config["source"]["sourceConfig"]["config"]["serviceConnections"] = [
        {
            "serviceName": ingestion_config["source"]["serviceName"],
            "serviceConnection": ingestion_config["source"]["serviceConnection"],
        }
    ]
    ingestion_workflow = TestSuiteWorkflow.create(workflow_config)
    ingestion_workflow.execute()
    ingestion_workflow.raise_from_status()
    ingestion_workflow.stop()
    metadata.create_or_update_table_profiler_config(
        fqn='datalake_for_integration_tests.default.my-bucket."users/users.csv"',
        table_profiler_config=TableProfilerConfig(
            profileSampleType=ProfileSampleType.PERCENTAGE,
            profileSample=100.0,
        ),
    )


@pytest.fixture(scope="class")
def run_partitioned_test_suite_workflow(metadata, run_ingestion, ingestion_config):
    metadata.create_or_update_table_profiler_config(
        fqn='datalake_for_integration_tests.default.my-bucket."users/users.csv"',
        table_profiler_config=TableProfilerConfig(
            partitioning=PartitionProfilerConfig(
                enablePartitioning=True,
                partitionIntervalType=PartitionIntervalTypes.COLUMN_VALUE,
                partitionValues=["Los Angeles"],
                partitionColumnName="city",
            )
        ),
    )
    workflow_config = deepcopy(DATA_QUALITY_CONFIG)
    workflow_config["source"]["sourceConfig"]["config"]["serviceConnections"] = [
        {
            "serviceName": ingestion_config["source"]["serviceName"],
            "serviceConnection": ingestion_config["source"]["serviceConnection"],
        }
    ]
    ingestion_workflow = TestSuiteWorkflow.create(workflow_config)
    ingestion_workflow.execute()
    ingestion_workflow.raise_from_status()
    ingestion_workflow.stop()
    metadata.create_or_update_table_profiler_config(
        fqn='datalake_for_integration_tests.default.my-bucket."users/users.csv"',
        table_profiler_config=TableProfilerConfig(partitioning=None),
    )


@pytest.fixture(scope="class")
def profiler_workflow_config(ingestion_config, workflow_config):
    ingestion_config["source"]["sourceConfig"]["config"].update(
        {
            "type": "Profiler",
        }
    )
    ingestion_config["processor"] = {
        "type": "orm-profiler",
        "config": {},
    }
    ingestion_config["workflowConfig"] = workflow_config
    return ingestion_config


@pytest.fixture(scope="class")
def auto_classification_workflow_config(ingestion_config, workflow_config):
    ingestion_config["source"]["sourceConfig"]["config"].update(
        {
            "type": "AutoClassification",
            "storeSampleData": True,
            "enableAutoClassification": False,
        }
    )
    ingestion_config["processor"] = {
        "type": "orm-profiler",
        "config": {},
    }
    ingestion_config["workflowConfig"] = workflow_config
    return ingestion_config


@pytest.fixture()
def run_profiler(run_ingestion, run_workflow, profiler_workflow_config):
    """Test profiler ingestion"""
    run_workflow(ProfilerWorkflow, profiler_workflow_config)


@pytest.fixture()
def run_auto_classification(
    run_ingestion, run_workflow, auto_classification_workflow_config
):
    """Test profiler ingestion"""
    run_workflow(AutoClassificationWorkflow, auto_classification_workflow_config)
