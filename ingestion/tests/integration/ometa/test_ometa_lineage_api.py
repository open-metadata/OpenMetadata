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
import time

import pytest

from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.api.data.createAPIEndpoint import (
    CreateAPIEndpointRequest,
)
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
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

from ..conftest import _safe_delete
from ..integration_base import generate_name, get_create_entity, get_create_service


def add_lineage_with_retry(metadata, data, retries=3, delay=1, **kwargs):
    """Retry add_lineage to handle transient ES version conflicts (409).

    When running tests in parallel (--dist loadfile), concurrent writes to the
    same ES index shard (e.g. database_service_search_index) from other test
    files can cause _update_by_query version conflicts during the server-side
    extended lineage creation (addServiceLineage). The server returns 500,
    and add_lineage() returns {"error": ...} instead of raising.
    """
    for attempt in range(retries):
        res = metadata.add_lineage(data=data, **kwargs)
        if "error" not in res:
            return res
        if attempt < retries - 1:
            time.sleep(delay)
    return res


@pytest.fixture(scope="module")
def lineage_database_service(metadata):
    """Module-scoped database service for lineage tests."""
    service_name = generate_name()
    service_request = get_create_service(entity=DatabaseService, name=service_name)
    service = metadata.create_or_update(data=service_request)

    yield service

    _safe_delete(
        metadata,
        entity=DatabaseService,
        entity_id=service.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def lineage_pipeline_service(metadata):
    """Module-scoped pipeline service for lineage tests."""
    service_name = generate_name()
    service_request = get_create_service(entity=PipelineService, name=service_name)
    service = metadata.create_or_update(data=service_request)

    yield service

    _safe_delete(
        metadata,
        entity=PipelineService,
        entity_id=service.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def lineage_dashboard_service(metadata):
    """Module-scoped dashboard service for lineage tests."""
    service_name = generate_name()
    service_request = get_create_service(entity=DashboardService, name=service_name)
    service = metadata.create_or_update(data=service_request)

    yield service

    _safe_delete(
        metadata,
        entity=DashboardService,
        entity_id=service.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def lineage_api_service(metadata):
    """Module-scoped API service for lineage tests."""
    service_name = generate_name()
    service_request = CreateApiServiceRequest(
        name=service_name,
        serviceType=ApiServiceType.Rest,
        connection=ApiConnection(
            config=RestConnection(
                openAPISchemaURL="https://petstore.swagger.io/v2/swagger.json",
                type=RestType.Rest,
            )
        ),
    )
    service = metadata.create_or_update(data=service_request)

    yield service

    _safe_delete(
        metadata,
        entity=ApiService,
        entity_id=service.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def lineage_database(metadata, lineage_database_service):
    """Module-scoped database for lineage tests."""
    database_request = CreateDatabaseRequest(
        name=generate_name(),
        service=lineage_database_service.fullyQualifiedName,
    )
    database = metadata.create_or_update(data=database_request)

    yield database

    metadata.delete(entity=Database, entity_id=database.id, hard_delete=True)


@pytest.fixture(scope="module")
def lineage_schema(metadata, lineage_database):
    """Module-scoped schema for lineage tests."""
    schema_request = CreateDatabaseSchemaRequest(
        name=generate_name(),
        database=lineage_database.fullyQualifiedName,
    )
    schema = metadata.create_or_update(data=schema_request)

    yield schema

    metadata.delete(
        entity=DatabaseSchema, entity_id=schema.id, recursive=True, hard_delete=True
    )


@pytest.fixture(scope="module")
def lineage_table1(metadata, lineage_schema):
    """Module-scoped first table for lineage tests."""
    table_request = get_create_entity(
        name=generate_name(),
        entity=Table,
        reference=lineage_schema.fullyQualifiedName,
    )
    table = metadata.create_or_update(data=table_request)

    yield table

    metadata.delete(entity=Table, entity_id=table.id, hard_delete=True)


@pytest.fixture(scope="module")
def lineage_table2(metadata, lineage_schema):
    """Module-scoped second table for lineage tests."""
    table_request = get_create_entity(
        name=generate_name(),
        entity=Table,
        reference=lineage_schema.fullyQualifiedName,
    )
    table = metadata.create_or_update(data=table_request)

    yield table

    metadata.delete(entity=Table, entity_id=table.id, hard_delete=True)


@pytest.fixture(scope="module")
def lineage_pipeline(metadata, lineage_pipeline_service):
    """Module-scoped pipeline for lineage tests."""
    pipeline_request = get_create_entity(
        name=generate_name(),
        entity=Pipeline,
        reference=lineage_pipeline_service.fullyQualifiedName,
    )
    pipeline = metadata.create_or_update(data=pipeline_request)

    yield pipeline

    metadata.delete(entity=Pipeline, entity_id=pipeline.id, hard_delete=True)


@pytest.fixture(scope="module")
def lineage_dashboard(metadata, lineage_dashboard_service):
    """Module-scoped dashboard for lineage tests."""
    dashboard_request = get_create_entity(
        name=generate_name(),
        entity=Dashboard,
        reference=lineage_dashboard_service.fullyQualifiedName,
    )
    dashboard = metadata.create_or_update(data=dashboard_request)

    yield dashboard

    metadata.delete(entity=Dashboard, entity_id=dashboard.id, hard_delete=True)


@pytest.fixture(scope="module")
def lineage_dashboard_datamodel(metadata, lineage_dashboard_service):
    """Module-scoped dashboard datamodel for lineage tests."""
    datamodel_request = get_create_entity(
        name=generate_name(),
        entity=DashboardDataModel,
        reference=lineage_dashboard_service.fullyQualifiedName,
    )
    datamodel = metadata.create_or_update(data=datamodel_request)

    yield datamodel

    metadata.delete(entity=DashboardDataModel, entity_id=datamodel.id, hard_delete=True)


@pytest.fixture(scope="module")
def lineage_api_collection(metadata, lineage_api_service):
    """Module-scoped API collection for lineage tests."""
    collection_request = CreateAPICollectionRequest(
        name=generate_name(),
        service=lineage_api_service.fullyQualifiedName,
        endpointURL="https://petstore.swagger.io/v2/pet",
    )
    collection = metadata.create_or_update(data=collection_request)

    yield collection

    metadata.delete(entity=APICollection, entity_id=collection.id, hard_delete=True)


@pytest.fixture(scope="module")
def lineage_api_endpoint(metadata, lineage_api_collection):
    """Module-scoped API endpoint for lineage tests."""
    endpoint_request = CreateAPIEndpointRequest(
        name=generate_name(),
        apiCollection=lineage_api_collection.fullyQualifiedName,
        endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
        requestMethod=ApiRequestMethod.GET,
    )
    endpoint = metadata.create_or_update(data=endpoint_request)

    yield endpoint

    metadata.delete(entity=APIEndpoint, entity_id=endpoint.id, hard_delete=True)


class TestOMetaLineageAPI:
    """
    Lineage API integration tests.
    Tests lineage creation, retrieval, and deletion operations.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_create(self, metadata, lineage_table1, lineage_table2, lineage_pipeline):
        """
        We can create a Lineage and get the origin node lineage info back
        """

        from_id = str(lineage_table1.id.root)
        to_id = str(lineage_table2.id.root)

        res = metadata.add_lineage(
            data=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=lineage_table1.id, type="table"),
                    toEntity=EntityReference(id=lineage_table2.id, type="table"),
                    lineageDetails=LineageDetails(description="test lineage"),
                ),
            )
        )

        assert from_id == res["entity"]["id"]

        node_id = next(
            iter([node["id"] for node in res["nodes"] if node["id"] == to_id]), None
        )
        assert node_id is not None

        linage_request_1 = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=lineage_table1.id, type="table"),
                toEntity=EntityReference(id=lineage_table2.id, type="table"),
                lineageDetails=LineageDetails(
                    description="test lineage",
                    pipeline=EntityReference(id=lineage_pipeline.id, type="pipeline"),
                ),
            ),
        )

        res = metadata.add_lineage(data=linage_request_1, check_patch=True)

        res["entity"]["id"] = str(res["entity"]["id"])
        assert len(res["downstreamEdges"]) == 1
        assert res["downstreamEdges"][0]["lineageDetails"]["pipeline"]["id"] == str(
            lineage_pipeline.id.root
        )

        linage_request_2 = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=lineage_table1.id, type="table"),
                toEntity=EntityReference(id=lineage_table2.id, type="table"),
                lineageDetails=LineageDetails(
                    description="test lineage",
                    columnsLineage=[
                        ColumnLineage(
                            fromColumns=[
                                f"{lineage_table1.fullyQualifiedName.root}.id"
                            ],
                            toColumn=f"{lineage_table2.fullyQualifiedName.root}.id",
                        )
                    ],
                ),
            ),
        )

        res = metadata.add_lineage(data=linage_request_2, check_patch=True)

        res["entity"]["id"] = str(res["entity"]["id"])
        assert len(res["downstreamEdges"]) == 1
        assert res["downstreamEdges"][0]["lineageDetails"]["pipeline"]["id"] == str(
            lineage_pipeline.id.root
        )
        assert len(res["downstreamEdges"][0]["lineageDetails"]["columnsLineage"]) == 1

        linage_request_2 = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=lineage_table1.id, type="table"),
                toEntity=EntityReference(id=lineage_table2.id, type="table"),
                lineageDetails=LineageDetails(
                    description="test lineage",
                    columnsLineage=[
                        ColumnLineage(
                            fromColumns=[
                                f"{lineage_table1.fullyQualifiedName.root}.another"
                            ],
                            toColumn=f"{lineage_table2.fullyQualifiedName.root}.another",
                        )
                    ],
                ),
            ),
        )

        res = metadata.add_lineage(data=linage_request_2, check_patch=True)

        res["entity"]["id"] = str(res["entity"]["id"])
        assert len(res["downstreamEdges"]) == 1
        assert res["downstreamEdges"][0]["lineageDetails"]["pipeline"]["id"] == str(
            lineage_pipeline.id.root
        )
        assert len(res["downstreamEdges"][0]["lineageDetails"]["columnsLineage"]) == 2

        lineage_id = metadata.get_lineage_by_id(
            entity=Table, entity_id=lineage_table2.id.root
        )
        assert lineage_id["entity"]["id"] == str(lineage_table2.id.root)

        lineage_uuid = metadata.get_lineage_by_id(
            entity=Table, entity_id=lineage_table2.id
        )
        assert lineage_uuid["entity"]["id"] == str(lineage_table2.id.root)

        lineage_str = metadata.get_lineage_by_name(
            entity=Table, fqn=lineage_table2.fullyQualifiedName.root
        )
        assert lineage_str["entity"]["id"] == str(lineage_table2.id.root)

        lineage_fqn = metadata.get_lineage_by_name(
            entity=Table, fqn=lineage_table2.fullyQualifiedName
        )
        assert lineage_fqn["entity"]["id"] == str(lineage_table2.id.root)

    def test_delete_by_source(self, metadata, lineage_table2):
        """
        Test case for deleting lineage by source.

        This method tests the functionality of deleting lineage by source. It retrieves the lineage
        information for a specific table entity using its ID. Then, it records the original length of
        the upstream edges in the lineage. After that, it deletes the lineage by specifying the source
        type, table ID, and lineage source. Finally, it asserts that the length of the upstream edges
        in the lineage has decreased by 1.
        """
        lineage = metadata.get_lineage_by_id(
            entity="table", entity_id=lineage_table2.id.root
        )
        original_len = len(lineage.get("upstreamEdges") or [])
        metadata.delete_lineage_by_source(
            "table", lineage_table2.id.root, LineageSource.Manual.value
        )
        lineage = metadata.get_lineage_by_id(
            entity="table", entity_id=lineage_table2.id.root
        )
        updated_len = len(lineage.get("upstreamEdges") or [])
        assert updated_len == original_len - 1

    def test_table_datamodel_lineage(
        self, metadata, lineage_table1, lineage_dashboard_datamodel
    ):
        """We can create and get lineage for a table to a dashboard datamodel"""

        from_id = str(lineage_table1.id.root)

        res = add_lineage_with_retry(
            metadata,
            data=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=lineage_table1.id, type="table"),
                    toEntity=EntityReference(
                        id=lineage_dashboard_datamodel.id, type="dashboardDataModel"
                    ),
                    lineageDetails=LineageDetails(description="test lineage"),
                ),
            ),
        )

        assert from_id == res["entity"]["id"]

        datamodel_lineage = metadata.get_lineage_by_name(
            entity=DashboardDataModel,
            fqn=lineage_dashboard_datamodel.fullyQualifiedName.root,
        )
        entity_lineage = EntityLineage.model_validate(datamodel_lineage)
        assert from_id == str(entity_lineage.upstreamEdges[0].fromEntity.root)

    def test_table_with_slash_in_name(self, metadata, lineage_schema, lineage_table1):
        """E.g., `foo.bar/baz`"""
        name = EntityName("foo.bar/baz")
        new_table: Table = metadata.create_or_update(
            data=get_create_entity(
                entity=Table,
                name=name,
                reference=lineage_schema.fullyQualifiedName,
            )
        )

        res: Table = metadata.get_by_name(
            entity=Table, fqn=new_table.fullyQualifiedName
        )

        assert res.name == name

        metadata.add_lineage(
            data=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=lineage_table1.id, type="table"),
                    toEntity=EntityReference(id=new_table.id, type="table"),
                    lineageDetails=LineageDetails(
                        columnsLineage=[
                            ColumnLineage(
                                fromColumns=[
                                    lineage_table1.columns[0].fullyQualifiedName
                                ],
                                toColumn=new_table.columns[0].fullyQualifiedName,
                            )
                        ]
                    ),
                ),
            )
        )

        lineage = metadata.get_lineage_by_name(
            entity=Table,
            fqn=new_table.fullyQualifiedName.root,
        )
        entity_lineage = EntityLineage.model_validate(lineage)
        assert entity_lineage.upstreamEdges[0].fromEntity.root == lineage_table1.id.root

    def test_api_endpoint_to_table_lineage(
        self, metadata, lineage_api_endpoint, lineage_table1
    ):
        """
        Test lineage from APIEndpoint to Table with column-level lineage using get_entity_ref
        """
        api_endpoint_ref = metadata.get_entity_reference(
            entity=APIEndpoint, fqn=lineage_api_endpoint.fullyQualifiedName
        )
        table_ref = metadata.get_entity_reference(
            entity=Table, fqn=lineage_table1.fullyQualifiedName
        )

        assert api_endpoint_ref.type == "apiEndpoint"
        assert table_ref.type == "table"

        lineage_request = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=api_endpoint_ref,
                toEntity=table_ref,
                lineageDetails=LineageDetails(
                    description="API response data flows to table",
                    columnsLineage=[],
                ),
            )
        )

        res = add_lineage_with_retry(metadata, data=lineage_request)

        assert str(lineage_api_endpoint.id.root) == res["entity"]["id"]

        table_node = next(
            iter(
                [
                    node
                    for node in res["nodes"]
                    if node["id"] == str(lineage_table1.id.root)
                ]
            ),
            None,
        )
        assert table_node is not None
        assert table_node["type"] == "table"

        assert len(res["downstreamEdges"]) == 1
        downstream_edge = res["downstreamEdges"][0]
        assert downstream_edge["lineageDetails"] is not None
        assert (
            downstream_edge["lineageDetails"]["description"]
            == "API response data flows to table"
        )
        assert isinstance(downstream_edge["lineageDetails"]["columnsLineage"], list)

        table_lineage = metadata.get_lineage_by_name(
            entity=Table, fqn=lineage_table1.fullyQualifiedName.root
        )

        entity_lineage = EntityLineage.model_validate(table_lineage)
        assert len(entity_lineage.upstreamEdges) >= 1

        api_upstream_edge = next(
            (
                edge
                for edge in entity_lineage.upstreamEdges
                if str(edge.fromEntity.root) == str(lineage_api_endpoint.id.root)
            ),
            None,
        )
        assert api_upstream_edge is not None

        assert (
            api_upstream_edge.lineageDetails.description
            == "API response data flows to table"
        )

        api_lineage = metadata.get_lineage_by_id(
            entity=APIEndpoint, entity_id=lineage_api_endpoint.id.root
        )
        assert str(api_lineage["entity"]["id"]) == str(lineage_api_endpoint.id.root)
        assert len(api_lineage["downstreamEdges"]) == 1
