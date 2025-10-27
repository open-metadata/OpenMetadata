"""
Unit tests for custom property operations in SDK.
"""
from unittest.mock import Mock, patch
from uuid import UUID

from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type import basic
from metadata.sdk.entities.custom_properties import (
    CustomProperties,
    CustomPropertyUpdater,
    GlossaryCustomProperties,
    TableCustomProperties,
)


class TestCustomPropertyUpdater:
    """Test CustomPropertyUpdater class."""

    def test_with_property(self):
        """Test adding a single property."""
        updater = CustomPropertyUpdater(Table, "test-id")
        updater.with_property("key1", "value1")
        assert updater.properties == {"key1": "value1"}

    def test_with_properties(self):
        """Test adding multiple properties."""
        updater = CustomPropertyUpdater(Table, "test-id")
        properties = {"key1": "value1", "key2": "value2"}
        updater.with_properties(properties)
        assert updater.properties == properties

    def test_clear_property(self):
        """Test clearing a specific property."""
        updater = CustomPropertyUpdater(Table, "test-id")
        updater.with_property("key1", "value1")
        updater.clear_property("key1")
        assert updater.properties == {"key1": None}

    def test_clear_all(self):
        """Test clearing all properties."""
        updater = CustomPropertyUpdater(Table, "test-id")
        updater.with_property("key1", "value1")
        updater.clear_all()
        assert updater.clear_all_flag is True

    @patch("metadata.sdk.entities.custom_properties.CustomPropertyUpdater._get_client")
    def test_execute_with_new_properties(self, mock_get_client):
        """Test executing update with new properties."""
        # Setup mock client
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        # Setup mock entity
        mock_table = Mock(spec=Table)
        mock_table.extension = None
        mock_table.model_copy = Mock(return_value=mock_table)
        mock_client.get_by_id.return_value = mock_table

        # Create updated entity
        updated_table = Mock(spec=Table)
        mock_client.patch.return_value = updated_table

        # Execute update
        updater = CustomPropertyUpdater(Table, "test-id")
        updater.with_property("businessImportance", "HIGH")
        result = updater.execute()

        # Verify
        mock_client.get_by_id.assert_called_once_with(
            entity=Table, entity_id="test-id", fields=["extension"]
        )
        mock_client.patch.assert_called_once()
        assert result == updated_table

    @patch("metadata.sdk.entities.custom_properties.CustomPropertyUpdater._get_client")
    def test_execute_with_existing_extension(self, mock_get_client):
        """Test updating entity with existing extension."""
        # Setup mock client
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        # Setup mock entity with existing extension
        mock_table = Mock(spec=Table)
        existing_extension = basic.EntityExtension(
            root={"existingKey": "existingValue"}
        )
        mock_table.extension = existing_extension
        mock_table_copy = Mock(spec=Table)
        mock_table.model_copy = Mock(return_value=mock_table_copy)
        mock_client.get_by_id.return_value = mock_table

        # Create updated entity
        updated_table = Mock(spec=Table)
        mock_client.patch.return_value = updated_table

        # Execute update
        updater = CustomPropertyUpdater(Table, "test-id")
        updater.with_property("newKey", "newValue")
        result = updater.execute()

        # Verify the extension was updated correctly
        mock_client.patch.assert_called_once()
        args = mock_client.patch.call_args
        assert args[1]["destination"].extension.root == {
            "existingKey": "existingValue",
            "newKey": "newValue",
        }

    @patch("metadata.sdk.entities.custom_properties.CustomPropertyUpdater._get_client")
    def test_execute_clear_all(self, mock_get_client):
        """Test clearing all custom properties."""
        # Setup mock client
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        # Setup mock entity with existing extension
        mock_table = Mock(spec=Table)
        existing_extension = basic.EntityExtension(
            root={"key1": "value1", "key2": "value2"}
        )
        mock_table.extension = existing_extension
        mock_table_copy = Mock(spec=Table)
        mock_table_copy.extension = None
        mock_table.model_copy = Mock(return_value=mock_table_copy)
        mock_client.get_by_id.return_value = mock_table

        # Create updated entity
        updated_table = Mock(spec=Table)
        mock_client.patch.return_value = updated_table

        # Execute clear all
        updater = CustomPropertyUpdater(Table, "test-id")
        updater.clear_all()
        result = updater.execute()

        # Verify extension was cleared
        mock_client.patch.assert_called_once()
        args = mock_client.patch.call_args
        assert args[1]["destination"].extension is None

    @patch("metadata.sdk.entities.custom_properties.CustomPropertyUpdater._get_client")
    def test_execute_by_fqn(self, mock_get_client):
        """Test updating entity by FQN."""
        # Setup mock client
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        # Setup mock entity
        mock_table = Mock(spec=Table)
        mock_table.extension = None
        mock_table.model_copy = Mock(return_value=mock_table)
        mock_client.get_by_name.return_value = mock_table

        # Create updated entity
        updated_table = Mock(spec=Table)
        mock_client.patch.return_value = updated_table

        # Execute update by FQN
        updater = CustomPropertyUpdater(
            Table, "service.database.schema.table", is_fqn=True
        )
        updater.with_property("key", "value")
        result = updater.execute()

        # Verify get_by_name was called
        mock_client.get_by_name.assert_called_once_with(
            entity=Table, fqn="service.database.schema.table", fields=["extension"]
        )


