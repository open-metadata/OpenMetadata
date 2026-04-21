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
Test Microsoft Fabric Pydantic Models
"""

from unittest import TestCase

from metadata.clients.microsoftfabric.models import (
    FabricActivity,
    FabricItem,
    FabricItemType,
    FabricLakehouse,
    FabricPipeline,
    FabricPipelineRun,
    FabricPipelineRunStatus,
    FabricSqlEndpoint,
    FabricWarehouse,
    FabricWorkspace,
)


class FabricWorkspaceModelTest(TestCase):
    """
    Unit tests for FabricWorkspace model
    """

    def test_workspace_creation(self):
        """Test creating a FabricWorkspace"""
        workspace = FabricWorkspace(
            id="ws-123",
            display_name="Development Workspace",
            description="Workspace for development",
            type="Workspace",
            capacity_id="cap-1",
        )

        self.assertEqual(workspace.id, "ws-123")
        self.assertEqual(workspace.display_name, "Development Workspace")
        self.assertEqual(workspace.description, "Workspace for development")

    def test_workspace_from_api_response(self):
        """Test creating workspace from API response with camelCase"""
        data = {
            "id": "ws-456",
            "displayName": "Production",
            "description": "Production workspace",
            "capacityId": "cap-2",
        }

        workspace = FabricWorkspace.model_validate(data)

        self.assertEqual(workspace.id, "ws-456")
        self.assertEqual(workspace.display_name, "Production")
        self.assertEqual(workspace.capacity_id, "cap-2")


class FabricItemModelTest(TestCase):
    """
    Unit tests for FabricItem model
    """

    def test_fabric_item_creation(self):
        """Test creating a FabricItem"""
        item = FabricItem(
            id="test-id-123",
            display_name="Test Item",
            description="A test item",
            type="Warehouse",
            workspace_id="workspace-123",
        )

        self.assertEqual(item.id, "test-id-123")
        self.assertEqual(item.display_name, "Test Item")
        self.assertEqual(item.description, "A test item")
        self.assertEqual(item.type, "Warehouse")
        self.assertEqual(item.workspace_id, "workspace-123")

    def test_fabric_item_from_api_response(self):
        """Test creating FabricItem from API response with camelCase"""
        data = {
            "id": "dict-id",
            "displayName": "From Dict",
            "description": "Created from dict",
            "type": "DataPipeline",
            "workspaceId": "ws-1",
        }

        item = FabricItem.model_validate(data)

        self.assertEqual(item.id, "dict-id")
        self.assertEqual(item.display_name, "From Dict")
        self.assertEqual(item.workspace_id, "ws-1")


class FabricItemTypeTest(TestCase):
    """
    Unit tests for FabricItemType enum
    """

    def test_item_types(self):
        """Test available item types"""
        self.assertEqual(FabricItemType.WAREHOUSE.value, "Warehouse")
        self.assertEqual(FabricItemType.LAKEHOUSE.value, "Lakehouse")
        self.assertEqual(FabricItemType.DATA_PIPELINE.value, "DataPipeline")
        self.assertEqual(FabricItemType.NOTEBOOK.value, "Notebook")


class FabricWarehouseModelTest(TestCase):
    """
    Unit tests for FabricWarehouse model
    """

    def test_warehouse_creation(self):
        """Test creating a FabricWarehouse"""
        warehouse = FabricWarehouse(
            id="wh-123",
            display_name="Sales Warehouse",
            description="Data warehouse for sales",
            workspace_id="ws-1",
            connection_string="server.datawarehouse.fabric.microsoft.com",
        )

        self.assertEqual(warehouse.id, "wh-123")
        self.assertEqual(warehouse.display_name, "Sales Warehouse")
        self.assertIn("datawarehouse.fabric.microsoft.com", warehouse.connection_string)

    def test_warehouse_from_api_response(self):
        """Test creating warehouse from API response"""
        data = {
            "id": "wh-456",
            "displayName": "Analytics Warehouse",
            "workspaceId": "ws-1",
            "connectionString": "server.datawarehouse.fabric.microsoft.com",
            "properties": {
                "createdDate": "2024-01-15T10:00:00Z",
            },
        }

        warehouse = FabricWarehouse.model_validate(data)

        self.assertEqual(warehouse.display_name, "Analytics Warehouse")
        self.assertIsNotNone(warehouse.sql_endpoint_properties)


class FabricLakehouseModelTest(TestCase):
    """
    Unit tests for FabricLakehouse model
    """

    def test_lakehouse_creation(self):
        """Test creating a FabricLakehouse"""
        lakehouse = FabricLakehouse(
            id="lh-123",
            display_name="Bronze Lakehouse",
            description="Bronze layer for raw data",
            workspace_id="ws-1",
            onelake_tables_path="Tables",
            onelake_files_path="Files",
        )

        self.assertEqual(lakehouse.id, "lh-123")
        self.assertEqual(lakehouse.display_name, "Bronze Lakehouse")
        self.assertEqual(lakehouse.onelake_tables_path, "Tables")

    def test_lakehouse_from_api_response(self):
        """Test creating lakehouse from API response"""
        data = {
            "id": "lh-456",
            "displayName": "Silver Lakehouse",
            "workspaceId": "ws-1",
            "oneLakeTablesPath": "Tables",
            "oneLakeFilesPath": "Files",
        }

        lakehouse = FabricLakehouse.model_validate(data)

        self.assertEqual(lakehouse.display_name, "Silver Lakehouse")
        self.assertEqual(lakehouse.onelake_tables_path, "Tables")


class FabricSqlEndpointModelTest(TestCase):
    """
    Unit tests for FabricSqlEndpoint model
    """

    def test_sql_endpoint_creation(self):
        """Test creating a SQL endpoint"""
        endpoint = FabricSqlEndpoint(
            connection_string="server.datawarehouse.fabric.microsoft.com",
            id="endpoint-1",
            provisioning_status="Success",
        )

        self.assertIn("datawarehouse.fabric.microsoft.com", endpoint.connection_string)
        self.assertEqual(endpoint.provisioning_status, "Success")


class FabricPipelineModelTest(TestCase):
    """
    Unit tests for FabricPipeline model
    """

    def test_pipeline_creation(self):
        """Test creating a FabricPipeline"""
        pipeline = FabricPipeline(
            id="pipe-123",
            display_name="ETL Pipeline",
            description="Main ETL pipeline",
            workspace_id="ws-1",
        )

        self.assertEqual(pipeline.id, "pipe-123")
        self.assertEqual(pipeline.display_name, "ETL Pipeline")

    def test_pipeline_from_api_response(self):
        """Test creating pipeline from API response"""
        data = {
            "id": "pipe-456",
            "displayName": "Complex Pipeline",
            "description": "A complex pipeline",
            "workspaceId": "ws-1",
        }

        pipeline = FabricPipeline.model_validate(data)

        self.assertEqual(pipeline.display_name, "Complex Pipeline")
        self.assertEqual(pipeline.workspace_id, "ws-1")


class FabricPipelineRunModelTest(TestCase):
    """
    Unit tests for FabricPipelineRun model
    """

    def test_successful_run(self):
        """Test a successful pipeline run"""
        run = FabricPipelineRun(
            id="run-123",
            pipeline_id="pipe-1",
            status="Completed",
            start_time="2024-01-15T10:00:00Z",
            end_time="2024-01-15T10:30:00Z",
        )

        self.assertEqual(run.status, "Completed")
        self.assertIsNotNone(run.start_time)
        self.assertIsNotNone(run.end_time)

    def test_run_from_api_response(self):
        """Test creating run from API response"""
        data = {
            "id": "run-456",
            "itemId": "pipe-1",
            "status": "Failed",
            "startTimeUtc": "2024-01-15T10:00:00Z",
            "endTimeUtc": "2024-01-15T10:05:00Z",
            "failureReason": {"message": "Connection timeout"},
        }

        run = FabricPipelineRun.model_validate(data)

        self.assertEqual(run.status, "Failed")
        self.assertEqual(run.pipeline_id, "pipe-1")
        self.assertIsNotNone(run.failure_reason)

    def test_in_progress_run(self):
        """Test an in-progress pipeline run"""
        run = FabricPipelineRun(
            id="run-789",
            pipeline_id="pipe-1",
            status="InProgress",
            start_time="2024-01-15T10:00:00Z",
        )

        self.assertEqual(run.status, "InProgress")
        self.assertIsNone(run.end_time)


class FabricPipelineRunStatusTest(TestCase):
    """
    Unit tests for FabricPipelineRunStatus enum
    """

    def test_run_status_values(self):
        """Test all valid run status values"""
        self.assertEqual(FabricPipelineRunStatus.IN_PROGRESS.value, "InProgress")
        self.assertEqual(FabricPipelineRunStatus.COMPLETED.value, "Completed")
        self.assertEqual(FabricPipelineRunStatus.FAILED.value, "Failed")
        self.assertEqual(FabricPipelineRunStatus.CANCELLED.value, "Cancelled")
        self.assertEqual(FabricPipelineRunStatus.NOT_STARTED.value, "NotStarted")
        self.assertEqual(FabricPipelineRunStatus.DEDUPED.value, "Deduped")


class FabricActivityModelTest(TestCase):
    """
    Unit tests for FabricActivity model
    """

    def test_activity_creation(self):
        """Test creating a pipeline activity"""
        activity = FabricActivity(
            name="Copy Data",
            type="Copy",
            description="Copy data from source to destination",
            depends_on=[],
        )

        self.assertEqual(activity.name, "Copy Data")
        self.assertEqual(activity.type, "Copy")
        self.assertEqual(len(activity.depends_on), 0)

    def test_activity_with_dependencies(self):
        """Test activity with dependencies"""
        activity = FabricActivity(
            name="Transform Data",
            type="DataFlow",
            depends_on=[
                {"activity": "Copy Data", "dependencyConditions": ["Succeeded"]},
                {"activity": "Validate Data", "dependencyConditions": ["Succeeded"]},
            ],
        )

        self.assertEqual(len(activity.depends_on), 2)

    def test_activity_from_api_response(self):
        """Test creating activity from API response"""
        data = {
            "name": "Web Activity",
            "type": "WebActivity",
            "description": "Call external API",
            "dependsOn": [
                {"activity": "Previous", "dependencyConditions": ["Succeeded"]}
            ],
            "typeProperties": {"url": "https://api.example.com"},
        }

        activity = FabricActivity.model_validate(data)

        self.assertEqual(activity.name, "Web Activity")
        self.assertEqual(activity.type, "WebActivity")
        self.assertIsNotNone(activity.type_properties)


class ModelSerializationTest(TestCase):
    """
    Unit tests for model serialization
    """

    def test_item_to_dict(self):
        """Test converting model to dictionary"""
        item = FabricItem(
            id="test-id",
            display_name="Test",
            type="Warehouse",
            workspace_id="ws-1",
        )

        item_dict = item.model_dump()

        self.assertIsInstance(item_dict, dict)
        self.assertEqual(item_dict["id"], "test-id")
        self.assertEqual(item_dict["display_name"], "Test")

    def test_item_to_json(self):
        """Test converting model to JSON"""
        item = FabricItem(
            id="json-test",
            display_name="JSON Test",
            type="Lakehouse",
            workspace_id="ws-1",
        )

        json_str = item.model_dump_json()

        self.assertIsInstance(json_str, str)
        self.assertIn("json-test", json_str)

    def test_model_dump_by_alias(self):
        """Test that model can be dumped with camelCase aliases"""
        workspace = FabricWorkspace(
            id="ws-1",
            display_name="Test Workspace",
        )

        # Dump with aliases for API compatibility
        ws_dict = workspace.model_dump(by_alias=True)

        self.assertIn("displayName", ws_dict)
        self.assertEqual(ws_dict["displayName"], "Test Workspace")
