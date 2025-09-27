"""
Comprehensive unit tests for Team entity with full mock coverage.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.entity.teams.team import Team as TeamEntity
from metadata.generated.schema.entity.teams.team import TeamType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk import Teams


class TestTeamEntity(unittest.TestCase):
    """Comprehensive tests for Team entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()

        # Set default client directly
        Teams.set_default_client(self.mock_ometa)

        # Test data
        self.team_id = "950e8400-e29b-41d4-a716-446655440000"
        self.team_fqn = "data-engineering"

    def test_create_team(self):
        """Test creating a team"""
        # Arrange
        create_request = CreateTeamRequest(
            name="data-engineering",
            displayName="Data Engineering",
            description="Data Engineering team",
            teamType=TeamType.Department.value,
        )

        expected_team = MagicMock(spec=TeamEntity)
        expected_team.id = UUID(self.team_id)
        expected_team.name = "data-engineering"
        expected_team.displayName = "Data Engineering"
        expected_team.teamType = TeamType.Department

        self.mock_ometa.create_or_update.return_value = expected_team

        # Act
        result = Teams.create(create_request)

        # Assert
        self.assertEqual(str(result.id), self.team_id)
        self.assertEqual(result.name, "data-engineering")
        self.assertEqual(result.displayName, "Data Engineering")
        self.assertEqual(result.teamType, TeamType.Department)
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_team_by_id(self):
        """Test retrieving a team by ID"""
        # Arrange
        expected_team = MagicMock(spec=TeamEntity)
        expected_team.id = UUID(self.team_id)
        expected_team.name = "data-engineering"
        expected_team.description = "Core Data Engineering team"

        self.mock_ometa.get_by_id.return_value = expected_team

        # Act
        result = Teams.retrieve(self.team_id)

        # Assert
        self.assertEqual(str(result.id), self.team_id)
        self.assertEqual(result.name, "data-engineering")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=TeamEntity, entity_id=self.team_id, fields=None
        )

    def test_retrieve_team_with_users(self):
        """Test retrieving team with users"""
        # Arrange
        fields = ["users", "defaultRoles", "owns"]

        # Mock users
        user1 = EntityReference(
            id=UUID("450e8400-e29b-41d4-a716-446655440001"),
            type="user",
            name="john.doe",
        )
        user2 = EntityReference(
            id=UUID("450e8400-e29b-41d4-a716-446655440002"),
            type="user",
            name="jane.smith",
        )

        expected_team = MagicMock(spec=TeamEntity)
        expected_team.id = UUID(self.team_id)
        expected_team.name = "data-engineering"
        expected_team.users = [user1, user2]
        expected_team.userCount = 2

        self.mock_ometa.get_by_id.return_value = expected_team

        # Act
        result = Teams.retrieve(self.team_id, fields=fields)

        # Assert
        self.assertIsNotNone(result.users)
        self.assertEqual(len(result.users), 2)
        self.assertEqual(result.users[0].name, "john.doe")
        self.assertEqual(result.userCount, 2)
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=TeamEntity, entity_id=self.team_id, fields=fields
        )

    def test_retrieve_team_by_name(self):
        """Test retrieving a team by name"""
        # Arrange
        expected_team = MagicMock(spec=TeamEntity)
        expected_team.id = UUID(self.team_id)
        expected_team.name = "data-engineering"
        expected_team.fullyQualifiedName = self.team_fqn

        self.mock_ometa.get_by_name.return_value = expected_team

        # Act
        result = Teams.retrieve_by_name(self.team_fqn)

        # Assert
        self.assertEqual(result.fullyQualifiedName, self.team_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=TeamEntity, fqn=self.team_fqn, fields=None
        )

    def test_update_team(self):
        """Test updating a team"""
        # Arrange
        team_to_update = MagicMock(spec=TeamEntity)
        team_to_update.id = UUID(self.team_id)
        team_to_update.name = "data-engineering"
        team_to_update.description = "Updated Data Engineering team"

        # Mock the get_by_id to return the current state
        current_entity = MagicMock(spec=type(team_to_update))
        current_entity.id = (
            team_to_update.id if hasattr(team_to_update, "id") else UUID(self.entity_id)
        )
        self.mock_ometa.get_by_id.return_value = current_entity

        # Mock the patch to return the updated entity
        self.mock_ometa.patch.return_value = team_to_update

        # Act
        result = Teams.update(team_to_update)

        # Assert
        self.assertEqual(result.description, "Updated Data Engineering team")
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_delete_team(self):
        """Test deleting a team"""
        # Act
        Teams.delete(self.team_id, recursive=False, hard_delete=False)

        # Assert
        self.mock_ometa.delete.assert_called_once_with(
            entity=TeamEntity,
            entity_id=self.team_id,
            recursive=False,
            hard_delete=False,
        )

    def test_team_hierarchy(self):
        """Test team with parent/children hierarchy"""
        # Arrange
        parent_team = EntityReference(
            id=UUID("250e8400-e29b-41d4-a716-446655440000"),
            type="team",
            name="engineering",
        )

        child_team1 = EntityReference(
            id=UUID("150e8400-e29b-41d4-a716-446655440001"),
            type="team",
            name="data-engineering-analytics",
        )

        expected_team = MagicMock(spec=TeamEntity)
        expected_team.id = UUID(self.team_id)
        expected_team.name = "data-engineering"
        expected_team.parents = [parent_team]
        expected_team.children = [child_team1]

        self.mock_ometa.get_by_id.return_value = expected_team

        # Act
        result = Teams.retrieve(self.team_id, fields=["parents", "children"])

        # Assert
        self.assertIsNotNone(result.parents)
        self.assertEqual(result.parents[0].name, "engineering")
        self.assertIsNotNone(result.children)
        self.assertEqual(result.children[0].name, "data-engineering-analytics")

    def test_team_with_default_roles(self):
        """Test team with default roles"""
        # Arrange
        role1 = EntityReference(
            id=UUID("550e8400-e29b-41d4-a716-446655440000"),
            type="role",
            name="DataEngineer",
        )
        role2 = EntityReference(
            id=UUID("650e8400-e29b-41d4-a716-446655440000"),
            type="role",
            name="DataAnalyst",
        )

        expected_team = MagicMock(spec=TeamEntity)
        expected_team.id = UUID(self.team_id)
        expected_team.defaultRoles = [role1, role2]

        self.mock_ometa.get_by_id.return_value = expected_team

        # Act
        result = Teams.retrieve(self.team_id, fields=["defaultRoles"])

        # Assert
        self.assertIsNotNone(result.defaultRoles)
        self.assertEqual(len(result.defaultRoles), 2)
        self.assertEqual(result.defaultRoles[0].name, "DataEngineer")

    def test_team_ownership(self):
        """Test team ownership of assets"""
        # Arrange
        owned_table = EntityReference(
            id=UUID("750e8400-e29b-41d4-a716-446655440000"),
            type="table",
            name="analytics.users",
        )
        owned_dashboard = EntityReference(
            id=UUID("850e8400-e29b-41d4-a716-446655440000"),
            type="dashboard",
            name="team-dashboard",
        )

        expected_team = MagicMock(spec=TeamEntity)
        expected_team.id = UUID(self.team_id)
        expected_team.owns = [owned_table, owned_dashboard]

        self.mock_ometa.get_by_id.return_value = expected_team

        # Act
        result = Teams.retrieve(self.team_id, fields=["owns"])

        # Assert
        self.assertIsNotNone(result.owns)
        self.assertEqual(len(result.owns), 2)
        self.assertEqual(result.owns[0].name, "analytics.users")
        self.assertEqual(result.owns[1].name, "team-dashboard")

    def test_list_teams(self):
        """Test listing teams"""
        # Arrange
        mock_team1 = MagicMock(spec=TeamEntity)
        mock_team1.name = "team1"
        mock_team2 = MagicMock(spec=TeamEntity)
        mock_team2.name = "team2"
        mock_team3 = MagicMock(spec=TeamEntity)
        mock_team3.name = "team3"

        mock_response = MagicMock()
        mock_response.entities = [mock_team1, mock_team2, mock_team3]

        self.mock_ometa.list_entities.return_value = mock_response

        # Act
        result = Teams.list(fields=["users", "owns", "defaultRoles"])

        # Assert
        self.assertEqual(len(result.entities), 3)
        self.assertEqual(result.entities[0].name, "team1")
        self.mock_ometa.list_entities.assert_called_once()

    def test_team_with_profile(self):
        """Test team with profile information"""
        # Arrange
        profile = MagicMock()
        profile.images = MagicMock()
        profile.images.image = "https://company.com/teams/data-eng.png"

        expected_team = MagicMock(spec=TeamEntity)
        expected_team.id = UUID(self.team_id)
        expected_team.profile = profile

        self.mock_ometa.get_by_id.return_value = expected_team

        # Act
        result = Teams.retrieve(self.team_id, fields=["profile"])

        # Assert
        self.assertIsNotNone(result.profile)
        self.assertEqual(
            result.profile.images.image, "https://company.com/teams/data-eng.png"
        )


if __name__ == "__main__":
    unittest.main()
