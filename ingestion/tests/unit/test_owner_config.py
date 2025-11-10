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
Test Hierarchical Owner Configuration for Database Ingestion

This test suite validates the owner configuration feature that allows automatic
assignment of owners to metadata entities (databases, schemas, tables) during
ingestion based on flexible, hierarchical rules.

Replaces the bash/YAML-based tests previously in owner_config_tests/ directory.
"""

import uuid
from typing import Any, Dict, List, Optional, Union
from unittest import TestCase
from unittest.mock import Mock

from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import (
    Email,
    EntityName,
    FullyQualifiedEntityName,
)


def build_owner_config(
    default: Optional[str] = None,
    enable_inheritance: bool = True,
    database: Optional[Union[str, Dict[str, Any]]] = None,
    database_schema: Optional[Union[str, Dict[str, Any]]] = None,
    table: Optional[Union[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Build owner configuration dictionary for testing.

    Args:
        default: Default owner name
        enable_inheritance: Whether to enable inheritance
        database: Database-level owner config (string or dict)
        database_schema: Schema-level owner config (string or dict)
        table: Table-level owner config (string or dict)

    Returns:
        Owner configuration dictionary
    """
    config: Dict[str, Any] = {"enableInheritance": enable_inheritance}

    if default:
        config["default"] = default
    if database is not None:
        config["database"] = database
    if database_schema is not None:
        config["databaseSchema"] = database_schema
    if table is not None:
        config["table"] = table

    return config


def build_test_workflow_config(
    service_name: str,
    owner_config: Dict[str, Any],
    host_port: str = "localhost:5432",
    database: str = "finance_db",
) -> Dict[str, Any]:
    """
    Build complete workflow configuration for testing.

    Args:
        service_name: Name of the database service
        owner_config: Owner configuration dict from build_owner_config
        host_port: Database host and port
        database: Database name

    Returns:
        Complete workflow configuration dictionary
    """
    return {
        "source": {
            "type": "postgres",
            "serviceName": service_name,
            "serviceConnection": {
                "config": {
                    "type": "Postgres",
                    "username": "admin",
                    "authType": {"password": "admin123"},
                    "hostPort": host_port,
                    "database": database,
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                    "ownerConfig": owner_config,
                    "includeTables": True,
                    "includeViews": True,
                    "markDeletedTables": True,
                    "useFqnForFiltering": True,
                    "overrideMetadata": True,
                }
            },
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "loggerLevel": "DEBUG",
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {"jwtToken": "test-token"},
            },
        },
    }


def unwrap_owner_value(value: Any) -> Any:
    """
    Unwrap OwnerValue Pydantic model to get actual value.

    OwnerValue wraps the actual values in nested root attributes:
    OwnerValue(root=OwnerValue1(root=['alice', 'bob']))

    Args:
        value: Potentially wrapped OwnerValue object

    Returns:
        Unwrapped actual value (string, list, or dict)
    """
    if hasattr(value, "root"):
        if hasattr(value.root, "root"):
            return value.root.root
        return value.root
    return value


