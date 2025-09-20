#!/usr/bin/env python3
"""Add create methods to all service classes that need them."""

import os
import re

def add_create_method(filepath, entity, create_class):
    """Add a create method to a service class."""
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the package for the Create class
    packages = {
        "CreateTag": "org.openmetadata.schema.api.classification",
        "CreateClassification": "org.openmetadata.schema.api.classification",
        "CreateStoredProcedure": "org.openmetadata.schema.api.data",
        "CreateContainer": "org.openmetadata.schema.api.data",
        "CreatePolicy": "org.openmetadata.schema.api.policies",
        "CreateUser": "org.openmetadata.schema.api.teams",
        "CreateRole": "org.openmetadata.schema.api.teams",
        "CreateTeam": "org.openmetadata.schema.api.teams",
        "CreateGlossary": "org.openmetadata.schema.api.data",
        "CreateGlossaryTerm": "org.openmetadata.schema.api.data",
        "CreateMlModel": "org.openmetadata.schema.api.data",
        "CreateDashboardDataModel": "org.openmetadata.schema.api.data",
        "CreateMetric": "org.openmetadata.schema.api.data",
        "CreateQuery": "org.openmetadata.schema.api.data",
        "CreateChart": "org.openmetadata.schema.api.data",
        "CreateSearchIndex": "org.openmetadata.schema.api.data"
    }

    package = packages.get(create_class, "org.openmetadata.schema.api.data")

    # Add import if not present
    import_line = f"import {package}.{create_class};"
    if import_line not in content:
        # Add after the package declaration and existing imports
        lines = content.split('\n')
        import_index = -1
        for i, line in enumerate(lines):
            if line.startswith('import org.openmetadata.'):
                import_index = i

        if import_index > 0:
            lines.insert(import_index + 1, import_line)
            content = '\n'.join(lines)

    # Add create method before the closing brace
    create_method = f"""
  // Create {entity.lower()} using {create_class} request
  public {entity} create({create_class} request) throws OpenMetadataException {{
    return httpClient.execute(HttpMethod.POST, basePath, request, {entity}.class);
  }}"""

    # Find the last closing brace
    last_brace = content.rfind('}')
    if last_brace > 0:
        content = content[:last_brace] + create_method + '\n' + content[last_brace:]

    # Also add OpenMetadataException import if needed
    if "import org.openmetadata.sdk.exceptions.OpenMetadataException;" not in content:
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('import org.openmetadata.sdk.'):
                lines.insert(i + 1, "import org.openmetadata.sdk.exceptions.OpenMetadataException;")
                content = '\n'.join(lines)
                break

    # Add HttpMethod import if needed
    if "import org.openmetadata.sdk.network.HttpMethod;" not in content:
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('import org.openmetadata.sdk.network.'):
                lines.insert(i + 1, "import org.openmetadata.sdk.network.HttpMethod;")
                content = '\n'.join(lines)
                break

    with open(filepath, 'w') as f:
        f.write(content)

    return True

def main():
    services_to_fix = [
        ("governance/TagService.java", "Tag", "CreateTag"),
        ("governance/ClassificationService.java", "Classification", "CreateClassification"),
        ("dataassets/StoredProcedureService.java", "StoredProcedure", "CreateStoredProcedure"),
        ("dataassets/ContainerService.java", "Container", "CreateContainer"),
        ("policies/PolicyService.java", "Policy", "CreatePolicy"),
        ("teams/UserService.java", "User", "CreateUser"),
        ("teams/RoleService.java", "Role", "CreateRole"),
        ("teams/TeamService.java", "Team", "CreateTeam"),
        ("governance/GlossaryService.java", "Glossary", "CreateGlossary"),
        ("governance/GlossaryTermService.java", "GlossaryTerm", "CreateGlossaryTerm"),
        ("dataassets/MlModelService.java", "MlModel", "CreateMlModel"),
        ("dataassets/DashboardDataModelService.java", "DashboardDataModel", "CreateDashboardDataModel"),
        ("dataassets/MetricService.java", "Metric", "CreateMetric"),
        ("dataassets/QueryService.java", "Query", "CreateQuery"),
        ("dataassets/ChartService.java", "Chart", "CreateChart"),
        ("dataassets/SearchIndexService.java", "SearchIndex", "CreateSearchIndex")
    ]

    services_dir = "openmetadata-sdk/src/main/java/org/openmetadata/sdk/services"

    for relative_path, entity, create_class in services_to_fix:
        filepath = os.path.join(services_dir, relative_path)
        if os.path.exists(filepath):
            if add_create_method(filepath, entity, create_class):
                print(f"Added create method to {relative_path}")
        else:
            print(f"File not found: {filepath}")

if __name__ == "__main__":
    main()