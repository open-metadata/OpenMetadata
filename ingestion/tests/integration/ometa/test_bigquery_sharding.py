#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Shard migration against persisted catalog identities and relationships."""

import json
import os
from types import SimpleNamespace
from uuid import uuid4

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.cli.bigquery_sharding import apply_family, checkpoint, preview_family
from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.engine import EntityResolver
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import CreateDatabaseSchemaRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.tests.basic import TestCaseResult as CaseResult
from metadata.generated.schema.tests.testCase import TestCase as Case
from metadata.ingestion.source.database.bigquery.resolution import resolve_bigquery_reference
from metadata.ingestion.source.database.bigquery.sharding import inventory_families


@pytest.fixture
def shard_catalog(request):
    url = os.environ.get("BQ_MIGRATION_TEST_URL")
    metadata = (
        int_admin_ometa(url, os.environ["BQ_MIGRATION_TEST_TOKEN"]) if url else request.getfixturevalue("metadata")
    )
    service = metadata.create_or_update(
        CreateDatabaseServiceRequest(
            name=f"shard_migration_{uuid4().hex}",
            serviceType="BigQuery",
            connection={"config": {"type": "BigQuery", "credentials": {"gcpConfig": {}}}},
        )
    )
    try:
        database = metadata.create_or_update(
            CreateDatabaseRequest(name="demo_project", service=service.fullyQualifiedName)
        )
        schema = metadata.create_or_update(
            CreateDatabaseSchemaRequest(name="demo_dataset", database=database.fullyQualifiedName)
        )
        yield metadata, schema.fullyQualifiedName.root
    finally:
        metadata.delete(DatabaseService, service.id, recursive=True, hard_delete=True)
        if url:
            metadata.close()


@pytest.mark.parametrize("with_case", [False, True])
def test_migration_preserves_identities_relationships_and_case_history(shard_catalog, tmp_path, with_case):
    metadata, schema = shard_catalog
    tables = [
        metadata.create_or_update(
            CreateTableRequest(
                name=name,
                databaseSchema=schema,
                description="Curated description",
                columns=[{"name": "id", "dataType": "BIGINT", "description": "Curated column"}],
            )
        )
        for name in ("events_20260101", "events_20260102")
    ]
    downstream = metadata.create_or_update(CreateTableRequest(name="summary", databaseSchema=schema, columns=[]))
    metadata.add_lineage(
        AddLineageRequest(
            edge={
                "fromEntity": {"id": tables[0].id, "type": "table"},
                "toEntity": {"id": downstream.id, "type": "table"},
            }
        )
    )
    original_case = None
    timestamp = 1767398400000
    if with_case:
        original_case = metadata.create_or_update(
            CreateTestCaseRequest(
                name="row_count",
                entityLink=f"<#E::table::{tables[0].fullyQualifiedName.root}>",
                testDefinition="tableRowCountToBeBetween",
                parameterValues=[{"name": "minValue", "value": "0"}],
            )
        )
        metadata.add_test_case_results(
            CaseResult(timestamp=timestamp, testCaseStatus="Success", result="original observation"),
            original_case.fullyQualifiedName.root,
        )
    family = inventory_families(SimpleNamespace(table_id=table.name.root, table_type="TABLE") for table in tables)[
        "events_"
    ]
    tables = [metadata.get_by_id(Table, table.id, fields=["owners", "tags", "extension"]) for table in tables]
    manifest = preview_family(metadata, schema, family, tables, family.descriptor("demo_project", "demo_dataset"))
    path = tmp_path / "manifest.json"
    checkpoint(path, manifest)
    manifest = json.loads(path.read_text())
    assert metadata.get_by_name(Table, manifest["destination"]) is None

    def save():
        checkpoint(path, manifest)

    apply_family(metadata, manifest, save)
    apply_family(metadata, manifest, save)
    destination = metadata.get_by_id(Table, manifest["destinationId"])
    assert destination.id not in [table.id for table in tables]
    assert destination.description.root == "Curated description"
    assert destination.columns[0].description.root == "Curated column"

    def resolve_physical():
        resolver = EntityResolver(metadata)
        try:
            return resolve_bigquery_reference(
                resolver, schema.split(".")[0], TableReference("demo_project", "demo_dataset", "events_20260101")
            )[0]
        finally:
            resolver.close()

    assert resolve_physical().id == tables[0].id
    graph = metadata.get_lineage_by_id(Table, destination.id)
    assert any(edge["toEntity"] == str(downstream.id.root) for edge in graph["downstreamEdges"])
    if with_case:
        with pytest.raises(ValueError, match="Retirement blocked"):
            apply_family(metadata, manifest, save, retire=True)
        mapping = manifest["testMappings"][str(original_case.id.root)]
        recreated = metadata.get_by_id(Case, mapping["id"], fields=["testDefinition", "testSuite"])
        assert recreated.id != original_case.id
        assert recreated.entityLink.root == f"<#E::table::{destination.fullyQualifiedName.root}>"
        assert (
            metadata.get_by_id(Case, original_case.id, fields=["testDefinition", "testSuite"]).entityLink
            == original_case.entityLink
        )
        history = metadata.get_test_case_results(original_case.fullyQualifiedName.root, timestamp - 1, timestamp + 1)
        assert history[0].result == "original observation"
        assert all(not metadata.get_by_id(Table, table.id).deleted for table in tables)
    else:
        apply_family(metadata, manifest, save, retire=True)
        assert manifest["state"] == "retired"
        assert resolve_physical().id == destination.id
        assert all(
            metadata.get_by_name(Table, table.fullyQualifiedName.root, include="all").deleted for table in tables
        )
