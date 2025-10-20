"""
Comprehensive unit tests for User entity with full mock coverage.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.teams.user import AuthenticationMechanism
from metadata.generated.schema.entity.teams.user import User as UserEntity
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk import Users


class TestUserEntity(unittest.TestCase):
    """Comprehensive tests for User entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()

        # Set default client directly
        Users.set_default_client(self.mock_ometa)

        # Test data
        self.user_id = "350e8400-e29b-41d4-a716-446655440000"
        self.user_fqn = "john.doe"

    def test_create_user(self):
        """Test creating a user"""
        # Arrange
        create_request = CreateUserRequest(
            name="john.doe",
            email="john.doe@company.com",
            displayName="John Doe",
            description="Senior Data Engineer",
        )

        expected_user = MagicMock(spec=UserEntity)
        expected_user.id = UUID(self.user_id)
        expected_user.name = "john.doe"
        expected_user.email = "john.doe@company.com"
        expected_user.displayName = "John Doe"

        self.mock_ometa.create_or_update.return_value = expected_user

        # Act
        result = Users.create(create_request)

        # Assert
        self.assertEqual(str(result.id), self.user_id)
        self.assertEqual(result.name, "john.doe")
        self.assertEqual(result.email, "john.doe@company.com")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_user_by_id(self):
        """Test retrieving a user by ID"""
        # Arrange
        expected_user = MagicMock(spec=UserEntity)
        expected_user.id = UUID(self.user_id)
        expected_user.name = "john.doe"
        expected_user.description = "Senior Data Engineer"

        self.mock_ometa.get_by_id.return_value = expected_user

        # Act
        result = Users.retrieve(self.user_id)

        # Assert
        self.assertEqual(str(result.id), self.user_id)
        self.assertEqual(result.name, "john.doe")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=UserEntity, entity_id=self.user_id, fields=None
        )

    def test_retrieve_user_with_teams(self):
        """Test retrieving user with team memberships"""
        # Arrange
        fields = ["teams", "roles", "owns"]

        # Mock teams
        team1 = EntityReference(
            id=UUID("350e8400-e29b-41d4-a716-446655440000"),
            type="team",
            name="data-engineering",
        )
        team2 = EntityReference(
            id=UUID("450e8400-e29b-41d4-a716-446655440000"),
            type="team",
            name="analytics",
        )

        expected_user = MagicMock(spec=UserEntity)
        expected_user.id = UUID(self.user_id)
        expected_user.name = "john.doe"
        expected_user.teams = [team1, team2]

        self.mock_ometa.get_by_id.return_value = expected_user

        # Act
        result = Users.retrieve(self.user_id, fields=fields)

        # Assert
        self.assertIsNotNone(result.teams)
        self.assertEqual(len(result.teams), 2)
        self.assertEqual(result.teams[0].name, "data-engineering")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=UserEntity, entity_id=self.user_id, fields=fields
        )

    def test_retrieve_user_by_name(self):
        """Test retrieving a user by name"""
        # Arrange
        expected_user = MagicMock(spec=UserEntity)
        expected_user.id = UUID(self.user_id)
        expected_user.name = "john.doe"
        expected_user.fullyQualifiedName = self.user_fqn

        self.mock_ometa.get_by_name.return_value = expected_user

        # Act
        result = Users.retrieve_by_name(self.user_fqn)

        # Assert
        self.assertEqual(result.fullyQualifiedName, self.user_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=UserEntity, fqn=self.user_fqn, fields=None
        )

    def test_update_user(self):
        """Test updating a user"""
        # Arrange
        user_to_update = MagicMock(spec=UserEntity)
        user_to_update.id = UUID(self.user_id)
        user_to_update.name = "john.doe"
        user_to_update.description = "Principal Data Engineer"

        # Mock the get_by_id to return the current state
        current_entity = MagicMock(spec=type(user_to_update))
        current_entity.id = (
            user_to_update.id if hasattr(user_to_update, "id") else UUID(self.entity_id)
        )
        self.mock_ometa.get_by_id.return_value = current_entity

        # Mock the patch to return the updated entity
        self.mock_ometa.patch.return_value = user_to_update

        # Act
        result = Users.update(user_to_update)

        # Assert
        self.assertEqual(result.description, "Principal Data Engineer")
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_delete_user(self):
        """Test deleting a user"""
        # Act
        Users.delete(self.user_id, recursive=False, hard_delete=True)

        # Assert
        self.mock_ometa.delete.assert_called_once_with(
            entity=UserEntity, entity_id=self.user_id, recursive=False, hard_delete=True
        )

    def test_user_with_authentication(self):
        """Test user with authentication mechanism"""
        # Arrange
        auth_mechanism = MagicMock(spec=AuthenticationMechanism)
        auth_mechanism.authType = "JWT"

        expected_user = MagicMock(spec=UserEntity)
        expected_user.id = UUID(self.user_id)
        expected_user.authenticationMechanism = auth_mechanism

        self.mock_ometa.get_by_id.return_value = expected_user

        # Act
        result = Users.retrieve(self.user_id, fields=["authenticationMechanism"])

        # Assert
        self.assertIsNotNone(result.authenticationMechanism)
        self.assertEqual(result.authenticationMechanism.authType, "JWT")

    def test_user_with_roles(self):
        """Test user with assigned roles"""
        # Arrange
        role1 = EntityReference(
            id=UUID("550e8400-e29b-41d4-a716-446655440000"),
            type="role",
            name="DataEngineer",
        )
        role2 = EntityReference(
            id=UUID("650e8400-e29b-41d4-a716-446655440000"), type="role", name="Admin"
        )

        expected_user = MagicMock(spec=UserEntity)
        expected_user.id = UUID(self.user_id)
        expected_user.roles = [role1, role2]
        expected_user.isAdmin = True

        self.mock_ometa.get_by_id.return_value = expected_user

        # Act
        result = Users.retrieve(self.user_id, fields=["roles"])

        # Assert
        self.assertIsNotNone(result.roles)
        self.assertEqual(len(result.roles), 2)
        self.assertEqual(result.roles[0].name, "DataEngineer")
        self.assertEqual(result.isAdmin, True)

    def test_user_ownership(self):
        """Test user ownership of assets"""
        # Arrange
        owned_table = EntityReference(
            id=UUID("750e8400-e29b-41d4-a716-446655440000"),
            type="table",
            name="analytics.users",
        )
        owned_dashboard = EntityReference(
            id=UUID("850e8400-e29b-41d4-a716-446655440000"),
            type="dashboard",
            name="user-metrics",
        )

        expected_user = MagicMock(spec=UserEntity)
        expected_user.id = UUID(self.user_id)
        expected_user.owns = [owned_table, owned_dashboard]

        self.mock_ometa.get_by_id.return_value = expected_user

        # Act
        result = Users.retrieve(self.user_id, fields=["owns"])

        # Assert
        self.assertIsNotNone(result.owns)
        self.assertEqual(len(result.owns), 2)
        self.assertEqual(result.owns[0].name, "analytics.users")

    def test_user_with_profile(self):
        """Test user with profile information"""
        # Arrange
        profile = MagicMock()
        profile.images = MagicMock()
        profile.images.image = "https://company.com/avatars/john.doe.png"
        profile.images.image24 = "https://company.com/avatars/john.doe_24.png"

        expected_user = MagicMock(spec=UserEntity)
        expected_user.id = UUID(self.user_id)
        expected_user.profile = profile

        self.mock_ometa.get_by_id.return_value = expected_user

        # Act
        result = Users.retrieve(self.user_id, fields=["profile"])

        # Assert
        self.assertIsNotNone(result.profile)
        self.assertEqual(
            result.profile.images.image, "https://company.com/avatars/john.doe.png"
        )

    def test_list_users(self):
        """Test listing users with pagination"""
        # Arrange
        mock_user1 = MagicMock(spec=UserEntity)
        mock_user1.name = "user1"
        mock_user2 = MagicMock(spec=UserEntity)
        mock_user2.name = "user2"
        mock_user3 = MagicMock(spec=UserEntity)
        mock_user3.name = "user3"

        mock_response = MagicMock()
        mock_response.entities = [mock_user1, mock_user2, mock_user3]

        self.mock_ometa.list_entities.return_value = mock_response

        # Act
        result = Users.list(limit=20, fields=["teams", "roles"])

        # Assert
        self.assertEqual(len(result.entities), 3)
        self.assertEqual(result.entities[0].name, "user1")
        self.mock_ometa.list_entities.assert_called_once()

    def test_user_follows(self):
        """Test user following entities"""
        # Arrange
        followed_table = EntityReference(
            id=UUID("950e8400-e29b-41d4-a716-446655440000"),
            type="table",
            name="important.metrics",
        )

        expected_user = MagicMock(spec=UserEntity)
        expected_user.id = UUID(self.user_id)
        expected_user.follows = [followed_table]

        self.mock_ometa.get_by_id.return_value = expected_user

        # Act
        result = Users.retrieve(self.user_id, fields=["follows"])

        # Assert
        self.assertIsNotNone(result.follows)
        self.assertEqual(result.follows[0].name, "important.metrics")

    def test_error_handling_user_not_found(self):
        """Test error handling when user not found"""
        # Arrange
        self.mock_ometa.get_by_id.side_effect = Exception("User not found")

        # Act & Assert
        with self.assertRaises(Exception) as context:
            Users.retrieve("non-existent-id")

        self.assertIn("User not found", str(context.exception))


if __name__ == "__main__":
    unittest.main()
