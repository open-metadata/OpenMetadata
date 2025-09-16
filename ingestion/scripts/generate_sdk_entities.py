#!/usr/bin/env python3
"""
Script to generate SDK entity classes and their tests for OpenMetadata Python SDK.
This will help achieve parity with the Java SDK.
"""

import os
from typing import Dict

# Template for entity classes
ENTITY_TEMPLATE = '''"""
{entity_display} entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional, Union

from metadata.generated.schema.api.{api_path}.create{entity} import Create{entity}Request
from metadata.generated.schema.entity.{entity_path}.{entity_lower} import {entity} as {entity}Entity
from metadata.sdk.entities.base import BaseEntity


class {entity}(BaseEntity):
    """{entity} entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return {entity}Entity

    @classmethod
    def create(cls, request: Create{entity}Request) -> {entity}Entity:
        """
        Create a new {entity_lower}.

        Args:
            request: Create{entity}Request with {entity_lower} details

        Returns:
            Created {entity} entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> {entity}Entity:
        """
        Retrieve a {entity_lower} by ID.

        Args:
            entity_id: {entity} UUID
            fields: Optional list of fields to include

        Returns:
            {entity} entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity={entity}Entity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> {entity}Entity:
        """
        Retrieve a {entity_lower} by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            {entity} entity
        """
        client = cls._get_client()
        return client.get_by_name(entity={entity}Entity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, {entity_lower}: {entity}Entity) -> {entity}Entity:
        """
        Update a {entity_lower} (PUT operation).

        Args:
            entity_id: {entity} UUID
            {entity_lower}: Updated {entity} entity

        Returns:
            Updated {entity} entity
        """
        {entity_lower}.id = entity_id
        client = cls._get_client()
        return client.create_or_update({entity_lower})

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> {entity}Entity:
        """
        Patch a {entity_lower} (PATCH operation).

        Args:
            entity_id: {entity} UUID
            json_patch: JSON patch operations

        Returns:
            Patched {entity} entity
        """
        client = cls._get_client()
        return client.patch(
            entity={entity}Entity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a {entity_lower}.

        Args:
            entity_id: {entity} UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity={entity}Entity,
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
    ) -> List[{entity}Entity]:
        """
        List {entity_lower}s.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of {entity} entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity={entity}Entity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
'''

# Entities to generate
ENTITIES_TO_GENERATE = [
    {
        "name": "MLModel",
        "display": "ML Model",
        "api_path": "data",
        "entity_path": "data",
        "entity_lower": "mlmodel",
    },
    {
        "name": "StoredProcedure",
        "display": "Stored Procedure",
        "api_path": "data",
        "entity_path": "data",
        "entity_lower": "stored_procedure",
    },
    {
        "name": "SearchIndex",
        "display": "Search Index",
        "api_path": "data",
        "entity_path": "data",
        "entity_lower": "search_index",
    },
    {
        "name": "Domain",
        "display": "Domain",
        "api_path": "domains",
        "entity_path": "domains",
        "entity_lower": "domain",
    },
    {
        "name": "DataProduct",
        "display": "Data Product",
        "api_path": "domains",
        "entity_path": "domains",
        "entity_lower": "data_product",
    },
    {
        "name": "Classification",
        "display": "Classification",
        "api_path": "classification",
        "entity_path": "classification",
        "entity_lower": "classification",
    },
    {
        "name": "Tag",
        "display": "Tag",
        "api_path": "classification",
        "entity_path": "classification",
        "entity_lower": "tag",
    },
    {
        "name": "TestCase",
        "display": "Test Case",
        "api_path": "dataQuality",
        "entity_path": "dataQuality",
        "entity_lower": "test_case",
    },
    {
        "name": "TestSuite",
        "display": "Test Suite",
        "api_path": "dataQuality",
        "entity_path": "dataQuality",
        "entity_lower": "test_suite",
    },
    {
        "name": "TestDefinition",
        "display": "Test Definition",
        "api_path": "dataQuality",
        "entity_path": "dataQuality",
        "entity_lower": "test_definition",
    },
    {
        "name": "Query",
        "display": "Query",
        "api_path": "data",
        "entity_path": "data",
        "entity_lower": "query",
    },
    {
        "name": "Report",
        "display": "Report",
        "api_path": "data",
        "entity_path": "data",
        "entity_lower": "report",
    },
    {
        "name": "DashboardDataModel",
        "display": "Dashboard Data Model",
        "api_path": "data",
        "entity_path": "data",
        "entity_lower": "dashboard_data_model",
    },
    {
        "name": "APIEndpoint",
        "display": "API Endpoint",
        "api_path": "data",
        "entity_path": "data",
        "entity_lower": "api_endpoint",
    },
    {
        "name": "APICollection",
        "display": "API Collection",
        "api_path": "data",
        "entity_path": "data",
        "entity_lower": "api_collection",
    },
]


def generate_entity_file(entity_info: Dict[str, str], output_dir: str) -> str:
    """Generate an entity class file."""
    content = ENTITY_TEMPLATE.format(
        entity=entity_info["name"],
        entity_display=entity_info["display"],
        entity_lower=entity_info["entity_lower"],
        api_path=entity_info["api_path"],
        entity_path=entity_info["entity_path"],
    )

    filename = f"{entity_info['entity_lower'].replace('_', '')}.py"
    filepath = os.path.join(output_dir, filename)

    return filepath, content


def main():
    """Generate all entity files."""
    base_dir = "/Users/harsha/Code/dev/OpenMetadata/ingestion/src/metadata/sdk/entities"

    generated_files = []

    for entity_info in ENTITIES_TO_GENERATE:
        filepath, content = generate_entity_file(entity_info, base_dir)
        print(f"Generated: {filepath}")
        generated_files.append((filepath, content))

    # Print summary
    print(f"\nGenerated {len(generated_files)} entity templates")
    print("\nNext steps:")
    print("1. Review and save the generated files")
    print("2. Create comprehensive tests for each entity")
    print("3. Update __init__.py to export all entities")
    print("4. Run tests to ensure everything works")

    return generated_files


if __name__ == "__main__":
    files = main()

    # Optionally save files
    save = input("\nDo you want to save these files? (y/n): ")
    if save.lower() == "y":
        for filepath, content in files:
            with open(filepath, "w") as f:
                f.write(content)
            print(f"Saved: {filepath}")
