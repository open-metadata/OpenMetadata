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
"""deltalake storage integration tests"""
import sys

import deltalake
import pandas as pd
import pytest
from pydantic import AnyUrl

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.database.deltalake.storageConfig import (
    StorageConfig,
)
from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Sink,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.workflow.metadata import MetadataWorkflow

SERVICE_NAME = "docker_test_delta_storage"

TABLE_NAME = "TABLE"
WRONG_TABLE_NAME = "WRONG_TABLE"


@pytest.fixture(scope="module")
def create_data(deltalake_storage_environment):
    bucket = deltalake_storage_environment.bucket_name
    prefix = deltalake_storage_environment.prefix
    storage_options = deltalake_storage_environment.storage_options

    data = {"COL0": ["A", "A"], "COL1": [1, 2], "COL2": [3, 4]}

    df = pd.DataFrame(data=data)

    deltalake.write_deltalake(
        f"s3://{bucket}/{prefix}/{TABLE_NAME}/",
        data=df,
        partition_by="COL0",
        description="description",
        storage_options=storage_options,
    )

    deltalake.write_deltalake(
        f"s3://{bucket}/WRONG_PREFIX/{WRONG_TABLE_NAME}/",
        data=df,
        storage_options=storage_options,
    )


@pytest.fixture(scope="module")
def service(metadata, deltalake_storage_environment):
    bucket = deltalake_storage_environment.bucket_name
    prefix = deltalake_storage_environment.prefix

    access_key = deltalake_storage_environment.storage_options["AWS_ACCESS_KEY_ID"]
    secret_key = deltalake_storage_environment.storage_options["AWS_SECRET_ACCESS_KEY"]
    region = deltalake_storage_environment.storage_options["AWS_REGION"]
    endpoint = deltalake_storage_environment.storage_options["AWS_ENDPOINT_URL"]

    service = CreateDatabaseServiceRequest(
        name=SERVICE_NAME,
        serviceType=DatabaseServiceType.DeltaLake,
        connection=DatabaseConnection(
            config=DeltaLakeConnection(
                type="DeltaLake",
                configSource=StorageConfig(
                    connection=S3Config(
                        securityConfig=AWSCredentials(
                            awsAccessKeyId=access_key,
                            awsSecretAccessKey=secret_key,
                            awsRegion=region,
                            endPointURL=AnyUrl(endpoint),
                        )
                    ),
                    bucketName=bucket,
                    prefix=prefix,
                ),
            )
        ),
    )

    service_entity = metadata.create_or_update(data=service)
    service_entity.connection.config.configSource.connection.securityConfig.awsSecretAccessKey = CustomSecretStr(
        "password"
    )
    yield service_entity
    metadata.delete(
        DatabaseService, service_entity.id, recursive=True, hard_delete=True
    )


@pytest.fixture(scope="module")
def ingest(metadata, service, create_data):
    workflow_config = OpenMetadataWorkflowConfig(
        source=Source(
            type=service.connection.config.type.value.lower(),
            serviceName=service.fullyQualifiedName.root,
            serviceConnection=service.connection,
            sourceConfig=SourceConfig(config=DatabaseServiceMetadataPipeline()),
        ),
        sink=Sink(type="metadata-rest", config={}),
        workflowConfig=WorkflowConfig(openMetadataServerConfig=metadata.config),
    )

    ingestion = MetadataWorkflow.create(workflow_config)
    ingestion.execute()
    ingestion.raise_from_status()
    return


@pytest.mark.skipif(
    sys.version_info < (3, 9),
    reason="testcontainers exposed port not working correctly on Python3.8. receiving a MagicMock.",
)
def test_delta(ingest, metadata):
    tables = metadata.list_all_entities(entity=Table)

    filtered_tables = [table for table in tables if table.service.name == SERVICE_NAME]

    assert len(filtered_tables) == 1

    table = filtered_tables[0]

    assert table.name.root == TABLE_NAME
    assert table.description.root == "description"
    assert table.tablePartition.columns[0].columnName == "COL0"
