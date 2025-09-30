#!/usr/bin/env python3
"""Add create methods to all missing service classes."""

import os

services_to_add = [
    ("services/DashboardServiceService.java", "DashboardService", "CreateDashboardService", "org.openmetadata.schema.api.services"),
    ("dataassets/DashboardService.java", "Dashboard", "CreateDashboard", "org.openmetadata.schema.api.data"),
    ("domains/DataProductService.java", "DataProduct", "CreateDataProduct", "org.openmetadata.schema.api.domains"),
    ("services/DatabaseServiceService.java", "DatabaseService", "CreateDatabaseService", "org.openmetadata.schema.api.services"),
    ("domains/DomainService.java", "Domain", "CreateDomain", "org.openmetadata.schema.api.domains"),
    ("services/MessagingServiceService.java", "MessagingService", "CreateMessagingService", "org.openmetadata.schema.api.services"),
    ("services/MlModelServiceService.java", "MlModelService", "CreateMlModelService", "org.openmetadata.schema.api.services"),
    ("services/PipelineServiceService.java", "PipelineService", "CreatePipelineService", "org.openmetadata.schema.api.services"),
    ("dataassets/PipelineService.java", "Pipeline", "CreatePipeline", "org.openmetadata.schema.api.data"),
    ("services/StorageServiceService.java", "StorageService", "CreateStorageService", "org.openmetadata.schema.api.services"),
    ("tests/TestCaseService.java", "TestCase", "CreateTestCase", "org.openmetadata.schema.api.tests"),
    ("tests/TestDefinitionService.java", "TestDefinition", "CreateTestDefinition", "org.openmetadata.schema.api.tests"),
    ("tests/TestSuiteService.java", "TestSuite", "CreateTestSuite", "org.openmetadata.schema.api.tests"),
    ("dataassets/TopicService.java", "Topic", "CreateTopic", "org.openmetadata.schema.api.data")
]

services_dir = "openmetadata-sdk/src/main/java/org/openmetadata/sdk/services"

for relative_path, entity_name, create_class, package in services_to_add:
    filepath = os.path.join(services_dir, relative_path)

    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            content = f.read()

        # Check if create method already exists
        if f"public {entity_name} create({create_class}" in content or f"public org.openmetadata.schema.entity." in content and f"create({create_class}" in content:
            print(f"Skipping {relative_path} - create method already exists")
            continue

        # Add imports
        import_line = f"import {package}.{create_class};"
        if import_line not in content:
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if line.startswith('import org.openmetadata.'):
                    lines.insert(i + 1, import_line)
                    content = '\n'.join(lines)
                    break

        # Add HttpMethod and OpenMetadataException imports if needed
        if "import org.openmetadata.sdk.network.HttpMethod;" not in content:
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if line.startswith('import org.openmetadata.sdk.'):
                    lines.insert(i + 1, "import org.openmetadata.sdk.network.HttpMethod;")
                    content = '\n'.join(lines)
                    break

        if "import org.openmetadata.sdk.exceptions.OpenMetadataException;" not in content:
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if line.startswith('import org.openmetadata.sdk.'):
                    lines.insert(i + 1, "import org.openmetadata.sdk.exceptions.OpenMetadataException;")
                    content = '\n'.join(lines)
                    break

        # Determine full entity type
        if "org.openmetadata.schema.entity.services" in content:
            full_entity = f"org.openmetadata.schema.entity.services.{entity_name}"
        elif "org.openmetadata.schema.entity.data" in content:
            full_entity = f"org.openmetadata.schema.entity.data.{entity_name}"
        elif "org.openmetadata.schema.entity.domains" in content:
            full_entity = f"org.openmetadata.schema.entity.domains.{entity_name}"
        elif "org.openmetadata.schema.tests" in content:
            full_entity = f"org.openmetadata.schema.tests.{entity_name}"
        else:
            full_entity = entity_name

        # Add create method
        create_method = f"""
  // Create using {create_class} request
  public {full_entity} create({create_class} request) throws OpenMetadataException {{
    return httpClient.execute(HttpMethod.POST, basePath, request, {full_entity}.class);
  }}"""

        # Find the last closing brace
        last_brace = content.rfind('}')
        if last_brace > 0:
            content = content[:last_brace] + create_method + '\n' + content[last_brace:]

        with open(filepath, 'w') as f:
            f.write(content)

        print(f"Added create method to {relative_path}")
    else:
        print(f"File not found: {filepath}")

print("\nDone!")