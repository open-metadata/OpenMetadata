#!/usr/bin/env python3
"""
Fix import paths in generated entity files.
"""

import os
import re

# Mapping of entity names to correct import names
IMPORT_FIXES = {
    "StoredProcedure": "storedProcedure",
    "SearchIndex": "searchIndex",
    "Query": "query",
    "DashboardDataModel": "dashboardDataModel",
    "APIEndpoint": "apiEndpoint",
    "APICollection": "apiCollection",
    "Classification": "classification",
    "Tag": "tag",
    "Domain": "domain",
    "DataProduct": "dataProduct",
    "TestCase": "testCase",
    "TestSuite": "testSuite",
    "TestDefinition": "testDefinition",
}


def fix_entity_file(entity_name, entity_dir):
    """Fix imports in entity file."""
    snake_name = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", entity_name)
    snake_name = re.sub("([a-z0-9])([A-Z])", r"\1_\2", snake_name).lower()

    filename = f"{snake_name.replace('_', '')}.py"
    filepath = os.path.join(entity_dir, filename)

    if not os.path.exists(filepath):
        print(f"Skipping {filepath} - not found")
        return

    with open(filepath, "r") as f:
        content = f.read()

    # Fix the import paths
    if entity_name in IMPORT_FIXES:
        correct_import = IMPORT_FIXES[entity_name]

        # Fix entity import
        old_pattern = f"from metadata.generated.schema.entity.(.*?).{snake_name} import"
        new_import = (
            f"from metadata.generated.schema.entity.\\1.{correct_import} import"
        )
        content = re.sub(old_pattern, new_import, content)

        # Fix create request import
        old_pattern = (
            f"from metadata.generated.schema.api.(.*?).create{entity_name} import"
        )
        new_import = (
            f"from metadata.generated.schema.api.\\1.create{entity_name} import"
        )
        content = re.sub(old_pattern, new_import, content)

    with open(filepath, "w") as f:
        f.write(content)

    print(f"Fixed {filepath}")


def fix_test_file(entity_name, test_dir):
    """Fix imports in test file."""
    snake_name = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", entity_name)
    snake_name = re.sub("([a-z0-9])([A-Z])", r"\1_\2", snake_name).lower()

    filename = f"test_{snake_name}_entity.py"
    filepath = os.path.join(test_dir, filename)

    if not os.path.exists(filepath):
        print(f"Skipping {filepath} - not found")
        return

    with open(filepath, "r") as f:
        content = f.read()

    # Fix the import paths
    if entity_name in IMPORT_FIXES:
        correct_import = IMPORT_FIXES[entity_name]

        # Fix entity import
        old_pattern = f"from metadata.generated.schema.entity.(.*?).{snake_name} import"
        new_import = (
            f"from metadata.generated.schema.entity.\\1.{correct_import} import"
        )
        content = re.sub(old_pattern, new_import, content)

        # Fix SDK import
        old_pattern = f"from metadata.sdk.entities.{snake_name.replace('_', '')} import"
        new_import = f"from metadata.sdk.entities.{snake_name.replace('_', '')} import"
        content = re.sub(old_pattern, new_import, content)

    with open(filepath, "w") as f:
        f.write(content)

    print(f"Fixed {filepath}")


def main():
    entity_dir = (
        "/Users/harsha/Code/dev/OpenMetadata/ingestion/src/metadata/sdk/entities"
    )
    test_dir = "/Users/harsha/Code/dev/OpenMetadata/ingestion/tests/unit/sdk"

    for entity_name in IMPORT_FIXES.keys():
        fix_entity_file(entity_name, entity_dir)
        fix_test_file(entity_name, test_dir)

    print("\n✅ Fixed all import paths")


if __name__ == "__main__":
    main()
