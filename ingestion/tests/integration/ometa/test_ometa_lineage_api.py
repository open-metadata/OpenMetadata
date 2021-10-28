"""
OpenMetadata high-level API Lineage test
"""
from unittest import TestCase

from metadata.generated.schema.api.data.createDatabase import (
    CreateDatabaseEntityRequest,
)
from metadata.generated.schema.api.data.createPipeline import (
    CreatePipelineEntityRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceEntityRequest,
)
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceEntityRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.jdbcConnection import JdbcInfo
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig


class OMetaLineageTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = MetadataServerConfig(api_endpoint="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    db_service = CreateDatabaseServiceEntityRequest(
        name="test-service-db-lineage",
        serviceType=DatabaseServiceType.MySQL,
        jdbc=JdbcInfo(driverClass="jdbc", connectionUrl="jdbc://localhost"),
    )

    pipeline_service = CreatePipelineServiceEntityRequest(
        name="test-service-pipeline-lineage",
        serviceType=PipelineServiceType.Airflow,
        pipelineUrl="https://localhost:1000",
    )

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        cls.db_service_entity = cls.metadata.create_or_update(data=cls.db_service)
        cls.pipeline_service_entity = cls.metadata.create_or_update(
            data=cls.pipeline_service
        )

        cls.create_db = CreateDatabaseEntityRequest(
            name="test-db",
            service=EntityReference(
                id=cls.db_service_entity.id, type="databaseService"
            ),
        )

        cls.create_db_entity = cls.metadata.create_or_update(data=cls.create_db)

        cls.table = CreateTableEntityRequest(
            name="test",
            database=cls.create_db_entity.id,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.table_entity = cls.metadata.create_or_update(data=cls.table)

        cls.pipeline = CreatePipelineEntityRequest(
            name="test",
            service=EntityReference(
                id=cls.pipeline_service_entity.id, type="pipelineService"
            ),
        )

        cls.pipeline_entity = cls.metadata.create_or_update(data=cls.pipeline)

        cls.create = AddLineage(
            description="test lineage",
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=cls.table_entity.id, type="table"),
                toEntity=EntityReference(id=cls.pipeline_entity.id, type="pipeline"),
            ),
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        table_id = str(
            cls.metadata.get_by_name(
                entity=Table, fqdn="test-service-db-lineage.test-db.test"
            ).id.__root__
        )

        database_id = str(
            cls.metadata.get_by_name(
                entity=Database, fqdn="test-service-db-lineage.test-db"
            ).id.__root__
        )

        db_service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqdn="test-service-db-lineage"
            ).id.__root__
        )

        cls.metadata.delete(entity=Table, entity_id=table_id)
        cls.metadata.delete(entity=Database, entity_id=database_id)
        cls.metadata.delete(entity=DatabaseService, entity_id=db_service_id)

        pipeline_id = str(
            cls.metadata.get_by_name(
                entity=Pipeline, fqdn="test-service-pipeline-lineage.test"
            ).id.__root__
        )

        pipeline_service_id = str(
            cls.metadata.get_by_name(
                entity=PipelineService, fqdn="test-service-pipeline-lineage"
            ).id.__root__
        )

        cls.metadata.delete(entity=Pipeline, entity_id=pipeline_id)
        cls.metadata.delete(entity=PipelineService, entity_id=pipeline_service_id)

    def test_create(self):
        """
        We can create a Lineage and get the origin node lineage info back
        """

        from_id = str(self.table_entity.id.__root__)
        to_id = str(self.pipeline_entity.id.__root__)

        res = self.metadata.add_lineage(data=self.create)

        # Check that we get the origin ID in the entity
        assert res["entity"]["id"] == from_id

        # Check that the toEntity is a node in the origin lineage
        node_id = next(
            iter([node["id"] for node in res["nodes"] if node["id"] == to_id]), None
        )
        assert node_id
