#!/usr/bin/env python3
"""Update all SDK entities to use plural naming and inherit from BaseEntity"""

from pathlib import Path

# Mapping of singular to plural names
ENTITY_MAPPING = {
    "table": "Tables",
    "database": "Databases",
    "pipeline": "Pipelines",
    "dashboard": "Dashboards",
    "user": "Users",
    "team": "Teams",
    "glossary": "Glossaries",
    "glossary_term": "GlossaryTerms",
    "database_schema": "DatabaseSchemas",
    "container": "Containers",
    "testcase": "TestCases",
    "searchindex": "SearchIndexes",
    "apiendpoint": "APIEndpoints",
    "apicollection": "APICollections",
    "testsuite": "TestSuites",
    "dashboarddatamodel": "DashboardDataModels",
    "classification": "Classifications",
    "datacontract": "DataContracts",
    "chart": "Charts",
    "storedprocedure": "StoredProcedures",
    "query": "Queries",
    "testdefinition": "TestDefinitions",
    "tag": "Tags",
    "metric": "Metrics",
    "mlmodel": "MLModels",
    "dataproduct": "DataProducts",
    "domain": "Domains",
}

# Entity to generated class mapping
GENERATED_ENTITY_MAPPING = {
    "Tables": ("Table", "CreateTableRequest"),
    "Databases": ("Database", "CreateDatabaseRequest"),
    "Pipelines": ("Pipeline", "CreatePipelineRequest"),
    "Dashboards": ("Dashboard", "CreateDashboardRequest"),
    "Users": ("User", "CreateUserRequest"),
    "Teams": ("Team", "CreateTeamRequest"),
    "Glossaries": ("Glossary", "CreateGlossaryRequest"),
    "GlossaryTerms": ("GlossaryTerm", "CreateGlossaryTermRequest"),
    "DatabaseSchemas": ("DatabaseSchema", "CreateDatabaseSchemaRequest"),
    "Containers": ("Container", "CreateContainerRequest"),
    "TestCases": ("TestCase", "CreateTestCaseRequest"),
    "SearchIndexes": ("SearchIndex", "CreateSearchIndexRequest"),
    "APIEndpoints": ("APIEndpoint", "CreateAPIEndpointRequest"),
    "APICollections": ("APICollection", "CreateAPICollectionRequest"),
    "TestSuites": ("TestSuite", "CreateTestSuiteRequest"),
    "DashboardDataModels": ("DashboardDataModel", "CreateDashboardDataModelRequest"),
    "Classifications": ("Classification", "CreateClassificationRequest"),
    "DataContracts": ("DataContract", "CreateDataContractRequest"),
    "Charts": ("Chart", "CreateChartRequest"),
    "StoredProcedures": ("StoredProcedure", "CreateStoredProcedureRequest"),
    "Queries": ("Query", "CreateQueryRequest"),
    "TestDefinitions": ("TestDefinition", "CreateTestDefinitionRequest"),
    "Tags": ("Tag", "CreateTagRequest"),
    "Metrics": ("Metric", "CreateMetricRequest"),
    "MLModels": ("MLModel", "CreateMLModelRequest"),
    "DataProducts": ("DataProduct", "CreateDataProductRequest"),
    "Domains": ("Domain", "CreateDomainRequest"),
}


