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
"""Observable migration preview, recovery and retirement contracts."""

from copy import deepcopy
from types import SimpleNamespace
from uuid import uuid4

import pytest

from metadata.cli.bigquery_sharding import apply_family, preview_family
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.testCase import TestCase as Case
from metadata.ingestion.source.database.bigquery.sharding import inventory_families

SCHEMA = "demo_service.demo_project.demo_dataset"


class Catalog:
    def __init__(self):
        self.tables = {}
        self.edges = []
        self.cases = {}
        self.writes = []
        self.fail_after_create = False

    def get_by_name(self, entity, fqn, **kwargs):
        return next((table for table in self.tables.values() if table.fullyQualifiedName.root == fqn), None)

    def get_by_id(self, entity, identity, **kwargs):
        return (self.cases if entity is Case else self.tables).get(str(identity))

    def list_all_entities(self, entity, **kwargs):
        return (case for case in self.cases.values() if case.entityLink.root == kwargs["params"]["entityLink"])

    def get_lineage_by_id(self, entity, identity):
        return {
            "entity": {"id": str(identity.root), "type": "table"},
            "nodes": [],
            "upstreamEdges": [],
            "downstreamEdges": [],
        }

    def create_or_update(self, request):
        if isinstance(request, CreateTestCaseRequest):
            name = request.entityLink.root.removeprefix("<#E::table::").removesuffix(">") + "." + request.name.root
            existing = next((case for case in self.cases.values() if case.fullyQualifiedName.root == name), None)
            if existing:
                return existing
            case = Case(
                id=uuid4(),
                name=request.name,
                fullyQualifiedName=name,
                entityLink=request.entityLink,
                testDefinition={
                    "id": uuid4(),
                    "type": "testDefinition",
                    "fullyQualifiedName": request.testDefinition.root,
                },
                testSuite={"id": uuid4(), "type": "testSuite"},
                version=0.1,
            )
            self.cases[str(case.id.root)] = case
            self.writes.append(("test", str(case.id.root)))
            return case
        assert isinstance(request, CreateTableRequest)
        table = Table(
            id=uuid4(),
            fullyQualifiedName=f"{SCHEMA}.{request.name.root}",
            version=0.1,
            **{
                key: value
                for key, value in request.model_dump().items()
                if key in Table.model_fields and key != "databaseSchema"
            },
        )
        self.tables[str(table.id.root)] = table
        self.writes.append(("create", str(table.id.root)))
        if self.fail_after_create:
            self.fail_after_create = False
            raise ConnectionError("response lost after create")
        return table

    def delete(self, entity, identity, recursive, hard_delete):
        assert not recursive and not hard_delete
        self.tables[identity].deleted = True
        self.writes.append(("retire", identity))


def preview(descriptions=("Curated", "Curated")):
    catalog = Catalog()
    names = ["events_20260101", "events_20260102"]
    family = inventory_families(SimpleNamespace(table_id=name, table_type="TABLE") for name in names)["events_"]
    tables = [
        Table(
            id=uuid4(),
            name=name,
            fullyQualifiedName=f"{SCHEMA}.{name}",
            columns=[],
            version=0.1,
            description=description,
        )
        for name, description in zip(names, descriptions, strict=True)
    ]
    catalog.tables = {str(table.id.root): table for table in tables}
    manifest = preview_family(catalog, SCHEMA, family, tables, family.descriptor("demo_project", "demo_dataset"))
    return catalog, manifest


def test_preview_has_no_catalog_writes_and_records_source_identities():
    catalog, manifest = preview()
    assert catalog.writes == []
    assert manifest["state"] == "planned"
    assert manifest["request"]["description"] == "Curated"
    assert {item["id"] for item in manifest["sources"]} == set(catalog.tables)


