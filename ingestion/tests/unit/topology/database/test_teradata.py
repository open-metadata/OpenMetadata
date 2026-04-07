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

        # Mock rows as objects with _asdict() to mimic SQLAlchemy Row
        row1 = MagicMock()
        row1._asdict.return_value = {
            "procedure_name": "sp_include",
            "database_schema": "test_schema",
            "procedure_type": "SQL",
            "definition": "def1",
        }
        row2 = MagicMock()
        row2._asdict.return_value = {
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

        # Each engine.connect() call creates a new context manager.
        # The first call lists procedures, subsequent calls describe each one.
        mock_conn_list = MagicMock()
        mock_conn_list.execute.return_value = mock_list_result

        mock_conn_desc1 = MagicMock()
        mock_conn_desc1.execute.return_value = mock_desc_result1

        mock_conn_desc2 = MagicMock()
        mock_conn_desc2.execute.return_value = mock_desc_result2

        ctx_list = MagicMock()
        ctx_list.__enter__ = MagicMock(return_value=mock_conn_list)
        ctx_list.__exit__ = MagicMock(return_value=False)

        ctx_desc1 = MagicMock()
        ctx_desc1.__enter__ = MagicMock(return_value=mock_conn_desc1)
        ctx_desc1.__exit__ = MagicMock(return_value=False)

        ctx_desc2 = MagicMock()
        ctx_desc2.__enter__ = MagicMock(return_value=mock_conn_desc2)
        ctx_desc2.__exit__ = MagicMock(return_value=False)

        mock_engine.connect.side_effect = [ctx_list, ctx_desc1, ctx_desc2]

        results = list(self.teradata_source.get_stored_procedures())

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].procedure_name, "sp_include")


class TestTeradataColumnComments:
    def test_get_columns_strips_whitespace_from_comments(self, monkeypatch):
        from metadata.ingestion.source.database.teradata.utils import get_columns

        mock_upstream_columns = [
            {
                "name": "id",
                "type": MagicMock(),
                "nullable": False,
                "CommentString": "  Primary key  ",
            },
            {
                "name": "name",
                "type": MagicMock(),
                "nullable": True,
                "CommentString": "User name",
            },
        ]
        mock_original = MagicMock(return_value=mock_upstream_columns)
        monkeypatch.setattr(get_columns, "_original", mock_original)

        result = get_columns(
            MagicMock(), MagicMock(), "test_table", schema="test_schema"
        )

        assert result[0]["comment"] == "Primary key"
        assert result[1]["comment"] == "User name"

    def test_get_columns_handles_null_and_empty_comments(self, monkeypatch):
        from metadata.ingestion.source.database.teradata.utils import get_columns

        mock_upstream_columns = [
            {"name": "col1", "type": MagicMock(), "CommentString": None},
            {"name": "col2", "type": MagicMock(), "CommentString": "   "},
            {"name": "col3", "type": MagicMock()},  # No CommentString key
        ]
        mock_original = MagicMock(return_value=mock_upstream_columns)
        monkeypatch.setattr(get_columns, "_original", mock_original)

        result = get_columns(
            MagicMock(), MagicMock(), "test_table", schema="test_schema"
        )

        assert result[0]["comment"] is None
        assert result[1]["comment"] is None
        assert result[2]["comment"] is None

    def test_get_columns_handles_normalized_commentstring(self, monkeypatch):
        from metadata.ingestion.source.database.teradata.utils import get_columns

        # Test with normalized lowercase key (as upstream might normalize it)
        mock_upstream_columns = [
            {"name": "col1", "type": MagicMock(), "commentstring": "Lowercase comment"},
        ]
        mock_original = MagicMock(return_value=mock_upstream_columns)
        monkeypatch.setattr(get_columns, "_original", mock_original)

        result = get_columns(
            MagicMock(), MagicMock(), "test_table", schema="test_schema"
        )

        assert result[0]["comment"] == "Lowercase comment"
