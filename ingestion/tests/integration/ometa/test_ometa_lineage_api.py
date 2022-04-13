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
OpenMetadata high-level API Lineage test
"""
from unittest import TestCase

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceRequest,
)
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaLineageTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataConnection(hostPort="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    db_service = CreateDatabaseServiceRequest(
        name="test-service-db-lineage",
        serviceType=DatabaseServiceType.MySQL,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="username",
                password="password",
                hostPort="http://localhost:1234",
            )
        ),
    )

    pipeline_service = CreatePipelineServiceRequest(
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

        create_db = CreateDatabaseRequest(
            name="test-db",
            service=EntityReference(
                id=cls.db_service_entity.id, type="databaseService"
            ),
        )

        create_db_entity = cls.metadata.create_or_update(data=create_db)

        db_reference = EntityReference(
            id=create_db_entity.id, name="test-db", type="database"
        )

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema", database=db_reference
        )

        create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        schema_reference = EntityReference(
            id=create_schema_entity.id, name="test-schema", type="databaseSchema"
        )

        cls.table = CreateTableRequest(
            name="test",
            databaseSchema=schema_reference,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.table_entity = cls.metadata.create_or_update(data=cls.table)

        cls.pipeline = CreatePipelineRequest(
            name="test",
            service=EntityReference(
                id=cls.pipeline_service_entity.id, type="pipelineService"
            ),
        )

        cls.pipeline_entity = cls.metadata.create_or_update(data=cls.pipeline)

        cls.create = AddLineageRequest(
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

        db_service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqdn="test-service-db-lineage"
            ).id.__root__
        )

        pipeline_service_id = str(
            cls.metadata.get_by_name(
                entity=PipelineService, fqdn="test-service-pipeline-lineage"
            ).id.__root__
        )

        cls.metadata.delete(
            entity=PipelineService,
            entity_id=pipeline_service_id,
            recursive=True,
            hard_delete=True,
        )
        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=db_service_id,
            recursive=True,
            hard_delete=True,
        )

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
