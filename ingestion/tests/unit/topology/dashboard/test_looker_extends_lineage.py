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
Test looker view extends lineage functionality
"""
import uuid
from unittest import TestCase
from unittest.mock import Mock, patch

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import StackTraceError
from metadata.ingestion.source.dashboard.looker.metadata import LookerSource
from metadata.ingestion.source.dashboard.looker.models import LookMlView


class LookerExtendsLineageTest(TestCase):
    """
    Test looker view extends lineage functionality
    """

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_LOOKER_CONFIG)
        self.looker = LookerSource.create(
            MOCK_LOOKER_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )

    def test_view_extends_lineage(self):
        """
        Test that lineage is created when a view extends another view
        """
        # Create mock base view data model
        base_view_model = DashboardDataModel(
            id=uuid.uuid4(),
            name="base_view",
            displayName="base_view",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            dataModelType=DataModelType.LookMlView,
            columns=[],
        )

        # Create mock extended view data model
        extended_view_model = DashboardDataModel(
            id=uuid.uuid4(),
            name="extended_view",
            displayName="extended_view",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            dataModelType=DataModelType.LookMlView,
            columns=[],
        )

        # Add base view to cache
        self.looker._views_cache["base_view"] = base_view_model
        self.looker._view_data_model = extended_view_model

        # Create a view that extends another view
        view = LookMlView(
            name="extended_view",
            extends__all=[["base_view"]],
            measures=[],
            dimensions=[],
        )

        # Create mock explore
        mock_explore = Mock()
        mock_explore.model_name = "test_model"
        mock_explore.name = "test_explore"

        # Call add_view_lineage
        lineage_results = list(self.looker.add_view_lineage(view, mock_explore))

        # Filter for AddLineageRequest results
        lineage_requests = [
            result.right
            for result in lineage_results
            if result.right and isinstance(result.right, AddLineageRequest)
        ]

        # Should have at least one lineage request for the extends relationship
        self.assertGreater(
            len(lineage_requests), 0, f"Got lineage requests: {lineage_requests}"
        )

        # Check that one of the lineage requests is from base_view to extended_view
        extends_lineage = None
        for lineage_req in lineage_requests:
            if (
                lineage_req.edge.fromEntity.id.root == base_view_model.id.root
                and lineage_req.edge.toEntity.id.root == extended_view_model.id.root
            ):
                extends_lineage = lineage_req
                break

        self.assertIsNotNone(
            extends_lineage, "Should have lineage from base view to extended view"
        )

    def test_view_extends_multiple_views(self):
        """
        Test that lineage is created when a view extends multiple views
        """
        # Create mock base view data models
        base_view_1 = DashboardDataModel(
            id=uuid.uuid4(),
            name="base_view_1",
            displayName="base_view_1",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            dataModelType=DataModelType.LookMlView,
            columns=[],
        )

        base_view_2 = DashboardDataModel(
            id=uuid.uuid4(),
            name="base_view_2",
            displayName="base_view_2",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            dataModelType=DataModelType.LookMlView,
            columns=[],
        )

        # Create mock extended view data model
        extended_view_model = DashboardDataModel(
            id=uuid.uuid4(),
            name="extended_view",
            displayName="extended_view",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            dataModelType=DataModelType.LookMlView,
            columns=[],
        )

        # Add base views to cache
        self.looker._views_cache["base_view_1"] = base_view_1
        self.looker._views_cache["base_view_2"] = base_view_2
        self.looker._view_data_model = extended_view_model

        # Create a view that extends multiple views
        view = LookMlView(
            name="extended_view",
            extends__all=[["base_view_1", "base_view_2"]],
            measures=[],
            dimensions=[],
        )

        # Create mock explore
        mock_explore = Mock()
        mock_explore.model_name = "test_model"
        mock_explore.name = "test_explore"

        # Call add_view_lineage
        lineage_results = list(self.looker.add_view_lineage(view, mock_explore))

        # Filter for AddLineageRequest results
        lineage_requests = [
            result.right
            for result in lineage_results
            if result.right and isinstance(result.right, AddLineageRequest)
        ]

        # Should have lineage requests for both extended views
        from_entity_ids = {req.edge.fromEntity.id.root for req in lineage_requests}

        self.assertIn(
            base_view_1.id.root,
            from_entity_ids,
            "Should have lineage from base_view_1",
        )
        self.assertIn(
            base_view_2.id.root,
            from_entity_ids,
            "Should have lineage from base_view_2",
        )

    def test_view_extends_missing_view(self):
        """
        Test that no lineage is created when extended view is not in cache
        """
        # Create mock extended view data model
        extended_view_model = DashboardDataModel(
            id=uuid.uuid4(),
            name="extended_view",
            displayName="extended_view",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            dataModelType=DataModelType.LookMlView,
            columns=[],
        )

        self.looker._view_data_model = extended_view_model

        # Create a view that extends a non-existent view
        view = LookMlView(
            name="extended_view",
            extends__all=[["non_existent_view"]],
            measures=[],
            dimensions=[],
        )

        # Create mock explore
        mock_explore = Mock()
        mock_explore.model_name = "test_model"
        mock_explore.name = "test_explore"

        # Call add_view_lineage - should not raise an error
        lineage_results = list(self.looker.add_view_lineage(view, mock_explore))

        # Should not have any errors
        errors = [
            result.left
            for result in lineage_results
            if result.left and isinstance(result.left, StackTraceError)
        ]
        self.assertEqual(len(errors), 0, "Should not have errors for missing views")


MOCK_LOOKER_CONFIG = {
    "source": {
        "type": "looker",
        "serviceName": "test_looker",
        "serviceConnection": {
            "config": {
                "type": "Looker",
                "clientId": "test",
                "clientSecret": "test",
                "hostPort": "https://my-looker.com",
            }
        },
        "sourceConfig": {"config": {"type": "DashboardMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}
