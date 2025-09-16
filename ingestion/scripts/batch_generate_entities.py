#!/usr/bin/env python3
"""
Batch generator for OpenMetadata SDK entities.
This script generates entity classes and their comprehensive tests.
"""

import os
import re

# Entity configurations
ENTITIES = {
    # Data Assets
    "StoredProcedure": {
        "api_path": "data",
        "entity_path": "data",
        "display_name": "Stored Procedure",
        "has_code": True,
        "has_queries": True,
    },
    "SearchIndex": {
        "api_path": "data",
        "entity_path": "data",
        "display_name": "Search Index",
        "has_fields": True,
        "has_settings": True,
    },
    "Query": {
        "api_path": "data",
        "entity_path": "data",
        "display_name": "Query",
        "has_sql": True,
        "has_votes": True,
    },
    "DashboardDataModel": {
        "api_path": "data",
        "entity_path": "data",
        "display_name": "Dashboard Data Model",
        "has_columns": True,
        "has_sql": True,
    },
    "APIEndpoint": {
        "api_path": "data",
        "entity_path": "data",
        "display_name": "API Endpoint",
        "has_request_schema": True,
        "has_response_schema": True,
    },
    "APICollection": {
        "api_path": "data",
        "entity_path": "data",
        "display_name": "API Collection",
        "has_endpoints": True,
    },
    # Governance
    "Classification": {
        "api_path": "classification",
        "entity_path": "classification",
        "display_name": "Classification",
        "has_tags": True,
    },
    "Tag": {
        "api_path": "classification",
        "entity_path": "classification",
        "display_name": "Tag",
        "has_classification": True,
    },
    "Domain": {
        "api_path": "domains",
        "entity_path": "domains",
        "display_name": "Domain",
        "has_assets": True,
        "has_experts": True,
    },
    "DataProduct": {
        "api_path": "domains",
        "entity_path": "domains",
        "display_name": "Data Product",
        "has_assets": True,
        "has_domain": True,
    },
    # Data Quality
    "TestCase": {
        "api_path": "dataQuality",
        "entity_path": "dataQuality",
        "display_name": "Test Case",
        "has_test_suite": True,
        "has_test_definition": True,
    },
    "TestSuite": {
        "api_path": "dataQuality",
        "entity_path": "dataQuality",
        "display_name": "Test Suite",
        "has_tests": True,
        "has_executions": True,
    },
    "TestDefinition": {
        "api_path": "dataQuality",
        "entity_path": "dataQuality",
        "display_name": "Test Definition",
        "has_parameters": True,
        "has_test_platforms": True,
    },
}


def to_snake_case(name):
    """Convert CamelCase to snake_case."""
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def generate_entity_class(name, config):
    """Generate entity class code."""
    snake_name = to_snake_case(name)

    template = f'''"""
{config["display_name"]} entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional, Union

from metadata.generated.schema.api.{config["api_path"]}.create{name} import Create{name}Request
from metadata.generated.schema.entity.{config["entity_path"]}.{snake_name} import {name} as {name}Entity
from metadata.sdk.entities.base import BaseEntity


class {name}(BaseEntity):
    """{config["display_name"]} entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return {name}Entity

    @classmethod
    def create(cls, request: Create{name}Request) -> {name}Entity:
        """
        Create a new {snake_name.replace('_', ' ')}.

        Args:
            request: Create{name}Request with {snake_name.replace('_', ' ')} details

        Returns:
            Created {name} entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> {name}Entity:
        """
        Retrieve a {snake_name.replace('_', ' ')} by ID.

        Args:
            entity_id: {name} UUID
            fields: Optional list of fields to include

        Returns:
            {name} entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity={name}Entity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> {name}Entity:
        """
        Retrieve a {snake_name.replace('_', ' ')} by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            {name} entity
        """
        client = cls._get_client()
        return client.get_by_name(entity={name}Entity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, entity: {name}Entity) -> {name}Entity:
        """
        Update a {snake_name.replace('_', ' ')} (PUT operation).

        Args:
            entity_id: {name} UUID
            entity: Updated {name} entity

        Returns:
            Updated {name} entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> {name}Entity:
        """
        Patch a {snake_name.replace('_', ' ')} (PATCH operation).

        Args:
            entity_id: {name} UUID
            json_patch: JSON patch operations

        Returns:
            Patched {name} entity
        """
        client = cls._get_client()
        return client.patch(
            entity={name}Entity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a {snake_name.replace('_', ' ')}.

        Args:
            entity_id: {name} UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity={name}Entity,
            entity_id=entity_id,
            recursive=recursive,
            hard_delete=hard_delete,
        )

    @classmethod
    def list(
        cls,
        fields: Optional[List[str]] = None,
        after: Optional[str] = None,
        before: Optional[str] = None,
        limit: int = 100,
    ) -> List[{name}Entity]:
        """
        List {snake_name.replace('_', ' ')}s.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of {name} entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity={name}Entity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
'''
    return template


