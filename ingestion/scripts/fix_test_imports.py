#!/usr/bin/env python3
"""Fix test imports to use plural SDK class names"""

import re
from pathlib import Path

# Mapping of old imports to new imports
IMPORT_MAPPING = {
    "from metadata.sdk.entities.table import Table": "from metadata.sdk.entities.tables import Tables",
    "from metadata.sdk.entities.database import Database": "from metadata.sdk.entities.databases import Databases",
    "from metadata.sdk.entities.pipeline import Pipeline": "from metadata.sdk.entities.pipelines import Pipelines",
    "from metadata.sdk.entities.dashboard import Dashboard": "from metadata.sdk.entities.dashboards import Dashboards",
    "from metadata.sdk.entities.user import User": "from metadata.sdk.entities.users import Users",
    "from metadata.sdk.entities.team import Team": "from metadata.sdk.entities.teams import Teams",
    "from metadata.sdk.entities.glossary import Glossary": "from metadata.sdk.entities.glossaries import Glossaries",
    "from metadata.sdk.entities.glossary_term import GlossaryTerm": "from metadata.sdk.entities.glossaryterms import GlossaryTerms",
    "from metadata.sdk.entities.database_schema import DatabaseSchema": "from metadata.sdk.entities.databaseschemas import DatabaseSchemas",
    "from metadata.sdk.entities.container import Container": "from metadata.sdk.entities.containers import Containers",
    "from metadata.sdk.entities.chart import Chart": "from metadata.sdk.entities.charts import Charts",
    "from metadata.sdk.entities.metric import Metric": "from metadata.sdk.entities.metrics import Metrics",
    "from metadata.sdk.entities.mlmodel import MLModel": "from metadata.sdk.entities.mlmodels import MLModels",
    "from metadata.sdk.entities.query import Query": "from metadata.sdk.entities.queries import Queries",
    "from metadata.sdk.entities.searchindex import SearchIndex": "from metadata.sdk.entities.searchindexes import SearchIndexes",
    "from metadata.sdk.entities.storedprocedure import StoredProcedure": "from metadata.sdk.entities.storedprocedures import StoredProcedures",
    "from metadata.sdk.entities.tag import Tag": "from metadata.sdk.entities.tags import Tags",
    "from metadata.sdk.entities.testcase import TestCase": "from metadata.sdk.entities.testcases import TestCases",
    "from metadata.sdk.entities.testdefinition import TestDefinition": "from metadata.sdk.entities.testdefinitions import TestDefinitions",
    "from metadata.sdk.entities.testsuite import TestSuite": "from metadata.sdk.entities.testsuites import TestSuites",
    "from metadata.sdk.entities.apiendpoint import APIEndpoint": "from metadata.sdk.entities.apiendpoints import APIEndpoints",
    "from metadata.sdk.entities.apicollection import APICollection": "from metadata.sdk.entities.apicollections import APICollections",
    "from metadata.sdk.entities.classification import Classification": "from metadata.sdk.entities.classifications import Classifications",
    "from metadata.sdk.entities.dashboarddatamodel import DashboardDataModel": "from metadata.sdk.entities.dashboarddatamodels import DashboardDataModels",
    "from metadata.sdk.entities.datacontract import DataContract": "from metadata.sdk.entities.datacontracts import DataContracts",
    "from metadata.sdk.entities.dataproduct import DataProduct": "from metadata.sdk.entities.dataproducts import DataProducts",
    "from metadata.sdk.entities.domain import Domain": "from metadata.sdk.entities.domains import Domains",
    "from metadata.sdk.entities.table_improved import Table": "from metadata.sdk.entities.tables import Tables",
    "from metadata.sdk.entities.user_improved import User": "from metadata.sdk.entities.users import Users",
}

# Usage pattern replacements
USAGE_MAPPING = {
    r"\bTable\.": "Tables.",
    r"\bDatabase\.": "Databases.",
    r"\bPipeline\.": "Pipelines.",
    r"\bDashboard\.": "Dashboards.",
    r"\bUser\.": "Users.",
    r"\bTeam\.": "Teams.",
    r"\bGlossary\.": "Glossaries.",
    r"\bGlossaryTerm\.": "GlossaryTerms.",
    r"\bDatabaseSchema\.": "DatabaseSchemas.",
    r"\bContainer\.": "Containers.",
    r"\bChart\.": "Charts.",
    r"\bMetric\.": "Metrics.",
    r"\bMLModel\.": "MLModels.",
    r"\bQuery\.": "Queries.",
    r"\bSearchIndex\.": "SearchIndexes.",
    r"\bStoredProcedure\.": "StoredProcedures.",
    r"\bTag\.": "Tags.",
    r"\bTestCase\.": "TestCases.",
    r"\bTestDefinition\.": "TestDefinitions.",
    r"\bTestSuite\.": "TestSuites.",
    r"\bAPIEndpoint\.": "APIEndpoints.",
    r"\bAPICollection\.": "APICollections.",
    r"\bClassification\.": "Classifications.",
    r"\bDashboardDataModel\.": "DashboardDataModels.",
    r"\bDataContract\.": "DataContracts.",
    r"\bDataProduct\.": "DataProducts.",
    r"\bDomain\.": "Domains.",
}


def fix_file(file_path):
    """Fix imports and usage in a single file"""
    with open(file_path, "r") as f:
        content = f.read()

    original = content

    # Fix imports
    for old_import, new_import in IMPORT_MAPPING.items():
        content = content.replace(old_import, new_import)

    # Fix usage patterns - but be careful not to replace in generated imports
    lines = content.split("\n")
    new_lines = []

    for line in lines:
        # Skip lines that are imports from generated schemas
        if "from metadata.generated" in line:
            new_lines.append(line)
            continue

        # Apply usage replacements
        new_line = line
        for pattern, replacement in USAGE_MAPPING.items():
            # Only replace if it's a method call (followed by parenthesis or dot)
            if re.search(
                pattern
                + r"(create|retrieve|update|delete|list|patch|export_csv|import_csv|set_default_client|add_tag)",
                new_line,
            ):
                new_line = re.sub(pattern, replacement, new_line)

        new_lines.append(new_line)

    content = "\n".join(new_lines)

    # Fix update() calls - remove entity_id as first parameter
    # Pattern: XXX.update(some_id, some_entity) -> XXX.update(some_entity)
    content = re.sub(
        r"(Tables|Databases|Users|Teams|Pipelines|Dashboards|Containers|Charts|Glossaries|GlossaryTerms|DatabaseSchemas|Metrics|MLModels|Queries|SearchIndexes|StoredProcedures|Tags|TestCases|TestDefinitions|TestSuites|APIEndpoints|APICollections|Classifications|DashboardDataModels|DataContracts|DataProducts|Domains)\.update\([^,]+,\s*",
        r"\1.update(",
        content,
    )

    if content != original:
        with open(file_path, "w") as f:
            f.write(content)
        return True
    return False


def main():
    test_dir = Path("tests/unit/sdk")

    if not test_dir.exists():
        print(f"Test directory {test_dir} not found")
        return

    fixed_count = 0
    for test_file in test_dir.glob("test_*.py"):
        if fix_file(test_file):
            print(f"Fixed {test_file}")
            fixed_count += 1

    print(f"\nFixed {fixed_count} test files")


if __name__ == "__main__":
    main()
