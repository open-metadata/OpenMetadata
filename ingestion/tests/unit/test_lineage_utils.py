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
Lineage utils unit tests
"""

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
)
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.mlmodel import MlFeature, MlModel
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.basic import UUID, FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.schema import DataTypeTopic, FieldModel
from metadata.generated.schema.type.schema import Topic as TopicSchema
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import clean_lineage_columns, column_name_list


def test_column_name_list_table():
    """Test column_name_list for Table entity"""
    # Create a table with nested columns
    table = Table(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        name="test_table",
        columns=[
            Column(name="col1", dataType="STRING"),
            Column(
                name="nested_col",
                dataType="STRING",
                children=[
                    Column(name="child1", dataType="STRING"),
                    Column(name="child2", dataType="STRING"),
                ],
            ),
        ],
    )

    expected_columns = {"col1", "nested_col", "nested_col.child1", "nested_col.child2"}
    result = column_name_list(table)
    assert result == expected_columns


def test_column_name_list_table_deep_nesting():
    """Test column_name_list for Table entity with deep nesting"""
    table = Table(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        name="test_table",
        columns=[
            Column(
                name="parent_col",
                dataType="STRING",
                children=[
                    Column(
                        name="child_col",
                        dataType="STRING",
                        children=[
                            Column(name="grandchild_col", dataType="STRING"),
                            Column(
                                name="grandchild_col2",
                                dataType="STRING",
                                children=[
                                    Column(
                                        name="great_grandchild_col", dataType="STRING"
                                    )
                                ],
                            ),
                        ],
                    )
                ],
            )
        ],
    )

    expected_columns = {
        "parent_col",
        "parent_col.child_col",
        "parent_col.child_col.grandchild_col",
        "parent_col.child_col.grandchild_col2",
        "parent_col.child_col.grandchild_col2.great_grandchild_col",
    }
    result = column_name_list(table)
    assert result == expected_columns


def test_column_name_list_dashboard():
    """Test column_name_list for Dashboard entity"""
    dashboard = Dashboard(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        service=EntityReference(
            id=UUID("12345678-1234-5678-1234-567812345678"),
            type="service",
            name="random_service",
            fullyQualifiedName="random_service",
        ),
        name="test_dashboard",
        charts=[
            EntityReference(
                id=UUID("12345678-1234-5678-1234-567812345678"),
                type="chart",
                name="chart1",
                fullyQualifiedName="dashboard.chart1",
            )
        ],
    )

    expected_columns = {"chart1"}
    result = column_name_list(dashboard)
    assert result == expected_columns


def test_column_name_list_container():
    """Test column_name_list for Container entity"""
    container = Container(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        name="test_container",
        service=EntityReference(
            id=UUID("12345678-1234-5678-1234-567812345678"),
            type="service",
            name="random_service",
            fullyQualifiedName="random_service",
        ),
        dataModel=ContainerDataModel(
            columns=[
                Column(name="col1", dataType="STRING"),
                Column(name="col2", dataType="STRING"),
            ]
        ),
    )

    expected_columns = {"col1", "col2"}
    result = column_name_list(container)
    assert result == expected_columns


def test_column_name_list_container_nested():
    """Test column_name_list for Container entity with nested columns"""
    container = Container(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        name="test_container",
        service=EntityReference(
            id=UUID("12345678-1234-5678-1234-567812345678"),
            type="service",
            name="random_service",
            fullyQualifiedName="random_service",
        ),
        dataModel=ContainerDataModel(
            columns=[
                Column(
                    name="parent_col",
                    dataType="STRING",
                    children=[
                        Column(
                            name="child_col",
                            dataType="STRING",
                            children=[Column(name="grandchild_col", dataType="STRING")],
                        )
                    ],
                )
            ]
        ),
    )

    expected_columns = {
        "parent_col",
        "parent_col.child_col",
        "parent_col.child_col.grandchild_col",
    }
    result = column_name_list(container)
    assert result == expected_columns


def test_column_name_list_mlmodel():
    """Test column_name_list for MlModel entity"""
    mlmodel = MlModel(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        name="test_model",
        mlFeatures=[MlFeature(name="feature1")],
        algorithm="test_algorithm",
        service=EntityReference(
            id=UUID("12345678-1234-5678-1234-567812345678"),
            type="service",
            name="random_service",
            fullyQualifiedName="random_service",
        ),
    )

    expected_columns = {"feature1"}
    result = column_name_list(mlmodel)
    assert result == expected_columns


def test_clean_lineage_columns():
    """Test clean_lineage_columns function"""
    # Create test entities
    source_table = Table(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        name="source_table",
        fullyQualifiedName="database.schema.source_table",
        columns=[
            Column(name="col1", dataType="STRING"),
            Column(name="col2", dataType="STRING"),
        ],
    )

    target_table = Table(
        id=UUID("87654321-4321-8765-4321-876543210987"),
        name="target_table",
        fullyQualifiedName="database.schema.target_table",
        columns=[
            Column(name="col1", dataType="STRING"),
            Column(name="col2", dataType="STRING"),
        ],
    )

    # Create lineage request with valid and invalid columns
    lineage_request = AddLineageRequest(
        edge=EntitiesEdge(
            fromEntity=EntityReference(
                id=UUID("12345678-1234-5678-1234-567812345678"),
                type="table",
                name="source_table",
                fullyQualifiedName="database.schema.source_table",
            ),
            toEntity=EntityReference(
                id=UUID("87654321-4321-8765-4321-876543210987"),
                type="table",
                name="target_table",
                fullyQualifiedName="database.schema.target_table",
            ),
            lineageDetails=LineageDetails(
                columnsLineage=[
                    ColumnLineage(
                        fromColumns=["database.schema.source_table.col1"],
                        toColumn="database.schema.target_table.col1",
                    ),
                    ColumnLineage(
                        fromColumns=["database.schema.source_table.invalid_col"],
                        toColumn="database.schema.target_table.invalid_col",
                    ),
                    ColumnLineage(
                        fromColumns=["database.schema.invalid_table.col1"],
                        toColumn="database.schema.target_table.col1",
                    ),
                ]
            ),
        )
    )

    # Create metadata instance with test entities
    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(jwtToken="<token>"),
    )
    metadata = OpenMetadata(server_config)

    metadata.get_by_id = (
        lambda entity, entity_id, fields: source_table
        if entity_id == UUID("12345678-1234-5678-1234-567812345678")
        else target_table
    )

    # Clean lineage columns
    clean_lineage_columns(metadata, lineage_request)

    # Verify that only valid columns remain
    assert len(lineage_request.edge.lineageDetails.columnsLineage) == 1
    assert lineage_request.edge.lineageDetails.columnsLineage[0].fromColumns == [
        FullyQualifiedEntityName("database.schema.source_table.col1")
    ]
    assert lineage_request.edge.lineageDetails.columnsLineage[
        0
    ].toColumn == FullyQualifiedEntityName("database.schema.target_table.col1")


def test_column_name_list_dashboard_data_model():
    """Test column_name_list for DashboardDataModel entity"""
    dashboard_data_model = DashboardDataModel(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        name="test_dashboard_data_model",
        service=EntityReference(
            id=UUID("12345678-1234-5678-1234-567812345678"),
            type="service",
            name="random_service",
            fullyQualifiedName="random_service",
        ),
        dataModelType=DataModelType.TableauDataModel,
        columns=[
            Column(
                name="parent_col",
                dataType="STRING",
                children=[
                    Column(
                        name="child_col",
                        dataType="STRING",
                        children=[Column(name="grandchild_col", dataType="STRING")],
                    )
                ],
            )
        ],
    )

    expected_columns = {
        "parent_col",
        "parent_col.child_col",
        "parent_col.child_col.grandchild_col",
    }
    result = column_name_list(dashboard_data_model)
    assert result == expected_columns


def test_clean_lineage_columns_topic_container():
    """Test clean_lineage_columns function for topic to container lineage"""
    # Create test entities
    source_topic = Topic(
        partitions=1,
        id=UUID("12345678-1234-5678-1234-567812345678"),
        name="source_topic",
        fullyQualifiedName="service.source_topic",
        service=EntityReference(
            id=UUID("12345678-1234-5678-1234-567812345678"),
            type="service",
            name="random_service",
            fullyQualifiedName="random_service",
        ),
        messageSchema=TopicSchema(
            schemaFields=[
                FieldModel(name="field1", dataType=DataTypeTopic.STRING),
                FieldModel(name="field2", dataType=DataTypeTopic.STRING),
            ]
        ),
    )

    target_container = Container(
        name="target_container",
        id=UUID("87654321-4321-8765-4321-876543210987"),
        service=EntityReference(
            id=UUID("12345678-1234-5678-1234-567812345678"),
            type="service",
            name="random_service",
            fullyQualifiedName="random_service",
        ),
        fullyQualifiedName="service.target_container",
        dataModel=ContainerDataModel(
            columns=[
                Column(name="col1", dataType="STRING"),
                Column(name="col2", dataType="STRING"),
            ]
        ),
    )

    # Create lineage request with valid and invalid columns
    lineage_request = AddLineageRequest(
        edge=EntitiesEdge(
            fromEntity=EntityReference(
                id=UUID("12345678-1234-5678-1234-567812345678"),
                type="topic",
                name="source_topic",
                fullyQualifiedName="service.source_topic",
            ),
            toEntity=EntityReference(
                id=UUID("87654321-4321-8765-4321-876543210987"),
                type="container",
                name="target_container",
                fullyQualifiedName="service.target_container",
            ),
            lineageDetails=LineageDetails(
                columnsLineage=[
                    ColumnLineage(
                        fromColumns=["service.source_topic.field1"],
                        toColumn="service.target_container.col1",
                    ),
                    ColumnLineage(
                        fromColumns=["service.source_topic.invalid_field"],
                        toColumn="service.target_container.invalid_col",
                    ),
                    ColumnLineage(
                        fromColumns=["service.invalid_topic.field1"],
                        toColumn="service.target_container.col1",
                    ),
                ]
            ),
        )
    )

    # Create metadata instance with test entities
    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(jwtToken="<token>"),
    )
    metadata = OpenMetadata(server_config)
    metadata.get_by_id = (
        lambda entity, entity_id, fields: source_topic
        if entity_id == UUID("12345678-1234-5678-1234-567812345678")
        else target_container
    )

    # Clean lineage columns
    clean_lineage_columns(metadata, lineage_request)

    # Verify that only valid columns remain
    assert len(lineage_request.edge.lineageDetails.columnsLineage) == 1
    assert lineage_request.edge.lineageDetails.columnsLineage[0].fromColumns == [
        FullyQualifiedEntityName("service.source_topic.field1")
    ]
    assert lineage_request.edge.lineageDetails.columnsLineage[
        0
    ].toColumn == FullyQualifiedEntityName("service.target_container.col1")