def generate_test_class(name, config):
    """Generate test class code."""
    snake_name = to_snake_case(name)

    template = f'''"""
Comprehensive unit tests for {config["display_name"]} entity.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.{config["api_path"]}.create{name} import Create{name}Request
from metadata.generated.schema.entity.{config["entity_path"]}.{snake_name} import {name} as {name}Entity
from metadata.sdk.entities.{snake_name.replace("_", "")} import {name}


class Test{name}Entity(unittest.TestCase):
    """Comprehensive tests for {name} entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        {name}._default_client = self.mock_ometa

        self.entity_id = "550e8400-e29b-41d4-a716-446655440000"
        self.entity_fqn = "service.{snake_name}.test_{snake_name}"

    def test_create_{snake_name}(self):
        """Test creating a {snake_name.replace('_', ' ')}"""
        create_request = Create{name}Request(
            name="test_{snake_name}",
            displayName="Test {config['display_name']}",
            description="Test {snake_name.replace('_', ' ')} for unit tests",
        )

        expected_entity = MagicMock(spec={name}Entity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_{snake_name}"

        self.mock_ometa.create_or_update.return_value = expected_entity

        result = {name}.create(create_request)

        self.assertEqual(str(result.id), self.entity_id)
        self.assertEqual(result.name, "test_{snake_name}")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_{snake_name}_by_id(self):
        """Test retrieving a {snake_name.replace('_', ' ')} by ID"""
        expected_entity = MagicMock(spec={name}Entity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_{snake_name}"

        self.mock_ometa.get_by_id.return_value = expected_entity

        result = {name}.retrieve(self.entity_id)

        self.assertEqual(str(result.id), self.entity_id)
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity={name}Entity, entity_id=self.entity_id, fields=None
        )

    def test_retrieve_{snake_name}_by_name(self):
        """Test retrieving a {snake_name.replace('_', ' ')} by name"""
        expected_entity = MagicMock(spec={name}Entity)
        expected_entity.fullyQualifiedName = self.entity_fqn

        self.mock_ometa.get_by_name.return_value = expected_entity

        result = {name}.retrieve_by_name(self.entity_fqn)

        self.assertEqual(result.fullyQualifiedName, self.entity_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity={name}Entity, fqn=self.entity_fqn, fields=None
        )

    def test_update_{snake_name}(self):
        """Test updating a {snake_name.replace('_', ' ')}"""
        entity_to_update = MagicMock(spec={name}Entity)
        entity_to_update.id = UUID(self.entity_id)
        entity_to_update.description = "Updated description"

        self.mock_ometa.create_or_update.return_value = entity_to_update

        result = {name}.update(self.entity_id, entity_to_update)

        self.assertEqual(result.description, "Updated description")
        self.mock_ometa.create_or_update.assert_called_once_with(entity_to_update)

    def test_patch_{snake_name}(self):
        """Test patching a {snake_name.replace('_', ' ')}"""
        json_patch = [
            {{"op": "add", "path": "/description", "value": "Patched description"}},
            {{"op": "add", "path": "/tags/0", "value": {{"tagFQN": "Important.High"}}}},
        ]

        patched_entity = MagicMock(spec={name}Entity)
        patched_entity.id = UUID(self.entity_id)
        patched_entity.description = "Patched description"

        self.mock_ometa.patch.return_value = patched_entity

        result = {name}.patch(self.entity_id, json_patch)

        self.assertEqual(result.description, "Patched description")
        self.mock_ometa.patch.assert_called_once_with(
            entity={name}Entity, entity_id=self.entity_id, json_patch=json_patch
        )

    def test_delete_{snake_name}(self):
        """Test deleting a {snake_name.replace('_', ' ')}"""
        {name}.delete(self.entity_id, recursive=True, hard_delete=False)

        self.mock_ometa.delete.assert_called_once_with(
            entity={name}Entity,
            entity_id=self.entity_id,
            recursive=True,
            hard_delete=False,
        )

    def test_list_{snake_name}s(self):
        """Test listing {snake_name.replace('_', ' ')}s"""
        mock_entity1 = MagicMock(spec={name}Entity)
        mock_entity1.name = "entity1"
        mock_entity2 = MagicMock(spec={name}Entity)
        mock_entity2.name = "entity2"

        mock_response = MagicMock()
        mock_response.entities = [mock_entity1, mock_entity2]

        self.mock_ometa.list_entities.return_value = mock_response

        result = {name}.list(limit=10)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].name, "entity1")
        self.mock_ometa.list_entities.assert_called_once()


if __name__ == "__main__":
    unittest.main()
'''
    return template


def main():
    """Generate all entity and test files."""
    entity_dir = (
        "/Users/harsha/Code/dev/OpenMetadata/ingestion/src/metadata/sdk/entities"
    )
    test_dir = "/Users/harsha/Code/dev/OpenMetadata/ingestion/tests/unit/sdk"

    for name, config in ENTITIES.items():
        snake_name = to_snake_case(name)

        # Generate entity file
        entity_code = generate_entity_class(name, config)
        entity_file = os.path.join(entity_dir, f"{snake_name.replace('_', '')}.py")

        # Generate test file
        test_code = generate_test_class(name, config)
        test_file = os.path.join(test_dir, f"test_{snake_name}_entity.py")

        print(f"Generating {name}:")
        print(f"  Entity: {entity_file}")
        print(f"  Test: {test_file}")

        # Write files
        with open(entity_file, "w") as f:
            f.write(entity_code)

        with open(test_file, "w") as f:
            f.write(test_code)

    print(f"\n✅ Generated {len(ENTITIES)} entities with tests")


if __name__ == "__main__":
    main()