def test_apply_keeps_old_identity_until_explicit_retirement_and_is_repeatable():
    catalog, manifest = preview()
    old = deepcopy(catalog.tables)
    apply_family(catalog, manifest, lambda: None)
    assert manifest["state"] == "validated"
    assert manifest["destinationId"] not in old
    assert all(catalog.tables[identity] == table for identity, table in old.items())
    apply_family(catalog, manifest, lambda: None, retire=True)
    apply_family(catalog, manifest, lambda: None, retire=True)
    assert manifest["state"] == "retired"
    assert [kind for kind, _ in catalog.writes] == ["create", "retire", "retire"]
    assert all(catalog.tables[identity].deleted for identity in old)


def test_interruption_after_server_creation_resumes_without_duplicate():
    catalog, manifest = preview()
    catalog.fail_after_create = True
    checkpoints = []
    with pytest.raises(ConnectionError):
        apply_family(catalog, manifest, lambda: checkpoints.append(deepcopy(manifest)))
    assert checkpoints[-1]["creationStarted"] is True
    apply_family(catalog, manifest, lambda: None)
    assert manifest["state"] == "validated"
    assert len(catalog.writes) == 1


def test_conflicting_annotations_block_all_writes():
    catalog, manifest = preview(("First", "Second"))
    with pytest.raises(ValueError, match="conflicts"):
        apply_family(catalog, manifest, lambda: None, retire=True)
    assert catalog.writes == []


def test_changed_catalog_version_invalidates_plan():
    catalog, manifest = preview()
    next(iter(catalog.tables.values())).version = 0.2
    with pytest.raises(ValueError, match="version changed"):
        apply_family(catalog, manifest, lambda: None)
    assert catalog.writes == []


def test_unsupported_transfer_keeps_sources_active():
    catalog, manifest = preview()
    manifest["retirementBlocks"] = ["Original test cases/history require retaining their physical table identity"]
    with pytest.raises(ValueError, match="Retirement blocked"):
        apply_family(catalog, manifest, lambda: None, retire=True)
    assert manifest["state"] == "validated"
    assert all(not catalog.tables[item["id"]].deleted for item in manifest["sources"])


def test_recreated_cases_use_new_ids_and_keep_original_cases_and_history():
    catalog, _ = preview()
    tables = list(catalog.tables.values())
    original = Case(
        id=uuid4(),
        name="row_count",
        fullyQualifiedName=f"{tables[0].fullyQualifiedName.root}.row_count",
        entityLink=f"<#E::table::{tables[0].fullyQualifiedName.root}>",
        version=0.1,
        testDefinition={"id": uuid4(), "type": "testDefinition", "fullyQualifiedName": "tableRowCountToBeBetween"},
        dataQualityDimension={"id": uuid4(), "type": "dataQualityDimension", "name": "Completeness"},
        testSuite={"id": uuid4(), "type": "testSuite"},
        testCaseResult={"timestamp": 1767398400, "testCaseStatus": "Success", "result": "original observation"},
    )
    catalog.cases[str(original.id.root)] = original
    old = original.model_copy(deep=True)
    family = inventory_families(SimpleNamespace(table_id=table.name.root, table_type="TABLE") for table in tables)[
        "events_"
    ]
    manifest = preview_family(catalog, SCHEMA, family, tables, family.descriptor("demo_project", "demo_dataset"))
    assert manifest["tests"][0]["request"]["dataQualityDimension"] == "Completeness"
    apply_family(catalog, manifest, lambda: None)
    apply_family(catalog, manifest, lambda: None)
    mapping = manifest["testMappings"][str(original.id.root)]
    assert mapping["id"] != str(original.id.root)
    assert mapping["fqn"] == f"{SCHEMA}.events_yyyymmdd.row_count"
    assert catalog.cases[str(original.id.root)] == old
    assert len(catalog.cases) == 2
    assert catalog.cases[mapping["id"]].testDefinition.fullyQualifiedName == old.testDefinition.fullyQualifiedName
    assert manifest["retirementBlocks"]


