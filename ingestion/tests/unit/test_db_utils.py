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
Unit tests for db_utils module
"""
import uuid
from copy import deepcopy
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Uuid,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.ingestion.source.models import TableView
from metadata.utils.db_utils import get_host_from_host_port, get_view_lineage


# Mock LineageTable class to simulate collate_sqllineage.core.models.Table
class MockLineageTable:
    def __init__(self, name):
        self.raw_name = name
        self.schema = None
        self.catalog = None

    def __str__(self):
        return self.raw_name


class TestDbUtils(TestCase):
    """
    Test cases for db_utils module
    """

    def setUp(self):
        """Set up test fixtures"""
        self.metadata = MagicMock()
        self.service_name = "test_service"
        self.connection_type = "postgres"
        self.timeout_seconds = 30

        # Create a mock table entity
        self.table_entity = Table(
            id=Uuid(root=uuid.uuid4()),
            name=EntityName(root="test_view"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="test_service.test_db.test_schema.test_view"
            ),
            serviceType=DatabaseServiceType.Postgres,
            columns=[],  # Add required columns field
        )

        self.table_entity_non_postgres = deepcopy(self.table_entity)
        self.table_entity_non_postgres.serviceType = DatabaseServiceType.Mysql

        # Create a mock TableView
        self.table_view = TableView(
            table_name="test_view",
            schema_name="test_schema",
            db_name="test_db",
            view_definition="create view test_view as SELECT * FROM source_table",
        )

    def tearDown(self):
        """Clean up after each test"""
        # Reset any module-level state if needed
        pass

    def test_get_host_from_host_port(self):
        """Test get_host_from_host_port function"""
        # Test with host:port format
        self.assertEqual(get_host_from_host_port("localhost:9000"), "localhost")
        self.assertEqual(get_host_from_host_port("127.0.0.1:5432"), "127.0.0.1")
        self.assertEqual(get_host_from_host_port("example.com:8080"), "example.com")

        # Test with host only (no port)
        self.assertEqual(get_host_from_host_port("localhost"), "localhost")
        self.assertEqual(get_host_from_host_port("example.com"), "example.com")

    @patch("metadata.utils.db_utils.ConnectionTypeDialectMapper")
    @patch("metadata.utils.db_utils.LineageParser")
    @patch("metadata.utils.db_utils.fqn")
    def test_get_view_lineage_success_with_lineage_parser(
        self, mock_fqn, mock_lineage_parser_class, mock_dialect_mapper
    ):
        """Test successful view lineage generation when lineage parser has source and target tables"""
        # Setup mocks
        mock_fqn.build.return_value = "test_service.test_db.test_schema.test_view"
        self.metadata.get_by_name.return_value = self.table_entity

        mock_dialect_mapper.dialect_of.return_value = Dialect.POSTGRES

        mock_lineage_parser = MagicMock()
        mock_lineage_parser.source_tables = [MockLineageTable("source_table")]
        mock_lineage_parser.target_tables = [MockLineageTable("test_view")]
        mock_lineage_parser_class.return_value = mock_lineage_parser

        # Mock metadata search methods that get_lineage_by_query will call
        # Create a mock source table entity
        source_table_entity = Table(
            id=Uuid(root=uuid.uuid4()),
            name=EntityName(root="source_table"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="test_service.test_db.test_schema.source_table"
            ),
            serviceType=DatabaseServiceType.Postgres,
            columns=[],
        )

        # Mock the search methods that get_lineage_by_query uses
        # The es_search_from_fqn method will be called with a search string like "test_service.test_db.test_schema.source_table"
        def mock_es_search_from_fqn(entity_type, fqn_search_string, **kwargs):
            if "source_table" in fqn_search_string:
                return [source_table_entity]
            if "test_view" in fqn_search_string:
                return [self.table_entity]
            return []

        self.metadata.es_search_from_fqn = mock_es_search_from_fqn

        # Also mock the get_by_name method that might be called
        def mock_get_by_name(entity, fqn=None, **kwargs):
            if "test_service.test_db.test_schema.test_view" in fqn:
                return self.table_entity
            return None

        self.metadata.get_by_name = mock_get_by_name

        # Execute function
        result = list(
            get_view_lineage(
                view=self.table_view,
                metadata=self.metadata,
                service_names=self.service_name,
                connection_type=self.connection_type,
                timeout_seconds=self.timeout_seconds,
            )
        )

        # Assertions - should get lineage results since we have source and target tables
        self.assertGreater(len(result), 0)

        # Verify mocks were called correctly
        mock_fqn.build.assert_called_once()
        mock_dialect_mapper.dialect_of.assert_called_once_with(self.connection_type)
        mock_lineage_parser_class.assert_called_once()

    @patch("metadata.utils.db_utils.ConnectionTypeDialectMapper")
    @patch("metadata.utils.db_utils.LineageParser")
    @patch("metadata.utils.db_utils.fqn")
    def test_get_view_lineage_success_with_fallback(
        self, mock_fqn, mock_lineage_parser_class, mock_dialect_mapper
    ):
        """Test successful view lineage generation when lineage parser has source and target tables"""
        # Setup mocks
        mock_fqn.build.return_value = "test_service.test_db.test_schema.test_view"
        self.metadata.get_by_name.return_value = self.table_entity
        search_cache.clear()
        mock_dialect_mapper.dialect_of.return_value = Dialect.POSTGRES

        mock_lineage_parser = MagicMock()
        mock_lineage_parser.source_tables = [MockLineageTable("source_table")]
        mock_lineage_parser.target_tables = [MockLineageTable("test_view")]
        mock_lineage_parser_class.return_value = mock_lineage_parser

        # Mock metadata search methods that get_lineage_by_query will call
        # Create a mock source table entity
        source_table_entity = Table(
            id=Uuid(root=uuid.uuid4()),
            name=EntityName(root="source_table"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="test_service.test_db.test_schema.source_table"
            ),
            serviceType=DatabaseServiceType.Postgres,
            columns=[],
        )

        # Mock the search methods that get_lineage_by_query uses
        # The es_search_from_fqn method will be called with a search string like "test_service.test_db.test_schema.source_table"
        def mock_es_search_from_fqn(entity_type, fqn_search_string, **kwargs):
            if "public.source_table" in fqn_search_string:
                return []
            if "source_table" in fqn_search_string:
                return [source_table_entity]
            if "test_view" in fqn_search_string:
                return [self.table_entity]
            return []

        self.metadata.es_search_from_fqn = mock_es_search_from_fqn

        # Also mock the get_by_name method that might be called
        def mock_get_by_name(entity, fqn=None, **kwargs):
            if "test_service.test_db.test_schema.test_view" in fqn:
                return self.table_entity
            return None

        self.metadata.get_by_name = mock_get_by_name

        # Execute function
        result = list(
            get_view_lineage(
                view=self.table_view,
                metadata=self.metadata,
                service_names=self.service_name,
                connection_type=self.connection_type,
                timeout_seconds=self.timeout_seconds,
            )
        )

        # Assertions - should get lineage results since we have source and target tables
        self.assertGreater(len(result), 0)

        # Verify mocks were called correctly
        mock_fqn.build.assert_called_once()
        mock_dialect_mapper.dialect_of.assert_called_once_with(self.connection_type)
        mock_lineage_parser_class.assert_called_once()

    @patch("metadata.utils.db_utils.get_lineage_via_table_entity")
    @patch("metadata.utils.db_utils.ConnectionTypeDialectMapper")
    @patch("metadata.utils.db_utils.LineageParser")
    @patch("metadata.utils.db_utils.fqn")
    def test_get_view_lineage_success_with_table_entity(
        self,
        mock_fqn,
        mock_lineage_parser_class,
        mock_dialect_mapper,
        mock_get_lineage_via_table_entity,
    ):
        """Test successful view lineage generation when lineage parser has no source/target tables"""
        # Setup mocks
        mock_fqn.build.return_value = "test_service.test_db.test_schema.test_view"
        self.metadata.get_by_name.return_value = self.table_entity

        mock_dialect_mapper.dialect_of.return_value = Dialect.POSTGRES

        mock_lineage_parser = MagicMock()
        mock_lineage_parser.source_tables = []  # No source tables
        mock_lineage_parser.target_tables = []  # No target tables
        mock_lineage_parser_class.return_value = mock_lineage_parser

        # Create a valid AddLineageRequest for the mock
        source_table_entity = Table(
            id=Uuid(root=uuid.uuid4()),
            name=EntityName(root="source_table"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="test_service.test_db.test_schema.source_table"
            ),
            serviceType=DatabaseServiceType.Postgres,
            columns=[],
        )

        valid_lineage_request = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(
                    id=source_table_entity.id.root,
                    type="table",
                ),
                toEntity=EntityReference(
                    id=self.table_entity.id.root,
                    type="table",
                ),
            )
        )

        mock_get_lineage_via_table_entity.return_value = [
            Either(right=valid_lineage_request)
        ]

        # Execute function
        result = list(
            get_view_lineage(
                view=self.table_view,
                metadata=self.metadata,
                service_names=self.service_name,
                connection_type=self.connection_type,
                timeout_seconds=self.timeout_seconds,
            )
        )

        # Assertions
        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], Either)
        self.assertIsNotNone(result[0].right)

        # Verify mocks were called correctly
        mock_fqn.build.assert_called_once()
        self.metadata.get_by_name.assert_called_once()
        mock_dialect_mapper.dialect_of.assert_called_once_with(self.connection_type)
        mock_lineage_parser_class.assert_called_once()
        mock_get_lineage_via_table_entity.assert_called_once()

    @patch("metadata.utils.db_utils.ConnectionTypeDialectMapper")
    @patch("metadata.utils.db_utils.LineageParser")
    @patch("metadata.utils.db_utils.fqn")
    def test_get_view_lineage_postgres_schema_fallback(
        self, mock_fqn, mock_lineage_parser_class, mock_dialect_mapper
    ):
        """Test that Postgres views use public schema fallback"""
        # Setup mocks
        mock_fqn.build.return_value = "test_service.test_db.test_schema.test_view"

        # Reset metadata mocks to prevent interference from other tests
        self.metadata.reset_mock()
        self.metadata.get_by_name.return_value = self.table_entity

        mock_dialect_mapper.dialect_of.return_value = Dialect.POSTGRES

        mock_lineage_parser = MagicMock()
        mock_lineage_parser.source_tables = [MockLineageTable("source_table")]
        mock_lineage_parser.target_tables = [MockLineageTable("test_view")]
        mock_lineage_parser_class.return_value = mock_lineage_parser

        # Mock metadata search methods
        source_table_entity = Table(
            id=Uuid(root=uuid.uuid4()),
            name=EntityName(root="source_table"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="test_service.test_db.test_schema.source_table"
            ),
            serviceType=DatabaseServiceType.Postgres,
            columns=[],
        )

        def mock_es_search_from_fqn(entity_type, fqn_search_string, **kwargs):
            if "source_table" in fqn_search_string:
                return [source_table_entity]
            if "test_view" in fqn_search_string:
                return [self.table_entity]
            return []

        self.metadata.es_search_from_fqn = mock_es_search_from_fqn

        def mock_get_by_name(entity, fqn=None, **kwargs):
            if "test_service.test_db.test_schema.test_view" in fqn:
                return self.table_entity
            return None

        self.metadata.get_by_name = mock_get_by_name

        # Execute function
        result = list(
            get_view_lineage(
                view=self.table_view,
                metadata=self.metadata,
                service_names=self.service_name,
                connection_type=self.connection_type,
                timeout_seconds=self.timeout_seconds,
            )
        )

        # Verify that LineageParser was called with the correct parameters
        mock_lineage_parser_class.assert_called_once_with(
            self.table_view.view_definition,
            Dialect.POSTGRES,
            timeout_seconds=self.timeout_seconds,
        )

    @patch("metadata.utils.db_utils.fqn")
    def test_get_view_lineage_no_view_definition(self, mock_fqn):
        """Test handling when view definition is not available"""
        # Setup mock
        mock_fqn.build.return_value = "test_service.test_db.test_schema.test_view"
        self.metadata.get_by_name.return_value = self.table_entity

        # Create TableView without view definition
        table_view_no_definition = TableView(
            table_name="test_view",
            schema_name="test_schema",
            db_name="test_db",
            view_definition=None,
        )

        # Execute function
        result = list(
            get_view_lineage(
                view=table_view_no_definition,
                metadata=self.metadata,
                service_names=self.service_name,
                connection_type=self.connection_type,
                timeout_seconds=self.timeout_seconds,
            )
        )

        # Assertions
        self.assertEqual(len(result), 0)

    @patch("metadata.utils.db_utils.get_lineage_by_query")
    @patch("metadata.utils.db_utils.ConnectionTypeDialectMapper")
    @patch("metadata.utils.db_utils.LineageParser")
    @patch("metadata.utils.db_utils.fqn")
    def test_get_view_lineage_exception_handling(
        self,
        mock_fqn,
        mock_lineage_parser_class,
        mock_dialect_mapper,
        mock_get_lineage_by_query,
    ):
        """Test exception handling during lineage generation"""
        # Setup mocks
        mock_fqn.build.return_value = "test_service.test_db.test_schema.test_view"
        self.metadata.get_by_name.return_value = self.table_entity

        mock_dialect_mapper.dialect_of.return_value = Dialect.POSTGRES

        # Make LineageParser raise an exception
        mock_lineage_parser_class.side_effect = Exception("Test exception")

        # Execute function
        result = list(
            get_view_lineage(
                view=self.table_view,
                metadata=self.metadata,
                service_names=self.service_name,
                connection_type=self.connection_type,
                timeout_seconds=self.timeout_seconds,
            )
        )

        # Assertions
        self.assertEqual(len(result), 0)

    @patch("metadata.utils.db_utils.ConnectionTypeDialectMapper")
    @patch("metadata.utils.db_utils.LineageParser")
    @patch("metadata.utils.db_utils.fqn")
    def test_get_view_lineage_non_postgres_service(
        self, mock_fqn, mock_lineage_parser_class, mock_dialect_mapper
    ):
        """Test view lineage for non-Postgres services"""
        # Setup mocks
        mock_fqn.build.return_value = "test_service.test_db.test_schema.test_view"

        # Reset metadata mocks to prevent interference from other tests
        metadata = MagicMock()
        search_cache.clear()

        mock_dialect_mapper.dialect_of.return_value = Dialect.MYSQL

        mock_lineage_parser = MagicMock()
        mock_lineage_parser.source_tables = [MockLineageTable("source_table")]
        mock_lineage_parser.target_tables = [MockLineageTable("test_view")]
        mock_lineage_parser_class.return_value = mock_lineage_parser

        # Mock metadata search methods that get_lineage_by_query will call
        # Create a mock source table entity
        source_table_entity = Table(
            id=Uuid(root=uuid.uuid4()),
            name=EntityName(root="source_table"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="test_service.test_db.test_schema.source_table"
            ),
            serviceType=DatabaseServiceType.Mysql,
            columns=[],
        )
        table_view = TableView(
            table_name="test_view",
            schema_name="test_schema",
            db_name="test_db",
            view_definition="create view test_view as SELECT * FROM source_table",
        )

        # Mock the search methods that get_lineage_by_query uses
        def mock_es_search_from_fqn(entity_type, fqn_search_string, **kwargs):
            if "source_table" in fqn_search_string:
                return [source_table_entity]
            if "test_view" in fqn_search_string:
                return [self.table_entity_non_postgres]
            return []

        metadata.es_search_from_fqn = mock_es_search_from_fqn

        def mock_get_by_name(entity, fqn=None, **kwargs):
            if "test_service.test_db.test_schema.test_view" in fqn:
                return self.table_entity_non_postgres
            return None

        metadata.get_by_name = mock_get_by_name

        # Execute function with mysql connection type
        result = list(
            get_view_lineage(
                view=table_view,
                metadata=metadata,
                service_names="test_service",
                connection_type="mysql",
                timeout_seconds=self.timeout_seconds,
            )
        )

        # Assertions - should get lineage results since we have source and target tables
        self.assertGreater(len(result), 0)

        # Verify that LineageParser was called with MySQL dialect
        mock_lineage_parser_class.assert_called_once_with(
            self.table_view.view_definition,
            Dialect.MYSQL,
            timeout_seconds=self.timeout_seconds,
        )

    @patch("metadata.utils.db_utils.get_lineage_by_query")
    @patch("metadata.utils.db_utils.ConnectionTypeDialectMapper")
    @patch("metadata.utils.db_utils.LineageParser")
    @patch("metadata.utils.db_utils.fqn")
    def test_get_view_lineage_empty_lineage_results(
        self,
        mock_fqn,
        mock_lineage_parser_class,
        mock_dialect_mapper,
        mock_get_lineage_by_query,
    ):
        """Test handling when lineage functions return empty results"""
        # Setup mocks
        mock_fqn.build.return_value = "test_service.test_db.test_schema.test_view"
        self.metadata.get_by_name.return_value = self.table_entity

        mock_dialect_mapper.dialect_of.return_value = Dialect.POSTGRES

        mock_lineage_parser = MagicMock()
        mock_lineage_parser.source_tables = ["source_table"]
        mock_lineage_parser.target_tables = ["test_view"]
        mock_lineage_parser_class.return_value = mock_lineage_parser

        # Return empty results
        mock_get_lineage_by_query.return_value = []

        # Execute function
        result = list(
            get_view_lineage(
                view=self.table_view,
                metadata=self.metadata,
                service_names=self.service_name,
                connection_type=self.connection_type,
                timeout_seconds=self.timeout_seconds,
            )
        )

        # Assertions
        self.assertEqual(len(result), 0)

    @patch("metadata.utils.db_utils.get_lineage_by_query")
    @patch("metadata.utils.db_utils.ConnectionTypeDialectMapper")
    @patch("metadata.utils.db_utils.LineageParser")
    @patch("metadata.utils.db_utils.fqn")
    def test_get_view_lineage_none_lineage_results(
        self,
        mock_fqn,
        mock_lineage_parser_class,
        mock_dialect_mapper,
        mock_get_lineage_by_query,
    ):
        """Test handling when lineage functions return None"""
        # Setup mocks
        mock_fqn.build.return_value = "test_service.test_db.test_schema.test_view"
        self.metadata.get_by_name.return_value = self.table_entity

        mock_dialect_mapper.dialect_of.return_value = Dialect.POSTGRES

        mock_lineage_parser = MagicMock()
        mock_lineage_parser.source_tables = ["source_table"]
        mock_lineage_parser.target_tables = ["test_view"]
        mock_lineage_parser_class.return_value = mock_lineage_parser

        # Return None
        mock_get_lineage_by_query.return_value = None

        # Execute function
        result = list(
            get_view_lineage(
                view=self.table_view,
                metadata=self.metadata,
                service_names=self.service_name,
                connection_type=self.connection_type,
                timeout_seconds=self.timeout_seconds,
            )
        )

        # Assertions
        self.assertEqual(len(result), 0)

    def test_get_view_lineage_invalid_connection_type(self):
        """Test handling of invalid connection type"""
        # Execute function with invalid connection type
        result = list(
            get_view_lineage(
                view=self.table_view,
                metadata=self.metadata,
                service_names=self.service_name,
                connection_type=123,  # Invalid type
                timeout_seconds=self.timeout_seconds,
            )
        )

        # Should handle gracefully and return empty result
        self.assertEqual(len(result), 0)

    @patch("metadata.utils.db_utils.ConnectionTypeDialectMapper")
    @patch("metadata.utils.db_utils.LineageParser")
    @patch("metadata.utils.db_utils.fqn")
    def test_get_view_lineage_custom_timeout(
        self, mock_fqn, mock_lineage_parser_class, mock_dialect_mapper
    ):
        """Test that custom timeout is passed correctly"""
        # Setup mocks
        mock_fqn.build.return_value = "test_service.test_db.test_schema.test_view"
        self.metadata.get_by_name.return_value = self.table_entity

        mock_dialect_mapper.dialect_of.return_value = Dialect.POSTGRES

        mock_lineage_parser = MagicMock()
        mock_lineage_parser.source_tables = [MockLineageTable("source_table")]
        mock_lineage_parser.target_tables = [MockLineageTable("test_view")]
        mock_lineage_parser_class.return_value = mock_lineage_parser

        # Mock metadata search methods that get_lineage_by_query will call
        source_table_entity = Table(
            id=Uuid(root=uuid.uuid4()),
            name=EntityName(root="source_table"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="test_service.test_db.test_schema.source_table"
            ),
            serviceType=DatabaseServiceType.Postgres,
            columns=[],
        )

        def mock_es_search_from_fqn(entity_type, fqn_search_string, **kwargs):
            if "source_table" in fqn_search_string:
                return [source_table_entity]
            return []

        self.metadata.es_search_from_fqn = mock_es_search_from_fqn

        custom_timeout = 60

        # Execute function with custom timeout
        result = list(
            get_view_lineage(
                view=self.table_view,
                metadata=self.metadata,
                service_names=self.service_name,
                connection_type=self.connection_type,
                timeout_seconds=custom_timeout,
            )
        )

        # Verify that LineageParser was called with custom timeout
        mock_lineage_parser_class.assert_called_once_with(
            self.table_view.view_definition,
            Dialect.POSTGRES,
            timeout_seconds=custom_timeout,
        )
