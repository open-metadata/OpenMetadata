"""
Integration tests for SDK fluent API with running OpenMetadata server.

These tests require a running OpenMetadata server at localhost:8585.
Run with: pytest tests/integration/sdk/test_sdk_integration.py
"""
import uuid

import pytest

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.basic import Markdown
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.entities import (
    Databases,
    DatabaseSchemas,
    Glossaries,
    GlossaryTerms,
    Tables,
    Teams,
    Users,
)


@pytest.fixture(scope="module")
def db_service(metadata):
    """Create a test database service"""
    service_name = f"test-sdk-service-{uuid.uuid4().hex[:8]}"

    create_request = CreateDatabaseServiceRequest(
        name=service_name,
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="test",
                authType=BasicAuth(password="test"),
                hostPort="localhost:3306",
            )
        ),
    )

    service = metadata.create_or_update(data=create_request)
    yield service

    # Cleanup
    metadata.delete(
        entity=DatabaseService,
        entity_id=service.id.root,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def test_glossary(metadata):
    """Create a test glossary"""
    glossary_name = f"test-glossary-{uuid.uuid4().hex[:8]}"

    create_request = CreateGlossaryRequest(
        name=glossary_name,
        displayName="Test Glossary",
        description="Glossary for SDK integration tests",
    )

    glossary = metadata.create_or_update(data=create_request)
    yield glossary

    # Cleanup
    metadata.delete(
        entity=Glossary,
        entity_id=glossary.id.root,
        recursive=True,
        hard_delete=True,
    )


class TestSDKIntegration:
    """Test SDK with real OpenMetadata server"""

    def test_tables_crud_operations(self, metadata, db_service):
        """Test CRUD operations on Tables using SDK"""
        # Set the default client
        Tables.set_default_client(metadata)

        # Create database and schema first
        db_name = f"test-db-{uuid.uuid4().hex[:8]}"
        schema_name = f"test-schema-{uuid.uuid4().hex[:8]}"

        db = metadata.create_or_update(
            CreateDatabaseRequest(
                name=db_name,
                service=db_service.fullyQualifiedName.root,
            )
        )

        schema = metadata.create_or_update(
            CreateDatabaseSchemaRequest(
                name=schema_name,
                database=db.fullyQualifiedName.root,
            )
        )

        try:
            # Create a table using SDK
            table_name = f"test-table-{uuid.uuid4().hex[:8]}"
            columns = [
                Column(name="id", dataType=DataType.INT),
                Column(name="name", dataType=DataType.VARCHAR, dataLength=100),
                Column(name="created_at", dataType=DataType.TIMESTAMP),
            ]

            create_request = CreateTableRequest(
                name=table_name,
                databaseSchema=schema.fullyQualifiedName.root,
                columns=columns,
            )

            # Test create
            created_table = Tables.create(create_request)
            assert str(created_table.name.root) == table_name
            assert len(created_table.columns) == 3
            assert str(created_table.columns[0].name.root) == "id"

            # Test retrieve by ID
            table_id = str(created_table.id.root)
            retrieved_table = Tables.retrieve(table_id)
            assert retrieved_table.id == created_table.id
            assert str(retrieved_table.name.root) == table_name

            # Test retrieve by name
            fqn = f"{schema.fullyQualifiedName.root}.{table_name}"
            retrieved_by_name = Tables.retrieve_by_name(fqn)
            assert retrieved_by_name.id == created_table.id

            # Test update - create a modified copy
            modified_table = created_table.model_copy(deep=True)
            modified_table.description = Markdown("Updated description")
            updated_table = Tables.update(modified_table)
            assert updated_table.description.root == "Updated description"

            # Test list
            response = Tables.list(limit=100)
            table_ids = [t.id for t in response.entities]
            assert created_table.id in table_ids

            # Test delete
            Tables.delete(str(created_table.id.root), hard_delete=True)

            # Verify deletion
            with pytest.raises(Exception):
                Tables.retrieve(table_id)

        finally:
            # Cleanup database and schema
            metadata.delete(
                entity=DatabaseSchema,
                entity_id=schema.id.root,
                recursive=True,
                hard_delete=True,
            )
            metadata.delete(
                entity=Database,
                entity_id=db.id.root,
                recursive=True,
                hard_delete=True,
            )

    def test_users_crud_operations(self, metadata):
        """Test CRUD operations on Users using SDK"""
        # Set the default client
        Users.set_default_client(metadata)

        # Create a user
        user_name = f"test-user-{uuid.uuid4().hex[:8]}"
        email = f"{user_name}@example.com"

        create_request = CreateUserRequest(
            name=user_name,
            email=email,
            displayName="Test User",
        )

        # Test create
        created_user = Users.create(create_request)
        assert str(created_user.name.root) == user_name
        assert str(created_user.email.root) == email

        try:
            # Test retrieve
            user_id = str(created_user.id.root)
            retrieved_user = Users.retrieve(user_id)
            assert retrieved_user.id == created_user.id

            # Test retrieve by name
            retrieved_by_name = Users.retrieve_by_name(user_name)
            assert retrieved_by_name.id == created_user.id

            # Test update - create a modified copy
            modified_user = created_user.model_copy(deep=True)
            modified_user.displayName = "Updated Test User"
            updated_user = Users.update(modified_user)
            assert updated_user.displayName == "Updated Test User"

            # Test list - just verify we can list users
            response = Users.list(limit=10)
            assert len(response.entities) > 0
            assert response.entities[0].id is not None

        finally:
            # Cleanup
            Users.delete(user_id, hard_delete=True)

    def test_glossary_terms_workflow(self, metadata, test_glossary):
        """Test glossary and terms workflow using SDK"""
        # Set the default client
        GlossaryTerms.set_default_client(metadata)

        # Create glossary terms
        term1_name = f"term1-{uuid.uuid4().hex[:8]}"
        term2_name = f"term2-{uuid.uuid4().hex[:8]}"

        term1_request = CreateGlossaryTermRequest(
            name=term1_name,
            displayName="Business Term 1",
            description="Description of term 1",
            glossary=test_glossary.fullyQualifiedName.root,
        )

        term2_request = CreateGlossaryTermRequest(
            name=term2_name,
            displayName="Business Term 2",
            description="Description of term 2",
            glossary=test_glossary.fullyQualifiedName.root,
            synonyms=["alternative", "other"],
        )

        # Create terms
        term1 = GlossaryTerms.create(term1_request)
        term2 = GlossaryTerms.create(term2_request)

        try:
            # Verify terms were created
            assert str(term1.name.root) == term1_name
            assert str(term2.name.root) == term2_name
            assert [syn.root for syn in term2.synonyms] == ["alternative", "other"]

            # List terms and verify our terms exist
            # Note: This lists ALL glossary terms in the system, not just ours
            all_terms = GlossaryTerms.list_all(batch_size=100)
            term_ids = [t.id for t in all_terms]
            assert term1.id in term_ids, f"term1 {term1.id} not found in {len(term_ids)} terms"
            assert term2.id in term_ids, f"term2 {term2.id} not found in {len(term_ids)} terms"

            # Retrieve by name
            fqn1 = f"{test_glossary.fullyQualifiedName.root}.{term1_name}"
            retrieved = GlossaryTerms.retrieve_by_name(fqn1)
            assert retrieved.id == term1.id

            # Update term - create a modified copy
            modified_term = term1.model_copy(deep=True)
            modified_term.description = Markdown("Updated description")
            updated = GlossaryTerms.update(modified_term)
            assert updated.description.root == "Updated description"

        finally:
            # Cleanup
            GlossaryTerms.delete(str(term1.id.root), hard_delete=True)
            GlossaryTerms.delete(str(term2.id.root), hard_delete=True)

    def test_teams_workflow(self, metadata):
        """Test teams workflow using SDK"""
        Teams.set_default_client(metadata)

        # Create a team
        team_name = f"test-team-{uuid.uuid4().hex[:8]}"

        create_request = CreateTeamRequest(
            name=team_name,
            displayName="Test Team",
            description="SDK Test Team",
            teamType="Group",
        )

        team = Teams.create(create_request)

        try:
            # Verify team creation
            assert str(team.name.root) == team_name
            assert str(team.teamType) == "Group"

            # Retrieve team
            team_id = str(team.id.root)
            retrieved = Teams.retrieve(team_id)
            assert retrieved.id == team.id

            # List teams
            response = Teams.list(limit=100)
            team_ids = [t.id for t in response.entities]
            assert team.id in team_ids

        finally:
            # Cleanup
            Teams.delete(team_id, hard_delete=True)

    def test_list_all_with_pagination(self, metadata, db_service):
        """Test list_all method with automatic pagination"""
        Databases.set_default_client(metadata)

        # Create multiple databases
        created_dbs = []
        for i in range(5):
            db_name = f"test-pagination-db-{i}-{uuid.uuid4().hex[:8]}"
            db_request = CreateDatabaseRequest(
                name=db_name,
                service=db_service.fullyQualifiedName.root,
            )
            db = metadata.create_or_update(db_request)
            created_dbs.append(db)

        try:
            # Test list_all with small batch size to force pagination
            all_dbs = Databases.list_all(batch_size=2)

            # Verify all created databases are in the results
            all_db_ids = [db.id for db in all_dbs]
            for created_db in created_dbs:
                assert created_db.id in all_db_ids

        finally:
            # Cleanup
            for db in created_dbs:
                metadata.delete(
                    entity=Database,
                    entity_id=db.id.root,
                    recursive=True,
                    hard_delete=True,
                )

    def test_database_schemas_operations(self, metadata, db_service):
        """Test DatabaseSchemas SDK operations"""
        DatabaseSchemas.set_default_client(metadata)

        # Create a database first
        db_name = f"test-schemas-db-{uuid.uuid4().hex[:8]}"
        db = metadata.create_or_update(
            CreateDatabaseRequest(
                name=db_name,
                service=db_service.fullyQualifiedName.root,
            )
        )

        try:
            # Create multiple schemas
            created_schemas = []
            for i in range(3):
                schema_name = f"schema-{i}-{uuid.uuid4().hex[:8]}"
                schema_request = CreateDatabaseSchemaRequest(
                    name=schema_name,
                    database=db.fullyQualifiedName.root,
                )
                schema = DatabaseSchemas.create(schema_request)
                created_schemas.append(schema)

            # Test list
            response = DatabaseSchemas.list(limit=100)
            schema_ids = [s.id for s in response.entities]
            for schema in created_schemas:
                assert schema.id in schema_ids

            # Test retrieve by name
            schema_name_str = str(created_schemas[0].name.root)
            fqn = f"{db.fullyQualifiedName.root}.{schema_name_str}"
            retrieved = DatabaseSchemas.retrieve_by_name(fqn)
            assert retrieved.id == created_schemas[0].id

            # Cleanup schemas
            for schema in created_schemas:
                DatabaseSchemas.delete(str(schema.id.root), hard_delete=True)

        finally:
            # Cleanup database
            metadata.delete(
                entity=Database,
                entity_id=db.id.root,
                recursive=True,
                hard_delete=True,
            )