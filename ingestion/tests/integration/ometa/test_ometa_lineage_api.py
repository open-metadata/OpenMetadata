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

"""
OpenMetadata high-level API Lineage test
"""
from unittest import TestCase

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.api.data.createAPIEndpoint import (
    CreateAPIEndpointRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createApiService import (
    CreateApiServiceRequest,
)
from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.apiEndpoint import (
    APIEndpoint,
    ApiRequestMethod,
)
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.apiService import (
    ApiConnection,
    ApiService,
    ApiServiceType,
)
from metadata.generated.schema.entity.services.connections.api.restConnection import (
    RestConnection,
    RestType,
)
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
    api_service_name = generate_name()

    db_service = get_create_service(entity=DatabaseService, name=db_service_name)
    pipeline_service = get_create_service(
        entity=PipelineService, name=pipeline_service_name
    )
    dashboard_service = get_create_service(
        entity=DashboardService, name=dashboard_service_name
    )
    api_service = CreateApiServiceRequest(
        name=api_service_name,
        serviceType=ApiServiceType.Rest,
        connection=ApiConnection(
            config=RestConnection(
                openAPISchemaURL="https://petstore.swagger.io/v2/swagger.json",
                type=RestType.Rest,
            )
        ),
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
        cls.api_service_entity: ApiService = cls.metadata.create_or_update(
            data=cls.api_service
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

        # Create API Collection
        cls.api_collection = CreateAPICollectionRequest(
            name=generate_name(),
            service=cls.api_service_entity.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet",
        )
        cls.api_collection_entity: APICollection = cls.metadata.create_or_update(
            data=cls.api_collection
        )

        # Create API Endpoint
        cls.api_endpoint = CreateAPIEndpointRequest(
            name=generate_name(),
            apiCollection=cls.api_collection_entity.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
            requestMethod=ApiRequestMethod.GET,
        )
        cls.api_endpoint_entity: APIEndpoint = cls.metadata.create_or_update(
            data=cls.api_endpoint
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

        api_service_id = str(
            cls.metadata.get_by_name(
                entity=ApiService, fqn=cls.api_service_name
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
        cls.metadata.delete(
            entity=ApiService,
            entity_id=api_service_id,
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

    def test_api_endpoint_to_table_lineage(self):
        """
        Test lineage from APIEndpoint to Table with column-level lineage using get_entity_ref
        """
        # Use get_entity_ref to build EntityReferences - this tests our fixed get_entity_type method
        api_endpoint_ref = self.metadata.get_entity_reference(
            entity=APIEndpoint, fqn=self.api_endpoint_entity.fullyQualifiedName
        )
        table_ref = self.metadata.get_entity_reference(
            entity=Table, fqn=self.table1_entity.fullyQualifiedName
        )

        # Verify that get_entity_ref returns the correct types (tests the fix for issue #20838)
        self.assertEqual(api_endpoint_ref.type, "apiEndpoint")
        self.assertEqual(table_ref.type, "table")

        # Create lineage from APIEndpoint to Table with column-level mapping
        lineage_request = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=api_endpoint_ref,
                toEntity=table_ref,
                lineageDetails=LineageDetails(
                    description="API response data flows to table",
                    # Note: Column lineage for API endpoints would typically be defined
                    # when the API response schema is known and mapped to table columns.
                    # For demonstration purposes, we show the structure even though
                    # API endpoints don't have predefined column schemas.
                    columnsLineage=[],
                ),
            )
        )

        # Add the lineage
        res = self.metadata.add_lineage(data=lineage_request)

        # Verify the lineage was created
        self.assertEqual(str(self.api_endpoint_entity.id.root), res["entity"]["id"])

        # Check that the table is in the downstream nodes
        table_node = next(
            iter(
                [
                    node
                    for node in res["nodes"]
                    if node["id"] == str(self.table1_entity.id.root)
                ]
            ),
            None,
        )
        self.assertIsNotNone(table_node)
        # The node should contain the table information
        self.assertEqual(table_node["type"], "table")

        # Verify column-level lineage exists
        self.assertEqual(len(res["downstreamEdges"]), 1)
        downstream_edge = res["downstreamEdges"][0]
        # Verify that the lineage details are present
        self.assertIsNotNone(downstream_edge["lineageDetails"])
        self.assertEqual(
            downstream_edge["lineageDetails"]["description"],
            "API response data flows to table",
        )
        # Column lineage may be empty for API endpoints as they don't have predefined schemas like tables
        self.assertIsInstance(downstream_edge["lineageDetails"]["columnsLineage"], list)

        # Test the reverse lineage - get lineage by table name
        table_lineage = self.metadata.get_lineage_by_name(
            entity=Table, fqn=self.table1_entity.fullyQualifiedName.root
        )

        # Verify the upstream edge from API endpoint
        entity_lineage = EntityLineage.model_validate(table_lineage)
        self.assertGreaterEqual(len(entity_lineage.upstreamEdges), 1)

        # Find the edge from our API endpoint (there might be others from previous tests)
        api_upstream_edge = next(
            (
                edge
                for edge in entity_lineage.upstreamEdges
                if str(edge.fromEntity.root) == str(self.api_endpoint_entity.id.root)
            ),
            None,
        )
        self.assertIsNotNone(api_upstream_edge)

        # Verify that the lineage description is preserved
        self.assertEqual(
            api_upstream_edge.lineageDetails.description,
            "API response data flows to table",
        )

        # Also test get_lineage_by_id with APIEndpoint
        api_lineage = self.metadata.get_lineage_by_id(
            entity=APIEndpoint, entity_id=self.api_endpoint_entity.id.root
        )
        self.assertEqual(
            str(api_lineage["entity"]["id"]), str(self.api_endpoint_entity.id.root)
        )
        self.assertEqual(len(api_lineage["downstreamEdges"]), 1)