class TestCustomProperties:
    """Test CustomProperties factory class."""

    def test_update(self):
        """Test creating updater by ID."""
        updater = CustomProperties.update(Table, "test-id")
        assert isinstance(updater, CustomPropertyUpdater)
        assert updater.entity_type == Table
        assert updater.identifier == "test-id"
        assert updater.is_fqn is False

    def test_update_with_uuid(self):
        """Test creating updater with UUID."""
        test_uuid = UUID("12345678-1234-5678-1234-567812345678")
        updater = CustomProperties.update(Table, test_uuid)
        assert updater.identifier == str(test_uuid)

    def test_update_by_name(self):
        """Test creating updater by name/FQN."""
        updater = CustomProperties.update_by_name(
            Table, "service.database.schema.table"
        )
        assert isinstance(updater, CustomPropertyUpdater)
        assert updater.entity_type == Table
        assert updater.identifier == "service.database.schema.table"
        assert updater.is_fqn is True


class TestTableCustomProperties:
    """Test Table-specific custom property methods."""

    def test_update(self):
        """Test creating table updater by ID."""
        updater = TableCustomProperties.update("test-id")
        assert isinstance(updater, CustomPropertyUpdater)
        assert updater.entity_type == Table
        assert updater.identifier == "test-id"

    def test_update_by_name(self):
        """Test creating table updater by FQN."""
        updater = TableCustomProperties.update_by_name("service.database.schema.table")
        assert isinstance(updater, CustomPropertyUpdater)
        assert updater.entity_type == Table
        assert updater.identifier == "service.database.schema.table"
        assert updater.is_fqn is True


class TestGlossaryCustomProperties:
    """Test Glossary-specific custom property methods."""

    def test_update(self):
        """Test creating glossary updater by ID."""
        updater = GlossaryCustomProperties.update("test-id")
        assert isinstance(updater, CustomPropertyUpdater)
        assert updater.entity_type == Glossary
        assert updater.identifier == "test-id"

    def test_update_by_name(self):
        """Test creating glossary updater by name."""
        updater = GlossaryCustomProperties.update_by_name("BusinessGlossary")
        assert isinstance(updater, CustomPropertyUpdater)
        assert updater.entity_type == Glossary
        assert updater.identifier == "BusinessGlossary"
        assert updater.is_fqn is True


class TestIntegrationWithBaseEntity:
    """Test integration with BaseEntity class."""

    @patch("metadata.sdk.entities.base.BaseEntity._get_client")
    def test_update_custom_properties_from_base_entity(self, mock_get_client):
        """Test using custom properties through BaseEntity."""
        from metadata.sdk import Tables

        # Setup mock client
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        # Setup mock entity
        mock_table = Mock(spec=Table)
        mock_table.extension = None
        mock_table.model_copy = Mock(return_value=mock_table)
        mock_client.get_by_id.return_value = mock_table
        mock_client.patch.return_value = mock_table

        # Use BaseEntity method
        updater = Tables.update_custom_properties("test-id")
        assert isinstance(updater, CustomPropertyUpdater)

        # Execute update
        result = updater.with_property("key", "value").execute()
        assert result == mock_table

    @patch("metadata.sdk.entities.base.BaseEntity._get_client")
    def test_update_custom_properties_by_name_from_base_entity(self, mock_get_client):
        """Test using custom properties by name through BaseEntity."""
        from metadata.sdk import Tables

        # Setup mock client
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        # Setup mock entity
        mock_table = Mock(spec=Table)
        mock_table.extension = None
        mock_table.model_copy = Mock(return_value=mock_table)
        mock_client.get_by_name.return_value = mock_table
        mock_client.patch.return_value = mock_table

        # Use BaseEntity method
        updater = Tables.update_custom_properties_by_name(
            "service.database.schema.table"
        )
        assert isinstance(updater, CustomPropertyUpdater)

        # Execute update
        result = updater.with_property("key", "value").execute()
        assert result == mock_table


class TestFluentChaining:
    """Test fluent API chaining."""

    @patch("metadata.sdk.entities.custom_properties.CustomPropertyUpdater._get_client")
    def test_fluent_chaining(self, mock_get_client):
        """Test chaining multiple operations."""
        # Setup mock client
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        # Setup mock entity
        mock_table = Mock(spec=Table)
        mock_table.extension = None
        mock_table.model_copy = Mock(return_value=mock_table)
        mock_client.get_by_id.return_value = mock_table
        mock_client.patch.return_value = mock_table

        # Test fluent chaining
        result = (
            CustomProperties.update(Table, "test-id")
            .with_property("key1", "value1")
            .with_property("key2", "value2")
            .with_properties({"key3": "value3", "key4": "value4"})
            .clear_property("key1")
            .execute()
        )

        assert result == mock_table
        mock_client.patch.assert_called_once()
