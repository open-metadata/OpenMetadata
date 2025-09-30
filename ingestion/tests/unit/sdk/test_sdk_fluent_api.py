"""
Integration tests for SDK fluent API with plural entity classes
"""
from unittest.mock import MagicMock, patch
from uuid import UUID

from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User

# Import SDK plural entity classes
from metadata.sdk import (
    Databases,
    DatabaseSchemas,
    Glossaries,
    GlossaryTerms,
    Tables,
    Teams,
    Users,
)


class TestSDKFluentAPI:
    """Test SDK fluent API with plural entity classes"""

    def setup_method(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()

        # Mock the client getter to return our mock
        with patch.object(Tables, "_get_client", return_value=self.mock_ometa):
            with patch.object(Users, "_get_client", return_value=self.mock_ometa):
                with patch.object(
                    Databases, "_get_client", return_value=self.mock_ometa
                ):
                    with patch.object(
                        DatabaseSchemas, "_get_client", return_value=self.mock_ometa
                    ):
                        with patch.object(
                            Teams, "_get_client", return_value=self.mock_ometa
                        ):
                            with patch.object(
                                Glossaries, "_get_client", return_value=self.mock_ometa
                            ):
                                with patch.object(
                                    GlossaryTerms,
                                    "_get_client",
                                    return_value=self.mock_ometa,
                                ):
                                    self.setup_mocks()

    def setup_mocks(self):
        """Setup mock responses"""
        # Mock IDs
        self.table_id = UUID("550e8400-e29b-41d4-a716-446655440000")
        self.user_id = UUID("650e8400-e29b-41d4-a716-446655440000")
        self.database_id = UUID("750e8400-e29b-41d4-a716-446655440000")
        self.schema_id = UUID("850e8400-e29b-41d4-a716-446655440000")
        self.team_id = UUID("950e8400-e29b-41d4-a716-446655440000")
        self.glossary_id = UUID("a50e8400-e29b-41d4-a716-446655440000")
        self.term_id = UUID("b50e8400-e29b-41d4-a716-446655440000")

    @patch.object(Tables, "_get_client")
    def test_tables_create(self, mock_get_client):
        """Test creating a table using Tables SDK"""
        mock_get_client.return_value = self.mock_ometa

        # Arrange
        columns = [
            Column(name="id", dataType=DataType.INT),
            Column(name="name", dataType=DataType.VARCHAR, dataLength=255),
        ]

        create_request = CreateTableRequest(
            name="test_table",
            databaseSchema="test_schema",
            columns=columns,
        )

        mock_table = MagicMock(spec=Table)
        mock_table.id = self.table_id
        mock_table.name = "test_table"
        mock_table.fullyQualifiedName = "service.database.schema.test_table"
        self.mock_ometa.create_or_update.return_value = mock_table

        # Act
        result = Tables.create(create_request)

        # Assert
        assert result.name == "test_table"
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    @patch.object(Tables, "_get_client")
    def test_tables_retrieve_by_name(self, mock_get_client):
        """Test retrieving a table by name using Tables SDK"""
        mock_get_client.return_value = self.mock_ometa

        # Arrange
        mock_table = MagicMock(spec=Table)
        mock_table.id = self.table_id
        mock_table.name = "test_table"
        mock_table.fullyQualifiedName = "service.database.schema.test_table"
        self.mock_ometa.get_by_name.return_value = mock_table

        # Act
        result = Tables.retrieve_by_name("service.database.schema.test_table")

        # Assert
        assert result.name == "test_table"
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=Table, fqn="service.database.schema.test_table", fields=None
        )

    @patch.object(Users, "_get_client")
    def test_users_create(self, mock_get_client):
        """Test creating a user using Users SDK"""
        mock_get_client.return_value = self.mock_ometa

        # Arrange
        create_request = CreateUserRequest(
            name="test_user",
            email="test@example.com",
        )

        mock_user = MagicMock(spec=User)
        mock_user.id = self.user_id
        mock_user.name = "test_user"
        mock_user.email = "test@example.com"
        self.mock_ometa.create_or_update.return_value = mock_user

        # Act
        result = Users.create(create_request)

        # Assert
        assert result.name == "test_user"
        assert result.email == "test@example.com"
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    @patch.object(Databases, "_get_client")
    def test_databases_list(self, mock_get_client):
        """Test listing databases using Databases SDK"""
        mock_get_client.return_value = self.mock_ometa

        # Arrange
        mock_db1 = MagicMock(spec=Database)
        mock_db1.name = "db1"
        mock_db2 = MagicMock(spec=Database)
        mock_db2.name = "db2"

        mock_response = MagicMock()
        mock_response.entities = [mock_db1, mock_db2]
        self.mock_ometa.list_entities.return_value = mock_response

        # Act
        result = Databases.list()

        # Assert
        assert len(result.entities) == 2
        assert result.entities[0].name == "db1"
        assert result.entities[1].name == "db2"
        self.mock_ometa.list_entities.assert_called_once_with(
            entity=Database, fields=None, after=None, before=None, limit=10, params=None
        )

    @patch.object(Teams, "_get_client")
    def test_teams_create_and_delete(self, mock_get_client):
        """Test creating and deleting a team using Teams SDK"""
        mock_get_client.return_value = self.mock_ometa

        # Arrange - Create
        create_request = CreateTeamRequest(
            name="test_team",
            teamType="Group",
        )

        mock_team = MagicMock(spec=Team)
        mock_team.id = self.team_id
        mock_team.name = "test_team"
        self.mock_ometa.create_or_update.return_value = mock_team

        # Act - Create
        created_team = Teams.create(create_request)

        # Assert - Create
        assert created_team.name == "test_team"

        # Arrange - Delete
        self.mock_ometa.delete.return_value = None

        # Act - Delete
        Teams.delete(str(self.team_id))

        # Assert - Delete
        self.mock_ometa.delete.assert_called_once_with(
            entity=Team, entity_id=str(self.team_id), recursive=False, hard_delete=False
        )

    @patch.object(Glossaries, "_get_client")
    @patch.object(GlossaryTerms, "_get_client")
    def test_glossary_and_terms_workflow(self, mock_terms_client, mock_glossary_client):
        """Test creating glossary and terms using SDK"""
        mock_glossary_client.return_value = self.mock_ometa
        mock_terms_client.return_value = self.mock_ometa

        # Create Glossary
        glossary_request = CreateGlossaryRequest(
            name="business_glossary",
            displayName="Business Glossary",
            description="Company business terms",
        )

        mock_glossary = MagicMock(spec=Glossary)
        mock_glossary.id = self.glossary_id
        mock_glossary.name = "business_glossary"
        self.mock_ometa.create_or_update.return_value = mock_glossary

        created_glossary = Glossaries.create(glossary_request)
        assert created_glossary.name == "business_glossary"

        # Create Glossary Term
        term_request = CreateGlossaryTermRequest(
            name="customer",
            displayName="Customer",
            description="A person or organization that buys goods or services",
            glossary="business_glossary",  # Use FQN string
        )

        mock_term = MagicMock(spec=GlossaryTerm)
        mock_term.id = self.term_id
        mock_term.name = "customer"
        mock_term.glossary = mock_glossary
        self.mock_ometa.create_or_update.return_value = mock_term

        created_term = GlossaryTerms.create(term_request)
        assert created_term.name == "customer"

    @patch.object(DatabaseSchemas, "_get_client")
    def test_database_schemas_search(self, mock_get_client):
        """Test searching database schemas using DatabaseSchemas SDK"""
        mock_get_client.return_value = self.mock_ometa

        # Arrange
        mock_schema1 = MagicMock(spec=DatabaseSchema)
        mock_schema1.name = "public"
        mock_schema2 = MagicMock(spec=DatabaseSchema)
        mock_schema2.name = "staging"

        self.mock_ometa.es_search_from_fqn.return_value = [mock_schema1, mock_schema2]

        # Act
        results = DatabaseSchemas.search("staging")

        # Assert
        assert len(results) == 2
        self.mock_ometa.es_search_from_fqn.assert_called_once_with(
            entity_type=DatabaseSchema, fqn_search_string="staging", size=10
        )


