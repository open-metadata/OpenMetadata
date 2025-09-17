#!/usr/bin/env python3
"""
Fix import paths in SDK entity files
"""
import re
from pathlib import Path

# Map entity names to their correct import paths
ENTITY_MAPPINGS = {
    # Data entities
    "APICollection": ("entity.data.apiCollection", "api.data.createAPICollection"),
    "APIEndpoint": ("entity.data.apiEndpoint", "api.data.createAPIEndpoint"),
    "Chart": ("entity.data.chart", "api.data.createChart"),
    "Container": ("entity.data.container", "api.data.createContainer"),
    "Dashboard": ("entity.data.dashboard", "api.data.createDashboard"),
    "DashboardDataModel": (
        "entity.data.dashboardDataModel",
        "api.data.createDashboardDataModel",
    ),
    "Database": ("entity.data.database", "api.data.createDatabase"),
    "DatabaseSchema": ("entity.data.databaseSchema", "api.data.createDatabaseSchema"),
    "DataContract": ("entity.data.dataContract", "api.data.createDataContract"),
    "DataProduct": ("entity.data.dataProduct", "api.data.createDataProduct"),
    "Domain": ("entity.data.domain", "api.data.createDomain"),
    "Glossary": ("entity.data.glossary", "api.data.createGlossary"),
    "GlossaryTerm": ("entity.data.glossaryTerm", "api.data.createGlossaryTerm"),
    "Metric": ("entity.data.metric", "api.data.createMetric"),
    "MLModel": ("entity.data.mlmodel", "api.data.createMlModel"),
    "Pipeline": ("entity.data.pipeline", "api.data.createPipeline"),
    "Query": ("entity.data.query", "api.data.createQuery"),
    "SearchIndex": ("entity.data.searchIndex", "api.data.createSearchIndex"),
    "StoredProcedure": (
        "entity.data.storedProcedure",
        "api.data.createStoredProcedure",
    ),
    "Table": ("entity.data.table", "api.data.createTable"),
    "Tag": ("entity.classification.tag", "api.classification.createTag"),
    "Classification": (
        "entity.classification.classification",
        "api.classification.createClassification",
    ),
    # Teams and Users
    "Team": ("entity.teams.team", "api.teams.createTeam"),
    "User": ("entity.teams.user", "api.teams.createUser"),
    # Test entities
    "TestCase": ("entity.tests.testCase", "api.tests.createTestCase"),
    "TestDefinition": ("entity.tests.testDefinition", "api.tests.createTestDefinition"),
    "TestSuite": ("entity.tests.testSuite", "api.tests.createTestSuite"),
}


def fix_imports_in_file(file_path):
    """Fix imports in a single SDK entity file"""
    with open(file_path, "r") as f:
        content = f.read()

    # Extract entity name from imports
    entity_import = re.search(
        r"from metadata\.generated\.schema\.entity\.[^\s]+ import (\w+)", content
    )
    create_import = re.search(
        r"from metadata\.generated\.schema\.api\.[^\s]+ import (Create\w+Request)",
        content,
    )

    if entity_import:
        entity_name = entity_import.group(1)

        if entity_name in ENTITY_MAPPINGS:
            entity_path, create_path = ENTITY_MAPPINGS[entity_name]

            # Fix entity import
            old_entity_pattern = (
                r"from metadata\.generated\.schema\.entity\.[^\s]+ import "
                + entity_name
            )
            new_entity_import = (
                f"from metadata.generated.schema.{entity_path} import {entity_name}"
            )
            content = re.sub(old_entity_pattern, new_entity_import, content)

            # Fix create request import
            if create_import:
                create_request = create_import.group(1)
                old_create_pattern = (
                    r"from metadata\.generated\.schema\.api\.[^\s]+ import "
                    + re.escape(create_request)
                )
                new_create_import = f"from metadata.generated.schema.{create_path} import {create_request}"
                content = re.sub(old_create_pattern, new_create_import, content)

            with open(file_path, "w") as f:
                f.write(content)

            print(f"Fixed imports in {file_path.name}")
            return True

    return False


def main():
    """Fix all SDK entity files"""
    sdk_entities_dir = Path(
        "/Users/harsha/Code/dev/OpenMetadata/ingestion/src/metadata/sdk/entities"
    )

    # Get all plural entity files
    entity_files = [
        f
        for f in sdk_entities_dir.glob("*.py")
        if f.name.endswith("s.py")
        and f.name
        not in ["__init__.py", "csv_operations.py", "base.py", "glossary_terms.py"]
    ]

    fixed_count = 0
    for file_path in entity_files:
        if fix_imports_in_file(file_path):
            fixed_count += 1

    print(f"\nFixed imports in {fixed_count} files")


if __name__ == "__main__":
    main()
