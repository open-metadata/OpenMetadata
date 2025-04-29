import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    AutoClassificationConfigType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
    Sink,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(autouse=True, scope="module")
def ingest_metadata(
    db_service: DatabaseService, metadata: OpenMetadata, ingest_sample_data
):
    workflow_config = OpenMetadataWorkflowConfig(
        source=Source(
            type=db_service.serviceType.name.lower(),
            serviceName=db_service.fullyQualifiedName.root,
            sourceConfig=SourceConfig(config={}),
            serviceConnection=db_service.connection,
        ),
        sink=Sink(
            type="metadata-rest",
            config={},
        ),
        workflowConfig=WorkflowConfig(openMetadataServerConfig=metadata.config),
    )
    metadata_ingestion = MetadataWorkflow.create(workflow_config)
    metadata_ingestion.execute()
    metadata_ingestion.raise_from_status()
    return


@pytest.fixture(scope="module")
def db_fqn(db_service: DatabaseService):
    return ".".join(
        [
            db_service.fullyQualifiedName.root,
            "default",
            "default",
        ]
    )


def test_sample_data(db_service, db_fqn, metadata):
    workflow_config = {
        "source": {
            "type": db_service.serviceType.name.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": AutoClassificationConfigType.AutoClassification.value,
                    "storeSampleData": True,
                    "enableAutoClassification": False,
                },
            },
        },
        "processor": {
            "type": "orm-profiler",
            "config": {},
        },
        "sink": {
            "type": "metadata-rest",
            "config": {},
        },
        "workflowConfig": {
            "loggerLevel": LogLevels.DEBUG,
            "openMetadataServerConfig": metadata.config.model_dump(),
        },
    }
    profiler_workflow = AutoClassificationWorkflow.create(workflow_config)
    profiler_workflow.execute()
    profiler_workflow.raise_from_status()
    table = metadata.list_entities(
        Table,
        fields=["fullyQualifiedName"],
        params={
            "databaseSchema": db_fqn,
        },
    ).entities[0]
    sample_data = metadata.get_sample_data(table).sampleData
    assert sample_data is not None
    assert len(sample_data.columns) == 2
    assert len(sample_data.rows) == 2
    assert sample_data.rows[0][0] == "Alice"
