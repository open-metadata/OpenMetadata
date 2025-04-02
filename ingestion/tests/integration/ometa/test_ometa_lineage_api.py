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

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.type.basic import EntityName
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    EntityLineage,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference

from ..integration_base import generate_name, get_create_entity, get_create_service


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

        cls.create_schema_entity = cls.metadata.create_or_update(
            data=get_create_entity(
                entity=DatabaseSchema,
                reference=create_db_entity.fullyQualifiedName,
                name=generate_name(),
            )
        )

        cls.table1 = get_create_entity(
            name=generate_name(),
            entity=Table,
            reference=cls.create_schema_entity.fullyQualifiedName,
        )

        cls.table1_entity = cls.metadata.create_or_update(data=cls.table1)
        cls.table2 = get_create_entity(
            name=generate_name(),
            entity=Table,
            reference=cls.create_schema_entity.fullyQualifiedName,
        )

        cls.table2_entity = cls.metadata.create_or_update(data=cls.table2)

        cls.table3 = get_create_entity(
            name=generate_name(),
            entity=Table,
            reference=cls.create_schema_entity.fullyQualifiedName,
        )

        cls.table3_entity = cls.metadata.create_or_update(data=cls.table3)

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

        cls.dashboard_datamodel2 = get_create_entity(
            name=generate_name(),
            entity=DashboardDataModel,
            reference=cls.dashboard_service_entity.fullyQualifiedName,
        )
        cls.dashboard_datamodel_entity2 = cls.metadata.create_or_update(
            data=cls.dashboard_datamodel2
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        db_service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=cls.db_service_name
            ).id.root
        )

        pipeline_service_id = str(
            cls.metadata.get_by_name(
                entity=PipelineService, fqn=cls.pipeline_service_name
            ).id.root
        )

        dashboard_service_id = str(
            cls.metadata.get_by_name(
                entity=DashboardService, fqn=cls.dashboard_service_name
            ).id.root
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

        from_id = str(self.table1_entity.id.root)
        to_id = str(self.table2_entity.id.root)

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
            str(self.pipeline_entity.id.root),
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
                                f"{self.table1_entity.fullyQualifiedName.root}.id"
                            ],
                            toColumn=f"{self.table2_entity.fullyQualifiedName.root}.id",
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
            str(self.pipeline_entity.id.root),
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
                                f"{self.table1_entity.fullyQualifiedName.root}.another"
                            ],
                            toColumn=f"{self.table2_entity.fullyQualifiedName.root}.another",
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
            str(self.pipeline_entity.id.root),
        )
        self.assertEqual(
            len(res["downstreamEdges"][0]["lineageDetails"]["columnsLineage"]), 2
        )

        # Invalid column test
        linage_request_2 = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=self.table1_entity.id, type="table"),
                toEntity=EntityReference(id=self.table2_entity.id, type="table"),
                lineageDetails=LineageDetails(
                    description="test lineage",
                    columnsLineage=[
                        ColumnLineage(
                            fromColumns=[
                                f"{self.table1_entity.fullyQualifiedName.root}.name"
                            ],
                            toColumn=f"{self.table2_entity.fullyQualifiedName.root}.name",
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
            str(self.pipeline_entity.id.root),
        )
        # col lineage remains unchanged
        self.assertEqual(
            len(res["downstreamEdges"][0]["lineageDetails"]["columnsLineage"]), 2
        )

        # We can get lineage by ID
        lineage_id = self.metadata.get_lineage_by_id(
            entity=Table, entity_id=self.table2_entity.id.root
        )
        assert lineage_id["entity"]["id"] == str(self.table2_entity.id.root)

        # Same thing works if we pass directly the Uuid
        lineage_uuid = self.metadata.get_lineage_by_id(
            entity=Table, entity_id=self.table2_entity.id
        )
        assert lineage_uuid["entity"]["id"] == str(self.table2_entity.id.root)

        # We can also get lineage by name
        lineage_str = self.metadata.get_lineage_by_name(
            entity=Table, fqn=self.table2_entity.fullyQualifiedName.root
        )
        assert lineage_str["entity"]["id"] == str(self.table2_entity.id.root)

        # Or passing the FQN
        lineage_fqn = self.metadata.get_lineage_by_name(
            entity=Table, fqn=self.table2_entity.fullyQualifiedName
        )
        assert lineage_fqn["entity"]["id"] == str(self.table2_entity.id.root)

    def test_delete_by_source(self):
        """
        Test case for deleting lineage by source.

        This method tests the functionality of deleting lineage by source. It retrieves the lineage
        information for a specific table entity using its ID. Then, it records the original length of
        the upstream edges in the lineage. After that, it deletes the lineage by specifying the source
        type, table ID, and lineage source. Finally, it asserts that the length of the upstream edges
        in the lineage has decreased by 1.
        """
        lineage = self.metadata.get_lineage_by_id(
            entity="table", entity_id=self.table2_entity.id.root
        )
        original_len = len(lineage.get("upstreamEdges") or [])
        self.metadata.delete_lineage_by_source(
            "table", self.table2_entity.id.root, LineageSource.Manual.value
        )
        lineage = self.metadata.get_lineage_by_id(
            entity="table", entity_id=self.table2_entity.id.root
        )
        updated_len = len(lineage.get("upstreamEdges") or [])
        self.assertEqual(updated_len, original_len - 1)

    def test_table_datamodel_lineage(self):
        """We can create and get lineage for a table to a dashboard datamodel"""

        from_id = str(self.table1_entity.id.root)

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
            fqn=self.dashboard_datamodel_entity.fullyQualifiedName.root,
        )
        entity_lineage = EntityLineage.model_validate(datamodel_lineage)
        self.assertEqual(from_id, str(entity_lineage.upstreamEdges[0].fromEntity.root))

    def test_table_with_slash_in_name(self):
        """E.g., `foo.bar/baz`"""
        name = EntityName("foo.bar/baz")
        new_table: Table = self.metadata.create_or_update(
            data=get_create_entity(
                entity=Table,
                name=name,
                reference=self.create_schema_entity.fullyQualifiedName,
            )
        )

        res: Table = self.metadata.get_by_name(
            entity=Table, fqn=new_table.fullyQualifiedName
        )

        assert res.name == name

        self.metadata.add_lineage(
            data=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=self.table1_entity.id, type="table"),
                    toEntity=EntityReference(id=new_table.id, type="table"),
                    lineageDetails=LineageDetails(
                        columnsLineage=[
                            ColumnLineage(
                                fromColumns=[
                                    self.table1_entity.columns[0].fullyQualifiedName
                                ],
                                toColumn=new_table.columns[0].fullyQualifiedName,
                            )
                        ]
                    ),
                ),
            )
        )

        # use the SDK to get the lineage
        lineage = self.metadata.get_lineage_by_name(
            entity=Table,
            fqn=new_table.fullyQualifiedName.root,
        )
        entity_lineage = EntityLineage.model_validate(lineage)
        assert (
            entity_lineage.upstreamEdges[0].fromEntity.root
            == self.table1_entity.id.root
        )

    def test_clean_lineage_columns(self):
        """Test that clean_lineage_columns works"""
        # Create a lineage request with both valid and invalid columns
        table1 = get_create_entity(
            name=generate_name(),
            entity=Table,
            reference=self.create_schema_entity.fullyQualifiedName,
        )

        table1_entity = self.metadata.create_or_update(data=table1)
        table2 = get_create_entity(
            name=generate_name(),
            entity=Table,
            reference=self.create_schema_entity.fullyQualifiedName,
        )

        table2_entity = self.metadata.create_or_update(data=table2)
        lineage_request = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=table1_entity.id, type="table"),
                toEntity=EntityReference(id=table2_entity.id, type="table"),
                lineageDetails=LineageDetails(
                    description="test lineage",
                    columnsLineage=[
                        # Valid column lineage
                        ColumnLineage(
                            fromColumns=[f"{table1_entity.fullyQualifiedName.root}.id"],
                            toColumn=f"{table2_entity.fullyQualifiedName.root}.id",
                        ),
                        # Invalid column lineage - non-existent column
                        ColumnLineage(
                            fromColumns=[
                                f"{table1_entity.fullyQualifiedName.root}.invalid_col"
                            ],
                            toColumn=f"{table2_entity.fullyQualifiedName.root}.invalid_col",
                        ),
                        # Invalid column lineage - wrong table
                        ColumnLineage(
                            fromColumns=["wrong_table.id"],
                            toColumn=f"{table2_entity.fullyQualifiedName.root}.id",
                        ),
                    ],
                ),
            ),
        )

        # Add the lineage with invalid columns
        self.metadata.add_lineage(data=lineage_request)

        # Verify that only valid columns remain in the lineage
        lineage = self.metadata.get_lineage_by_id(
            entity=Table, entity_id=table2_entity.id.root
        )
        self.assertEqual(
            len(lineage["upstreamEdges"][0]["lineageDetails"]["columnsLineage"]), 1
        )
        self.assertEqual(
            lineage["upstreamEdges"][0]["lineageDetails"]["columnsLineage"][0][
                "fromColumns"
            ][0],
            f"{table1_entity.fullyQualifiedName.root}.id",
        )
        self.assertEqual(
            lineage["upstreamEdges"][0]["lineageDetails"]["columnsLineage"][0][
                "toColumn"
            ],
            f"{table2_entity.fullyQualifiedName.root}.id",
        )

    def test_clean_lineage_columns_table_datamodel(self):
        """Test clean_lineage_columns for table to dashboard datamodel lineage"""
        # Create a lineage request with both valid and invalid columns
        lineage_request = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=self.table3_entity.id, type="table"),
                toEntity=EntityReference(
                    id=self.dashboard_datamodel_entity2.id, type="dashboardDataModel"
                ),
                lineageDetails=LineageDetails(
                    description="test lineage",
                    columnsLineage=[
                        # Valid column lineage
                        ColumnLineage(
                            fromColumns=[
                                f"{self.table3_entity.fullyQualifiedName.root}.id"
                            ],
                            toColumn=f"{self.dashboard_datamodel_entity2.fullyQualifiedName.root}.id",
                        ),
                        # Invalid column lineage - non-existent column
                        ColumnLineage(
                            fromColumns=[
                                f"{self.table3_entity.fullyQualifiedName.root}.invalid_col"
                            ],
                            toColumn=f"{self.dashboard_datamodel_entity2.fullyQualifiedName.root}.invalid_col",
                        ),
                        # Invalid column lineage - wrong table
                        ColumnLineage(
                            fromColumns=["wrong_table.id"],
                            toColumn=f"{self.dashboard_datamodel_entity2.fullyQualifiedName.root}.id",
                        ),
                    ],
                ),
            ),
        )

        # Add the lineage with invalid columns
        self.metadata.add_lineage(data=lineage_request)

        # Verify that only valid columns remain in the lineage
        lineage = self.metadata.get_lineage_by_name(
            entity=DashboardDataModel,
            fqn=self.dashboard_datamodel_entity2.fullyQualifiedName.root,
        )
        self.assertEqual(
            len(lineage["upstreamEdges"][0]["lineageDetails"]["columnsLineage"]), 1
        )
        self.assertEqual(
            lineage["upstreamEdges"][0]["lineageDetails"]["columnsLineage"][0][
                "fromColumns"
            ][0],
            f"{self.table3_entity.fullyQualifiedName.root}.id",
        )
        self.assertEqual(
            lineage["upstreamEdges"][0]["lineageDetails"]["columnsLineage"][0][
                "toColumn"
            ],
            f"{self.dashboard_datamodel_entity2.fullyQualifiedName.root}.id",
        )

    def test_clean_lineage_columns_nested_columns(self):
        """Test clean_lineage_columns with nested columns"""
        # Create a table with nested columns
        nested_table = get_create_entity(
            name=generate_name(),
            entity=Table,
            reference=self.create_schema_entity.fullyQualifiedName,
        )
        nested_table.columns = [
            Column(name="parent_col", dataType="STRING"),
            Column(
                name="nested_col",
                dataType="STRING",
                children=[
                    Column(name="child1", dataType="STRING"),
                    Column(name="child2", dataType="STRING"),
                ],
            ),
        ]
        nested_table_entity = self.metadata.create_or_update(data=nested_table)

        # Create a lineage request with nested column references
        lineage_request = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=self.table3_entity.id, type="table"),
                toEntity=EntityReference(id=nested_table_entity.id, type="table"),
                lineageDetails=LineageDetails(
                    description="test lineage",
                    columnsLineage=[
                        # Valid nested column lineage
                        ColumnLineage(
                            fromColumns=[
                                f"{self.table3_entity.fullyQualifiedName.root}.id"
                            ],
                            toColumn=f"{nested_table_entity.fullyQualifiedName.root}.nested_col.child1",
                        ),
                        # Invalid nested column lineage
                        ColumnLineage(
                            fromColumns=[
                                f"{self.table3_entity.fullyQualifiedName.root}.id"
                            ],
                            toColumn=f"{nested_table_entity.fullyQualifiedName.root}.nested_col.invalid_child",
                        ),
                    ],
                ),
            ),
        )

        # Add the lineage with invalid columns
        self.metadata.add_lineage(data=lineage_request, check_patch=True)

        # Verify that only valid columns remain in the lineage
        lineage = self.metadata.get_lineage_by_id(
            entity=Table, entity_id=nested_table_entity.id.root
        )
        self.assertEqual(
            len(lineage["upstreamEdges"][0]["lineageDetails"]["columnsLineage"]), 1
        )
        self.assertEqual(
            lineage["upstreamEdges"][0]["lineageDetails"]["columnsLineage"][0][
                "toColumn"
            ],
            f"{nested_table_entity.fullyQualifiedName.root}.nested_col.child1",
        )
