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
"""Delta tables with the same name under different prefixes - issue #24840.

Two Delta tables stored at `<bucket>/<prefix>/a/deltatable-name` and
`<bucket>/<prefix>/b/deltatable-name` are physically distinct, but both are named after their
folder, so both resolve to the same OpenMetadata FQN. The ingestion used to report success while
only one of them survived; it must now fail and ingest neither.
"""

import deltalake
import pandas as pd
import pytest
from pydantic import AnyUrl

from metadata.config.common import WorkflowExecutionError
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

from ....integration_base import generate_name  # noqa: TID252

DUPLICATE_PREFIX = "duplicates"
DUPLICATE_TABLE_NAME = "deltatable-name"
# Distinguishable payloads, so we can tell which physical table an entity came from
TABLES = {
    f"{DUPLICATE_PREFIX}/a/{DUPLICATE_TABLE_NAME}": pd.DataFrame({"COL_FROM_A": ["a"]}),
    f"{DUPLICATE_PREFIX}/b/{DUPLICATE_TABLE_NAME}": pd.DataFrame({"COL_FROM_B": ["b"]}),
    f"{DUPLICATE_PREFIX}/a/table_a": pd.DataFrame({"X": [1]}),
    f"{DUPLICATE_PREFIX}/b/table_b": pd.DataFrame({"Y": [2]}),
}


@pytest.fixture(scope="module")
def create_duplicate_data(deltalake_storage_environment):
    bucket = deltalake_storage_environment.bucket_name
    storage_options = deltalake_storage_environment.storage_options

    for path, df in TABLES.items():
        deltalake.write_deltalake(
            f"s3://{bucket}/{path}/",
            data=df,
            description=f"delta table at {path}",
            storage_options=storage_options,
        )


def _create_service(metadata, deltalake_storage_environment, prefix: str):
    storage_options = deltalake_storage_environment.storage_options
    secret_key = storage_options["AWS_SECRET_ACCESS_KEY"]

    service = CreateDatabaseServiceRequest(
        name=generate_name(),
        serviceType=DatabaseServiceType.DeltaLake,
        connection=DatabaseConnection(
            config=DeltaLakeConnection(
                type="DeltaLake",
                configSource=StorageConfig(
                    connection=S3Config(
                        securityConfig=AWSCredentials(
                            awsAccessKeyId=storage_options["AWS_ACCESS_KEY_ID"],
                            awsSecretAccessKey=secret_key,
                            awsRegion=storage_options["AWS_REGION"],
                            endPointURL=AnyUrl(storage_options["AWS_ENDPOINT_URL"]),
                        )
                    ),
                    bucketName=deltalake_storage_environment.bucket_name,
                    prefix=prefix,
                ),
            )
        ),
    )

    service_entity = metadata.create_or_update(data=service)
    service_entity.connection.config.configSource.connection.securityConfig.awsSecretAccessKey = CustomSecretStr(
        secret_key
    )
    return service_entity


def _run_ingestion(metadata, service) -> MetadataWorkflow:
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
    return ingestion


@pytest.fixture(scope="module")
def duplicate_service(metadata, deltalake_storage_environment, create_duplicate_data):
    """A service scoped at the prefix that holds both copies of `deltatable-name`."""
    service_entity = _create_service(metadata, deltalake_storage_environment, DUPLICATE_PREFIX)
    yield service_entity
    metadata.delete(DatabaseService, service_entity.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def single_prefix_service(metadata, deltalake_storage_environment, create_duplicate_data):
    """A service scoped at a single prefix, where every table name is unique."""
    service_entity = _create_service(metadata, deltalake_storage_environment, f"{DUPLICATE_PREFIX}/a")
    yield service_entity
    metadata.delete(DatabaseService, service_entity.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def duplicate_ingestion(metadata, duplicate_service):
    return _run_ingestion(metadata, duplicate_service)


def test_duplicate_delta_tables_fail_the_ingestion(duplicate_ingestion):
    with pytest.raises(WorkflowExecutionError):
        duplicate_ingestion.raise_from_status()


def test_duplicate_failure_identifies_the_conflicting_tables(duplicate_ingestion, duplicate_service):
    failures = duplicate_ingestion.source.get_status().failures

    assert len(failures) == 1, f"Expected a single duplicate failure, got {failures}"
    error = failures[0].error
    assert f"Found 2 Delta tables named '{DUPLICATE_TABLE_NAME}'" in error
    assert f"{DUPLICATE_PREFIX}/a/{DUPLICATE_TABLE_NAME}/" in error
    assert f"{DUPLICATE_PREFIX}/b/{DUPLICATE_TABLE_NAME}/" in error
    assert duplicate_service.name.root in error


def test_neither_duplicate_is_ingested(duplicate_ingestion, metadata, duplicate_service, deltalake_storage_environment):
    bucket_name = deltalake_storage_environment.bucket_name
    fqn = f"{duplicate_service.name.root}.default.{bucket_name}.{DUPLICATE_TABLE_NAME}"

    assert metadata.get_by_name(entity=Table, fqn=fqn) is None, (
        "A duplicated Delta table was ingested; one of the two physical tables would be silently lost"
    )


def test_tables_with_unique_names_still_ingest(
    duplicate_ingestion, metadata, duplicate_service, deltalake_storage_environment
):
    bucket_name = deltalake_storage_environment.bucket_name

    for table_name, column_name in (("table_a", "X"), ("table_b", "Y")):
        fqn = f"{duplicate_service.name.root}.default.{bucket_name}.{table_name}"
        table = metadata.get_by_name(entity=Table, fqn=fqn, fields=["columns"])

        assert table is not None, f"Table not found at FQN: {fqn}"
        assert [column.name.root for column in table.columns] == [column_name]


def test_prefix_scoped_service_ingests_the_table(metadata, single_prefix_service, deltalake_storage_environment):
    """Scoping a service to one prefix is the documented workaround - it must keep working."""
    ingestion = _run_ingestion(metadata, single_prefix_service)
    ingestion.raise_from_status()

    bucket_name = deltalake_storage_environment.bucket_name
    fqn = f"{single_prefix_service.name.root}.default.{bucket_name}.{DUPLICATE_TABLE_NAME}"
    table = metadata.get_by_name(entity=Table, fqn=fqn, fields=["columns"])

    assert table is not None, f"Table not found at FQN: {fqn}"
    assert [column.name.root for column in table.columns] == ["COL_FROM_A"]