@pytest.mark.parametrize("use_fqn", [False, True])
def test_preview_obeys_configured_scope_without_catalog_writes(tmp_path, monkeypatch, use_fqn):
    from metadata.cli import bigquery_sharding as migration
    from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
        DatabaseServiceMetadataPipeline,
    )

    catalog, _ = preview()
    tables = list(catalog.tables.values())
    original_list = catalog.list_all_entities
    catalog.list_all_entities = lambda entity, **kwargs: (
        iter(tables) if entity is Table else original_list(entity, **kwargs)
    )
    scope = DatabaseServiceMetadataPipeline(
        useFqnForFiltering=use_fqn,
        databaseFilterPattern={"includes": ["demo_service.demo_project$" if use_fqn else "demo_project$"]},
        schemaFilterPattern={"includes": [SCHEMA + "$" if use_fqn else "demo_dataset$"]},
        tableFilterPattern={"includes": [SCHEMA + r"\.events_yyyymmdd$" if use_fqn else "events_yyyymmdd$"]},
    )
    listed = []
    closed = []

    class Client:
        def list_datasets(self, **kwargs):
            return [SimpleNamespace(dataset_id=name) for name in ("ignored", "demo_dataset")]

        def list_tables(self, name):
            listed.append(name)
            return [
                SimpleNamespace(table_id=name, table_type="TABLE")
                for name in ("events_20260101", "events_20260102", "other_20260101")
            ]

        def close(self):
            closed.append(True)

    monkeypatch.setattr(migration.BigquerySource, "set_project_id", lambda connection: ["ignored", "demo_project"])
    monkeypatch.setattr(migration, "get_bigquery_client_for_project", lambda project, connection: Client())
    config = SimpleNamespace(
        source=SimpleNamespace(
            serviceName="demo_service",
            sourceConfig=SimpleNamespace(config=scope),
            serviceConnection=SimpleNamespace(root=SimpleNamespace(config=SimpleNamespace(shardedTables=None))),
        )
    )
    manifest = {"formatVersion": 1, "service": "demo_service", "families": []}
    migration._run_migration(catalog, config, manifest, tmp_path / "preview.json", False, False)
    assert listed == ["demo_project.demo_dataset"]
    assert closed == [True]
    assert [family["destination"] for family in manifest["families"]] == [SCHEMA + ".events_yyyymmdd"]
    assert catalog.writes == []
    monkeypatch.setattr(migration, "MAX_CATALOG_MEMBERS", 1)
    with pytest.raises(ValueError, match="catalog members"):
        migration._run_migration(catalog, config, {"families": []}, tmp_path / "overflow.json", False, False)
    assert not (tmp_path / "overflow.json").exists()
    assert catalog.writes == []


def test_retirement_resumes_after_server_deleted_but_response_was_lost():
    catalog, manifest = preview()
    delete = catalog.delete

    def lose_response(*args, **kwargs):
        delete(*args, **kwargs)
        catalog.delete = delete
        raise ConnectionError("response lost after retirement")

    catalog.delete = lose_response
    with pytest.raises(ConnectionError):
        apply_family(catalog, manifest, lambda: None, retire=True)
    assert len(manifest["retirementStarted"]) == 1
    assert manifest["retiredIds"] == []
    apply_family(catalog, manifest, lambda: None, retire=True)
    assert manifest["state"] == "retired"
    assert len([kind for kind, _ in catalog.writes if kind == "retire"]) == 2


def test_excluded_physical_members_are_not_selected_for_migration():
    from metadata.cli.bigquery_sharding import _catalog_members

    catalog, _ = preview()
    catalog.list_all_entities = lambda *args, **kwargs: iter(catalog.tables.values())
    members = _catalog_members(catalog, SCHEMA, {"events_"}, [r"20260101$"])
    assert [table.name.root for table in members["events_"]] == ["events_20260102"]