def get_import_path(entity_name, create_request_name):
    """Get the proper import paths for entities"""
    entity_lower = entity_name.lower()

    # Handle special cases
    if entity_name == "APIEndpoint":
        return (
            "metadata.generated.schema.entity.services.apiEndpoint",
            "metadata.generated.schema.api.services.createAPIEndpoint",
        )
    elif entity_name == "APICollection":
        return (
            "metadata.generated.schema.entity.services.apiCollection",
            "metadata.generated.schema.api.services.createAPICollection",
        )
    elif entity_name == "MLModel":
        return (
            "metadata.generated.schema.entity.data.mlmodel",
            "metadata.generated.schema.api.data.createMlModel",
        )
    elif entity_name == "DatabaseSchema":
        return (
            "metadata.generated.schema.entity.data.databaseSchema",
            "metadata.generated.schema.api.data.createDatabaseSchema",
        )
    elif entity_name == "DashboardDataModel":
        return (
            "metadata.generated.schema.entity.data.dashboardDataModel",
            "metadata.generated.schema.api.data.createDashboardDataModel",
        )
    elif entity_name == "TestCase":
        return (
            "metadata.generated.schema.tests.testCase",
            "metadata.generated.schema.api.tests.createTestCase",
        )
    elif entity_name == "TestSuite":
        return (
            "metadata.generated.schema.tests.testSuite",
            "metadata.generated.schema.api.tests.createTestSuite",
        )
    elif entity_name == "TestDefinition":
        return (
            "metadata.generated.schema.tests.testDefinition",
            "metadata.generated.schema.api.tests.createTestDefinition",
        )
    elif entity_name in ["User", "Team"]:
        return (
            f"metadata.generated.schema.entity.teams.{entity_lower}",
            f"metadata.generated.schema.api.teams.create{entity_name}",
        )
    elif entity_name in ["Classification", "Tag"]:
        return (
            f"metadata.generated.schema.entity.classification.{entity_lower}",
            f"metadata.generated.schema.api.classification.create{entity_name}",
        )
    elif entity_name == "Domain":
        return (
            "metadata.generated.schema.entity.domains.domain",
            "metadata.generated.schema.api.domains.createDomain",
        )
    elif entity_name == "DataProduct":
        return (
            "metadata.generated.schema.entity.domains.dataProduct",
            "metadata.generated.schema.api.domains.createDataProduct",
        )
    else:
        return (
            f"metadata.generated.schema.entity.data.{entity_lower}",
            f"metadata.generated.schema.api.data.create{entity_name}",
        )


def create_entity_file(file_name, class_name, entity_name, create_request_name):
    """Create a new entity file with proper structure"""

    entity_import_path, create_import_path = get_import_path(
        entity_name, create_request_name
    )

    content = f'''"""
{class_name} entity SDK with fluent API
"""
from typing import Type
from {entity_import_path} import {entity_name}
from {create_import_path} import {create_request_name}
from metadata.sdk.entities.base import BaseEntity


class {class_name}(BaseEntity[{entity_name}, {create_request_name}]):
    """{class_name} SDK class - plural to avoid conflict with generated {entity_name} entity"""

    @classmethod
    def entity_type(cls) -> Type[{entity_name}]:
        """Return the {entity_name} entity type"""
        return {entity_name}
'''

    return content


def main():
    entities_dir = Path("src/metadata/sdk/entities")

    # Keep these special files
    keep_files = [
        "base.py",
        "csv_operations.py",
        "__init__.py",
        "tables.py",
        "databases.py",
        "glossary_terms.py",
    ]

    # Remove old singular files and create new plural ones
    for old_file, new_class in ENTITY_MAPPING.items():
        old_path = entities_dir / f"{old_file}.py"
        new_file_name = new_class.lower() + ".py"
        new_path = entities_dir / new_file_name

        # Skip if already converted
        if new_file_name in keep_files:
            continue

        # Get entity info
        if new_class in GENERATED_ENTITY_MAPPING:
            entity_name, create_request = GENERATED_ENTITY_MAPPING[new_class]

            # Create new content
            new_content = create_entity_file(
                new_file_name, new_class, entity_name, create_request
            )

            # Write new file
            with open(new_path, "w") as f:
                f.write(new_content)

            print(f"Created {new_path}")

            # Remove old file if it exists and is different
            if old_path.exists() and old_path != new_path:
                old_path.unlink()
                print(f"Removed {old_path}")

    # Remove improved versions as we now use the standard pattern
    improved_files = ["table_improved.py", "user_improved.py"]
    for file in improved_files:
        path = entities_dir / file
        if path.exists():
            path.unlink()
            print(f"Removed {path}")


if __name__ == "__main__":
    main()
