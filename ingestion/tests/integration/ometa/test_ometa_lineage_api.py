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

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    EntityLineage,
    LineageDetails,
)
from metadata.generated.schema.type.entityReference import EntityReference

from ..integration_base import (
    generate_name,
    get_create_entity,
    get_create_service,
    int_admin_ometa,
)


class OMetaLineageTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    metadata = int_admin_ometa()

    assert metadata.health_check()

    db_service_name = generate_name()
    pipeline_service_name = generate_name()
    dashboard_service_name = generate_name()

    db_service = get_create_service(entity=DatabaseService, name=db_service_name)
    pipeline_service = get_create_service(
        entity=PipelineService, name=pipeline_service_name
    )
    dashboard_service = get_create_service(
        entity=DashboardService, name=dashboard_service_name
    )

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        cls.db_service_entity: DatabaseService = cls.metadata.create_or_update(
            data=cls.db_service
        )
        cls.pipeline_service_entity: PipelineService = cls.metadata.create_or_update(
            data=cls.pipeline_service
        )
        cls.dashboard_service_entity: DashboardService = cls.metadata.create_or_update(
            data=cls.dashboard_service
        )

        create_db_entity: Database = cls.metadata.create_or_update(
            data=get_create_entity(
                entity=Database,
                reference=cls.db_service_entity.fullyQualifiedName,
                name=generate_name(),
            )
        )

        create_schema_entity = cls.metadata.create_or_update(
            data=get_create_entity(
                entity=DatabaseSchema,
                reference=create_db_entity.fullyQualifiedName,
                name=generate_name(),
            )
        )

        cls.table1 = get_create_entity(
            name=generate_name(),
            entity=Table,
            reference=create_schema_entity.fullyQualifiedName,
        )

        cls.table1_entity = cls.metadata.create_or_update(data=cls.table1)
        cls.table2 = get_create_entity(
            name=generate_name(),
            entity=Table,
            reference=create_schema_entity.fullyQualifiedName,
        )

        cls.table2_entity = cls.metadata.create_or_update(data=cls.table2)

        cls.pipeline = get_create_entity(
            name=generate_name(),
            entity=Pipeline,
            reference=cls.pipeline_service_entity.fullyQualifiedName,
        )

        cls.pipeline_entity = cls.metadata.create_or_update(data=cls.pipeline)

        cls.dashboard = get_create_entity(
            name=generate_name(),
            entity=Dashboard,
            reference=cls.dashboard_service_entity.fullyQualifiedName,
        )
        cls.dashboard_entity = cls.metadata.create_or_update(data=cls.dashboard)

        cls.dashboard_datamodel = get_create_entity(
            name=generate_name(),
            entity=DashboardDataModel,
            reference=cls.dashboard_service_entity.fullyQualifiedName,
        )
        cls.dashboard_datamodel_entity = cls.metadata.create_or_update(
            data=cls.dashboard_datamodel
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        db_service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=cls.db_service_name
            ).id.__root__
        )

        pipeline_service_id = str(
            cls.metadata.get_by_name(
                entity=PipelineService, fqn=cls.pipeline_service_name
            ).id.__root__
        )

        dashboard_service_id = str(
            cls.metadata.get_by_name(
                entity=DashboardService, fqn=cls.dashboard_service_name
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
        cls.metadata.delete(
            entity=DashboardService,
            entity_id=dashboard_service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_create(self):
        """
        We can create a Lineage and get the origin node lineage info back
        """

        from_id = str(self.table1_entity.id.__root__)
        to_id = str(self.table2_entity.id.__root__)

        res = self.metadata.add_lineage(
            data=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=self.table1_entity.id, type="table"),
                    toEntity=EntityReference(id=self.table2_entity.id, type="table"),
                    lineageDetails=LineageDetails(description="test lineage"),
                ),
            )
        )

        # Check that we get the origin ID in the entity
        self.assertEqual(from_id, res["entity"]["id"])

        # Check that the toEntity is a node in the origin lineage
        node_id = next(
            iter([node["id"] for node in res["nodes"] if node["id"] == to_id]), None
        )
        self.assertIsNotNone(node_id)

        # Add pipeline to the lineage edge
        linage_request_1 = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=self.table1_entity.id, type="table"),
                toEntity=EntityReference(id=self.table2_entity.id, type="table"),
                lineageDetails=LineageDetails(
                    description="test lineage",
                    pipeline=EntityReference(
                        id=self.pipeline_entity.id, type="pipeline"
                    ),
                ),
            ),
        )

        res = self.metadata.add_lineage(data=linage_request_1, check_patch=True)

        res["entity"]["id"] = str(res["entity"]["id"])
        self.assertEqual(len(res["downstreamEdges"]), 1)
        self.assertEqual(
            res["downstreamEdges"][0]["lineageDetails"]["pipeline"]["id"],
            str(self.pipeline_entity.id.__root__),
        )

        # Add a column to the lineage edge
        linage_request_2 = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=self.table1_entity.id, type="table"),
                toEntity=EntityReference(id=self.table2_entity.id, type="table"),
                lineageDetails=LineageDetails(
                    description="test lineage",
                    columnsLineage=[
                        ColumnLineage(
                            fromColumns=[
                                f"{self.table1_entity.fullyQualifiedName.__root__}.id"
                            ],
                            toColumn=f"{self.table2_entity.fullyQualifiedName.__root__}.id",
                        )
                    ],
                ),
            ),
        )

        res = self.metadata.add_lineage(data=linage_request_2, check_patch=True)

        res["entity"]["id"] = str(res["entity"]["id"])
        self.assertEqual(len(res["downstreamEdges"]), 1)
        self.assertEqual(
            res["downstreamEdges"][0]["lineageDetails"]["pipeline"]["id"],
            str(self.pipeline_entity.id.__root__),
        )
        self.assertEqual(
            len(res["downstreamEdges"][0]["lineageDetails"]["columnsLineage"]), 1
        )

        # Add a new column to the lineage edge
        linage_request_2 = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=self.table1_entity.id, type="table"),
                toEntity=EntityReference(id=self.table2_entity.id, type="table"),
                lineageDetails=LineageDetails(
                    description="test lineage",
                    columnsLineage=[
                        ColumnLineage(
                            fromColumns=[
                                f"{self.table1_entity.fullyQualifiedName.__root__}.name"
                            ],
                            toColumn=f"{self.table2_entity.fullyQualifiedName.__root__}.name",
                        )
                    ],
                ),
            ),
        )

        res = self.metadata.add_lineage(data=linage_request_2, check_patch=True)

        res["entity"]["id"] = str(res["entity"]["id"])
        self.assertEqual(len(res["downstreamEdges"]), 1)
        self.assertEqual(
            res["downstreamEdges"][0]["lineageDetails"]["pipeline"]["id"],
            str(self.pipeline_entity.id.__root__),
        )
        self.assertEqual(
            len(res["downstreamEdges"][0]["lineageDetails"]["columnsLineage"]), 2
        )

    def test_table_datamodel_lineage(self):
        """We can create and get lineage for a table to a dashboard datamodel"""

        from_id = str(self.table1_entity.id.__root__)

        res = self.metadata.add_lineage(
            data=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=self.table1_entity.id, type="table"),
                    toEntity=EntityReference(
                        id=self.dashboard_datamodel_entity.id, type="dashboardDataModel"
                    ),
                    lineageDetails=LineageDetails(description="test lineage"),
                ),
            )
        )

        # Check that we get the origin ID in the entity
        self.assertEqual(from_id, res["entity"]["id"])

        # use the SDK to get the lineage
        datamodel_lineage = self.metadata.get_lineage_by_name(
            entity=DashboardDataModel,
            fqn=self.dashboard_datamodel_entity.fullyQualifiedName.__root__,
        )
        entity_lineage = EntityLineage.parse_obj(datamodel_lineage)
        self.assertEqual(
            from_id, str(entity_lineage.upstreamEdges[0].fromEntity.__root__)
        )