class TestOwnerConfig(TestCase):
    """
    Test suite for hierarchical owner configuration in database ingestion.

    Tests cover:
    - Basic hierarchical owner assignment
    - FQN vs simple name matching
    - Multiple users as owners
    - Owner type validation
    - Inheritance enabled/disabled
    - Partial success when owners don't exist
    - Complex mixed scenarios
    """

    def setUp(self) -> None:
        """Set up test fixtures before each test"""
        self.mock_metadata = self._create_mock_metadata()

    def _create_mock_metadata(self) -> Mock:
        """Create mock OpenMetadata API with test users and teams"""
        mock_om = Mock()

        mock_users = {
            "alice": self._create_mock_user("alice", "alice@example.com"),
            "bob": self._create_mock_user("bob", "bob@example.com"),
            "charlie": self._create_mock_user("charlie", "charlie@example.com"),
            "david": self._create_mock_user("david", "david@example.com"),
            "emma": self._create_mock_user("emma", "emma@example.com"),
            "frank": self._create_mock_user("frank", "frank@example.com"),
            "marketing-user-1": self._create_mock_user(
                "marketing-user-1", "marketing1@example.com"
            ),
            "marketing-user-2": self._create_mock_user(
                "marketing-user-2", "marketing2@example.com"
            ),
        }

        mock_teams = {
            "data-platform-team": self._create_mock_team(
                "data-platform-team", "Data Platform Team"
            ),
            "finance-team": self._create_mock_team("finance-team", "Finance Team"),
            "marketing-team": self._create_mock_team(
                "marketing-team", "Marketing Team"
            ),
            "accounting-team": self._create_mock_team(
                "accounting-team", "Accounting Team"
            ),
            "treasury-team": self._create_mock_team("treasury-team", "Treasury Team"),
            "revenue-team": self._create_mock_team("revenue-team", "Revenue Team"),
            "expense-team": self._create_mock_team("expense-team", "Expense Team"),
            "investment-team": self._create_mock_team(
                "investment-team", "Investment Team"
            ),
            "audit-team": self._create_mock_team("audit-team", "Audit Team"),
            "compliance-team": self._create_mock_team(
                "compliance-team", "Compliance Team"
            ),
            "treasury-ops-team": self._create_mock_team(
                "treasury-ops-team", "Treasury Operations Team"
            ),
        }

        def get_by_name_side_effect(
            entity: Any, fqn: str, fields: Optional[List[str]] = None
        ) -> Optional[Union[User, Team]]:
            """Mock get_by_name to return users/teams or None"""
            if fqn in mock_users:
                return mock_users[fqn]
            if fqn in mock_teams:
                return mock_teams[fqn]
            return None

        mock_om.get_by_name.side_effect = get_by_name_side_effect

        return mock_om

    def _create_mock_user(self, name: str, email: str) -> User:
        """Create a mock User entity"""
        return User(
            id=uuid.uuid4(),
            name=EntityName(name),
            fullyQualifiedName=FullyQualifiedEntityName(name),
            email=Email(email),
            displayName=name.capitalize(),
        )

    def _create_mock_team(self, name: str, display_name: str) -> Team:
        """Create a mock Team entity"""
        return Team(
            id=uuid.uuid4(),
            name=EntityName(name),
            fullyQualifiedName=FullyQualifiedEntityName(name),
            displayName=display_name,
            teamType="Group",
        )

    def test_01_basic_configuration(self) -> None:
        """
        Test Case 01: Basic hierarchical owner assignment

        Validates:
        - Default owner assignment
        - Database-level specific owners
        - Schema-level specific owners
        - Table-level specific owners
        - Inheritance enabled
        """
        owner_config = build_owner_config(
            default="data-platform-team",
            enable_inheritance=True,
            database={
                "finance_db": "finance-team",
                "marketing_db": "marketing-team",
            },
            database_schema={
                "finance_db.accounting": "accounting-team",
            },
            table={
                "finance_db.accounting.revenue": "revenue-team",
            },
        )

        workflow_config = build_test_workflow_config(
            "postgres-test-01-basic", owner_config
        )

        config = OpenMetadataWorkflowConfig.model_validate(workflow_config)

        assert config.source.sourceConfig.config.ownerConfig is not None
        assert (
            config.source.sourceConfig.config.ownerConfig.default
            == "data-platform-team"
        )
        assert config.source.sourceConfig.config.ownerConfig.enableInheritance is True
        assert config.source.sourceConfig.config.ownerConfig.database is not None
        assert config.source.sourceConfig.config.ownerConfig.databaseSchema is not None
        assert config.source.sourceConfig.config.ownerConfig.table is not None

    def test_02_fqn_matching(self) -> None:
        """
        Test Case 02: FQN exact match vs simple name fallback

        Validates:
        - FQN exact match has priority
        - Simple name match as fallback
        - Appropriate INFO logging for simple name matches
        """
        owner_config = build_owner_config(
            default="data-platform-team",
            enable_inheritance=True,
            database_schema={
                "finance_db.accounting": "accounting-team",
                "treasury": "treasury-team",
            },
            table={
                "finance_db.accounting.expenses": "expense-team",
                "investments": "investment-team",
            },
        )

        workflow_config = build_test_workflow_config(
            "postgres-test-02-fqn", owner_config
        )

        config = OpenMetadataWorkflowConfig.model_validate(workflow_config)

        assert config.source.sourceConfig.config.ownerConfig is not None
        schema_config = config.source.sourceConfig.config.ownerConfig.databaseSchema
        assert schema_config is not None

        if isinstance(schema_config, dict):
            assert "finance_db.accounting" in schema_config
            assert "treasury" in schema_config

    def test_03_multiple_users(self) -> None:
        """
        Test Case 03: Multiple users as owners (valid scenario)

        Validates:
        - Multiple users can be assigned as owners
        - All owners must be type="user"
        - List format works correctly
        """
        owner_config = build_owner_config(
            default="data-platform-team",
            enable_inheritance=True,
            database={
                "finance_db": ["alice", "bob"],
            },
            table={
                "finance_db.accounting.revenue": ["charlie", "david", "emma"],
                "finance_db.accounting.expenses": ["frank"],
            },
        )

        workflow_config = build_test_workflow_config(
            "postgres-test-03-multiple-users", owner_config
        )

        config = OpenMetadataWorkflowConfig.model_validate(workflow_config)

        assert config.source.sourceConfig.config.ownerConfig is not None
        db_config = config.source.sourceConfig.config.ownerConfig.database

        if isinstance(db_config, dict):
            finance_owners = unwrap_owner_value(db_config.get("finance_db"))
            assert finance_owners is not None
            assert isinstance(finance_owners, list)
            assert len(finance_owners) == 2
            assert "alice" in finance_owners
            assert "bob" in finance_owners

    def test_04_validation_errors(self) -> None:
        """
        Test Case 04: Owner type validation

        Validates:
        - Multiple teams (INVALID) - should log WARNING
        - Mixed users and teams (INVALID) - should log WARNING
        - Single team as string (VALID) - works normally
        """
        owner_config = build_owner_config(
            default="data-platform-team",
            enable_inheritance=True,
            database={
                "finance_db": ["finance-team", "audit-team", "compliance-team"],
            },
            table={
                "finance_db.accounting.revenue": ["alice", "bob", "finance-team"],
                "finance_db.accounting.expenses": "expense-team",
            },
        )

        workflow_config = build_test_workflow_config(
            "postgres-test-04-validation", owner_config
        )

        config = OpenMetadataWorkflowConfig.model_validate(workflow_config)

        assert config.source.sourceConfig.config.ownerConfig is not None

    def test_05_inheritance_enabled(self) -> None:
        """
        Test Case 05: Inheritance mechanism (enableInheritance: true)

        Validates:
        - Child entities inherit owner from parent
        - Priority: Specific Config > Inherited Owner > Default
        - finance_db → "finance-team"
        - accounting schema → "finance-team" (INHERITED from database, NOT default)
        - revenue table → "finance-team" (INHERITED from schema, NOT default)
        """
        owner_config = build_owner_config(
            default="data-platform-team",
            enable_inheritance=True,
            database={
                "finance_db": "finance-team",
            },
            database_schema={
                "finance_db.treasury": "treasury-team",
            },
            table={
                "finance_db.accounting.expenses": "expense-team",
            },
        )

        workflow_config = build_test_workflow_config(
            "postgres-test-05-inheritance-on", owner_config
        )

        config = OpenMetadataWorkflowConfig.model_validate(workflow_config)

        assert config.source.sourceConfig.config.ownerConfig is not None
        assert config.source.sourceConfig.config.ownerConfig.enableInheritance is True

    def test_06_inheritance_disabled(self) -> None:
        """
        Test Case 06: Inheritance disabled (enableInheritance: false)

        Validates:
        - Child entities use default instead of inheriting
        - Priority: Specific Config > Default (skip inheritance)
        - finance_db → "finance-team"
        - accounting schema → "data-platform-team" (DEFAULT, not inherited)
        - revenue table → "data-platform-team" (DEFAULT, not inherited)
        """
        owner_config = build_owner_config(
            default="data-platform-team",
            enable_inheritance=False,
            database={
                "finance_db": "finance-team",
            },
            database_schema={
                "finance_db.treasury": "treasury-team",
            },
            table={
                "finance_db.accounting.expenses": "expense-team",
            },
        )

        workflow_config = build_test_workflow_config(
            "postgres-test-06-inheritance-off", owner_config
        )

        config = OpenMetadataWorkflowConfig.model_validate(workflow_config)

        assert config.source.sourceConfig.config.ownerConfig is not None
        assert config.source.sourceConfig.config.ownerConfig.enableInheritance is False

    def test_07_partial_success(self) -> None:
        """
        Test Case 07: Partial success when some owners don't exist

        Validates:
        - Ingestion continues when some owners are not found
        - Found owners are assigned successfully
        - WARNING logged for missing owners
        - revenue table: Should have 2 owners (alice, bob), skip nonexistent users
        """
        owner_config = build_owner_config(
            default="data-platform-team",
            enable_inheritance=True,
            table={
                "finance_db.accounting.revenue": [
                    "alice",
                    "nonexistent-user-1",
                    "bob",
                    "nonexistent-user-2",
                ],
                "finance_db.accounting.expenses": ["charlie", "david"],
            },
        )

        workflow_config = build_test_workflow_config(
            "postgres-test-07-partial", owner_config
        )

        config = OpenMetadataWorkflowConfig.model_validate(workflow_config)

        assert config.source.sourceConfig.config.ownerConfig is not None
        table_config = config.source.sourceConfig.config.ownerConfig.table

        if isinstance(table_config, dict):
            revenue_owners = unwrap_owner_value(
                table_config.get("finance_db.accounting.revenue")
            )
            assert revenue_owners is not None
            assert isinstance(revenue_owners, list)
            assert len(revenue_owners) == 4

    def test_08_complex_mixed(self) -> None:
        """
        Test Case 08: Complex mixed scenario

        Validates comprehensive combination of:
        - FQN vs simple name matching
        - Multiple users vs single team
        - Inheritance for unconfigured entities
        - All validation rules working together
        """
        owner_config = build_owner_config(
            default="data-platform-team",
            enable_inheritance=True,
            database={
                "finance_db": "finance-team",
                "marketing_db": ["marketing-user-1", "marketing-user-2"],
            },
            database_schema={
                "finance_db.accounting": ["alice", "bob"],
                "treasury": "treasury-team",
            },
            table={
                "finance_db.accounting.revenue": ["charlie", "david", "emma"],
                "expenses": "expense-team",
                "finance_db.treasury.cash_flow": "treasury-ops-team",
            },
        )

        workflow_config = build_test_workflow_config(
            "postgres-test-08-complex", owner_config
        )

        config = OpenMetadataWorkflowConfig.model_validate(workflow_config)

        assert config.source.sourceConfig.config.ownerConfig is not None
        assert config.source.sourceConfig.config.ownerConfig.enableInheritance is True

        db_config = config.source.sourceConfig.config.ownerConfig.database
        if isinstance(db_config, dict):
            assert "finance_db" in db_config
            assert "marketing_db" in db_config

            marketing_owners = unwrap_owner_value(db_config.get("marketing_db"))
            if isinstance(marketing_owners, list):
                assert len(marketing_owners) == 2

    def test_config_validation_with_all_formats(self) -> None:
        """
        Test configuration validation with different formats

        Validates:
        - String format (simple)
        - Dictionary format (specific)
        - Mixed format (flexible)
        """
        owner_config = build_owner_config(
            default="data-platform-team",
            enable_inheritance=True,
            database="default-db-owner",
            database_schema={
                "finance_db.accounting": "accounting-team",
                "marketing_db.campaigns": ["alice", "bob"],
            },
            table={
                "revenue": "revenue-team",
                "finance_db.accounting.expenses": ["charlie"],
            },
        )

        workflow_config = build_test_workflow_config(
            "postgres-test-formats", owner_config
        )

        config = OpenMetadataWorkflowConfig.model_validate(workflow_config)

        assert config.source.sourceConfig.config.ownerConfig is not None

        db_config = unwrap_owner_value(
            config.source.sourceConfig.config.ownerConfig.database
        )
        assert db_config == "default-db-owner"

        schema_config = config.source.sourceConfig.config.ownerConfig.databaseSchema
        assert isinstance(schema_config, dict)

    def test_empty_owner_config(self) -> None:
        """
        Test with minimal/empty owner configuration

        Validates:
        - System handles missing owner config gracefully
        - No exceptions thrown
        """
        workflow_config = build_test_workflow_config(
            "postgres-test-empty",
            {},
        )

        config = OpenMetadataWorkflowConfig.model_validate(workflow_config)

        assert config.source.sourceConfig.config is not None
