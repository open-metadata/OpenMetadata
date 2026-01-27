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
Test Teradata using the topology
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.source.database.teradata.metadata import TeradataSource

mock_teradata_config = {
    "source": {
        "type": "teradata",
        "serviceName": "local_teradata",
        "serviceConnection": {
            "config": {
                "type": "Teradata",
                "hostPort": "localhost:1025",
                "username": "dbc",
                "password": "dbc",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "includeStoredProcedures": True,
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
            "securityConfig": {"jwtToken": "teradata"},
        }
    },
}


class TeradataUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_teradata_config)
        self.teradata_source = TeradataSource.create(
            mock_teradata_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.teradata_source.context.get().__dict__[
            "database_service"
        ] = "teradata_service"

    def test_get_stored_procedures(self):
        """
        Test fetching stored procedures with filter
        """
        self.teradata_source.source_config.includeStoredProcedures = True
        self.teradata_source.source_config.storedProcedureFilterPattern = FilterPattern(
            excludes=["sp_exclude"]
        )
        self.teradata_source.context.get().__dict__[
            "database_service"
        ] = "teradata_source"
        self.teradata_source.context.get().__dict__["database"] = "test_db"
        self.teradata_source.context.get().__dict__["database_schema"] = "test_schema"

        mock_engine = MagicMock()
        self.teradata_source.engine = mock_engine

        # Mock rows
        row1 = {
            "procedure_name": "sp_include",
            "database_schema": "test_schema",
            "procedure_type": "SQL",
            "definition": "def1",
        }
        row2 = {
            "procedure_name": "sp_exclude",
            "database_schema": "test_schema",
            "procedure_type": "SQL",
            "definition": "def2",
        }

        mock_list_result = MagicMock()
        mock_list_result.all.return_value = [row1, row2]

        mock_desc_result1 = MagicMock()
        mock_desc_result1.first.return_value = ["def1"]

        mock_desc_result2 = MagicMock()
        mock_desc_result2.first.return_value = ["def2"]

        mock_engine.execute.side_effect = [
            mock_list_result,
            mock_desc_result1,
            mock_desc_result2,
        ]

        results = list(self.teradata_source.get_stored_procedures())

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].procedure_name, "sp_include")