class TestSDKEntityTypes:
    """Test that all SDK entities have proper entity_type methods"""

    def test_all_entities_have_entity_type(self):
        """Verify all plural SDK entities implement entity_type method"""
        from metadata.sdk import (
            APICollections,
            APIEndpoints,
            Charts,
            Classifications,
            Containers,
            DashboardDataModels,
            Dashboards,
            Databases,
            DatabaseSchemas,
            DataContracts,
            DataProducts,
            Domains,
            Glossaries,
            GlossaryTerms,
            Metrics,
            MLModels,
            Pipelines,
            Queries,
            SearchIndexes,
            StoredProcedures,
            Tables,
            Tags,
            Teams,
            TestCases,
            TestDefinitions,
            TestSuites,
            Users,
        )

        entities = [
            Tables,
            Users,
            Databases,
            DatabaseSchemas,
            Dashboards,
            Charts,
            Pipelines,
            MLModels,
            Containers,
            Queries,
            Metrics,
            Glossaries,
            GlossaryTerms,
            Classifications,
            Tags,
            Domains,
            DataProducts,
            DataContracts,
            APICollections,
            APIEndpoints,
            SearchIndexes,
            StoredProcedures,
            DashboardDataModels,
            TestCases,
            TestDefinitions,
            TestSuites,
            Teams,
        ]

        for entity_class in entities:
            # Check that entity_type method exists and returns a type
            assert hasattr(
                entity_class, "entity_type"
            ), f"{entity_class.__name__} missing entity_type method"
            entity_type = entity_class.entity_type()
            assert (
                entity_type is not None
            ), f"{entity_class.__name__}.entity_type() returned None"
            assert isinstance(
                entity_type, type
            ), f"{entity_class.__name__}.entity_type() did not return a type"
