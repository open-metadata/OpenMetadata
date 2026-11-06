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
Test Greenplum using the topology
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.greenplum.metadata import GreenplumSource

mock_greenplum_config = {
    "source": {
        "type": "greenplum",
        "serviceName": "local_greenplum1",
        "serviceConnection": {
            "config": {
                "type": "Greenplum",
                "username": "username",
                "authType": {
                    "password": "password",
                },
                "hostPort": "localhost:5432",
                "database": "greenplum",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "greenplum"},
        }
    },
}


class greenplumUnitTest(TestCase):  # noqa: N801
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def __init__(self, methodName, test_connection) -> None:  # noqa: N803
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_greenplum_config)
        self.greenplum_source = GreenplumSource.create(
            mock_greenplum_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    @patch("sqlalchemy.engine.base.Engine")
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection")
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.greenplum_source.close()

    def test_query_view_names_and_types_includes_materialized_views(self):
        """
        includeViews=True: materialized views are emitted as MaterializedView
        alongside regular views (#31515).
        """
        mock_inspector = MagicMock()
        mock_inspector.get_view_names.return_value = ["regular_view"]
        mock_inspector.get_materialized_view_names.return_value = ["my_matview"]

        with patch.object(GreenplumSource, "inspector", mock_inspector):
            results = list(self.greenplum_source.query_view_names_and_types("public"))

        self.assertEqual(
            {result.name: result.type_ for result in results},
            {
                "regular_view": TableType.View,
                "my_matview": TableType.MaterializedView,
            },
        )

    def test_regular_views_survive_matview_lookup_failure(self):
        """
        Greenplum versions without materialized-view support must still yield
        regular views instead of losing the whole schema.
        """
        mock_inspector = MagicMock()
        mock_inspector.get_view_names.return_value = ["regular_view"]
        mock_inspector.get_materialized_view_names.side_effect = Exception("unsupported")

        with patch.object(GreenplumSource, "inspector", mock_inspector):
            results = list(self.greenplum_source.query_view_names_and_types("public"))

        self.assertEqual([(r.name, r.type_) for r in results], [("regular_view", TableType.View)])
