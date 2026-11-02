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

"""Reviewable, checkpointed BigQuery shard catalog migration."""

import json
from copy import deepcopy
from pathlib import Path

from metadata.config.common import load_config_file
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import BigQueryConnection
from metadata.generated.schema.metadataIngestion.workflow import OpenMetadataWorkflowConfig
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.bigquery.helper import get_bigquery_client_for_project
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource
from metadata.ingestion.source.database.bigquery.sharding import eligible_shard, inventory_families, logical_shard_name
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table

ANNOTATIONS = ("description", "owners", "tags", "extension")
MAX_CATALOG_MEMBERS = 10_000


def checkpoint(path: Path, manifest: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(manifest, indent=2) + "\n")
    temporary.replace(path)


def merge_annotations(tables: list[Table], representative: Table) -> tuple[dict, list[str]]:
    conflicts = []
    result = {}
    for field in ANNOTATIONS:
        values = [table.model_dump(mode="json").get(field) for table in tables]
        populated = [value for value in values if value]
        if field in ("tags", "owners"):
            merged = {}
            for values in populated:
                for value in values:
                    key = value.get("tagFQN") or value["id"]
                    if key in merged and merged[key] != value:
                        conflicts.append(f"Conflicting {field}: {key}")
                    merged[key] = value
            if merged:
                result[field] = list(merged.values())
        elif field == "extension":
            merged = {}
            for values in populated:
                for key, value in values.items():
                    if key in merged and merged[key] != value:
                        conflicts.append(f"Conflicting extension: {key}")
                    merged[key] = value
            if merged:
                result[field] = merged
        elif populated and any(value != populated[0] for value in populated[1:]):
            conflicts.append(f"Conflicting {field}")
        elif populated:
            result[field] = populated[0]
    columns, column_conflicts = merge_columns(tables, representative)
    result["columns"] = columns
    return result, sorted(set(conflicts + column_conflicts))


def merge_columns(tables: list[Table], representative: Table) -> tuple[list[dict], list[str]]:
    conflicts = []
    columns = representative.model_dump(mode="json")["columns"]
    by_name = {column["name"]: column for column in columns}
    for table in tables:
        for column in table.model_dump(mode="json")["columns"]:
            target = by_name.get(column["name"])
            if not target or (target["dataType"], target.get("arrayDataType"), target.get("children")) != (
                column["dataType"],
                column.get("arrayDataType"),
                column.get("children"),
            ):
                if any(column.get(field) for field in ("description", "tags")):
                    conflicts.append(f"Unmatched or incompatible column {column['name']}")
                continue
            for field in ("description", "tags"):
                if target.get(field) and column.get(field) and target[field] != column[field]:
                    conflicts.append(f"Conflicting column {column['name']} {field}")
                elif column.get(field):
                    target[field] = column[field]
    return columns, sorted(set(conflicts))


def preview_edges(metadata, table, source_ids, destination):
    graph = metadata.get_lineage_by_id(Table, table.id)
    if graph is None:
        raise ValueError("Lineage inventory failed; preview is incomplete")
    nodes = {node["id"]: node for node in [graph["entity"], *graph.get("nodes", [])]}
    edges, blocks = [], []
    for edge in graph.get("upstreamEdges", []) + graph.get("downstreamEdges", []):
        details = deepcopy(edge.get("lineageDetails") or {})
        if details.get("columnsLineage"):
            blocks.append("Column lineage requires explicit compatible-column review")
            continue
        if edge["fromEntity"] in source_ids and edge["toEntity"] in source_ids:
            blocks.append("Lineage between members cannot become a self edge")
            continue
        refs = {}
        for side in ("fromEntity", "toEntity"):
            identity = edge[side]
            refs[side] = {"id": identity, "type": nodes[identity]["type"]}
            if identity in source_ids:
                refs[side]["fullyQualifiedName"] = destination
        edges.append({**refs, "lineageDetails": details})
    return edges, blocks


def transfer_edges(metadata, family, save):
    for index, edge in enumerate(family["edges"]):
        if str(index) in family["transferredEdges"]:
            continue
        payload = deepcopy(edge)
        for side in ("fromEntity", "toEntity"):
            if payload[side].get("fullyQualifiedName") == family["destination"]:
                payload[side]["id"] = family["destinationId"]
        metadata.add_lineage(AddLineageRequest(edge=payload))
        family["transferredEdges"].append(str(index))
        save()


def validate_destination(metadata, family):
    destination = metadata.get_by_name(Table, family["destination"], fields=["owners", "tags", "extension"])
    if not destination or str(destination.id.root) != family["destinationId"]:
        raise ValueError("Destination identity could not be validated")
    stored = destination.model_dump(mode="json")
    for field in (*ANNOTATIONS, "tableSharding"):
        expected = family["request"].get(field)
        if stored.get(field) != expected and (stored.get(field) or expected):
            raise ValueError(f"Destination {field} differs from reviewed metadata")
    for column in family["request"]["columns"]:
        actual = next((item for item in stored["columns"] if item["name"] == column["name"]), None)
        if not actual or any(actual.get(key) != column.get(key) for key in ("dataType", "description", "tags")):
            raise ValueError("Destination column annotations differ from reviewed metadata")
    graph = metadata.get_lineage_by_id(Table, destination.id)
    if graph is None:
        raise ValueError("Destination lineage could not be validated")
    actual_edges = {
        (edge["fromEntity"], edge["toEntity"]): edge
        for edge in graph.get("upstreamEdges", []) + graph.get("downstreamEdges", [])
    }
    for edge in family["edges"]:
        ids = tuple(
            family["destinationId"]
            if edge[side].get("fullyQualifiedName") == family["destination"]
            else edge[side]["id"]
            for side in ("fromEntity", "toEntity")
        )
        if ids not in actual_edges:
            raise ValueError("Destination lineage differs from reviewed relationships")
    for case in family["tests"]:
        mapping = family["testMappings"].get(case["oldId"])
        current = (
            metadata.get_by_id(TestCase, mapping["id"], fields=["testDefinition", "testSuite"]) if mapping else None
        )
        if (
            not current
            or current.entityLink.root != case["request"]["entityLink"]
            or current.testDefinition.fullyQualifiedName != case["request"]["testDefinition"]
        ):
            raise ValueError("Destination test case differs from reviewed mapping")


def preview_family(metadata, schema_fqn: str, family, source_tables: list[Table], descriptor) -> dict:
    target_fqn = fqn._build(*fqn.split(schema_fqn), logical_shard_name(family.prefix))
    representative = next((table for table in source_tables if table.name.root == family.representative), None)
    conflicts = []
    if representative is None:
        conflicts.append("Representative must first be ingested with grouping disabled")
    annotations, annotation_conflicts = merge_annotations(source_tables, representative or source_tables[0])
    conflicts.extend(annotation_conflicts)
    existing = metadata.get_by_name(Table, target_fqn, include="all")
    if existing:
        conflicts.append("Destination already exists; explicit identity resolution required")
    tests = []
    retirement_blocks = []
    edges = []
    source_ids = {str(table.id.root) for table in source_tables}
    for table in source_tables:
        name = model_str(table.fullyQualifiedName)
        cases = metadata.list_all_entities(
            TestCase,
            params={"entityLink": f"<#E::table::{name}>", "includeAllTests": "true"},
            fields=["testDefinition", "testSuite", "owners", "reviewers"],
        )
        for case in cases:
            if not case.testDefinition.fullyQualifiedName:
                conflicts.append("Test definition reference is incomplete")
                continue
            payload = {
                key: value
                for key, value in case.model_dump(mode="json", exclude_none=True).items()
                if key in CreateTestCaseRequest.model_fields
            }
            payload["testDefinition"] = case.testDefinition.fullyQualifiedName
            if case.dataQualityDimension:
                payload["dataQualityDimension"] = case.dataQualityDimension.name
            payload["entityLink"] = case.entityLink.root.replace(f"<#E::table::{name}", f"<#E::table::{target_fqn}", 1)
            payload = CreateTestCaseRequest.model_validate(payload).model_dump(mode="json", exclude_none=True)
            tests.append(
                {
                    "oldId": str(case.id.root),
                    "oldFqn": case.fullyQualifiedName.root,
                    "version": case.model_dump(mode="json")["version"],
                    "request": payload,
                }
            )
            retirement_blocks.append("Original test cases/history require retaining their physical table identity")
        table_edges, blocks = preview_edges(metadata, table, source_ids, target_fqn)
        edges.extend(edge for edge in table_edges if edge not in edges)
        retirement_blocks.extend(blocks)
        retirement_blocks.extend(
            f"Unsupported reference transfer: {field}"
            for field in ("followers", "dataProducts", "domains", "dataModel", "tableConstraints")
            if getattr(table, field, None)
        )
    by_name = {}
    for test in tests:
        name = test["request"]["name"]
        if name in by_name and by_name[name] != test["request"]:
            conflicts.append(f"Conflicting test case {name}")
        by_name[name] = test["request"]
    request = CreateTableRequest(
        name=EntityName(logical_shard_name(family.prefix)),
        databaseSchema=FullyQualifiedEntityName(schema_fqn),
        tableType=TableType.Sharded,
        tableSharding=descriptor,
        tablePartition=representative.tablePartition if representative else None,
        **annotations,
    )
    return {
        "state": "planned",
        "destination": target_fqn,
        "request": request.model_dump(mode="json", exclude_none=True),
        "sources": [
            {
                "id": str(table.id.root),
                "fqn": model_str(table.fullyQualifiedName),
                "version": table.model_dump(mode="json")["version"],
            }
            for table in source_tables
        ],
        "conflicts": sorted(set(conflicts)),
        "retirementBlocks": sorted(set(retirement_blocks)),
        "tests": tests,
        "testMappings": {},
        "retiredIds": [],
        "edges": edges,
        "transferredEdges": [],
    }


def transfer_tests(metadata, family, save):
    for case in family["tests"]:
        if case["oldId"] in family["testMappings"]:
            continue
        old = metadata.get_by_id(TestCase, case["oldId"], fields=["testDefinition", "testSuite"])
        if not old or old.model_dump(mode="json")["version"] != case["version"]:
            raise ValueError("Source test case changed since preview")
        request = CreateTestCaseRequest.model_validate(case["request"])
        new_case = metadata.create_or_update(request)
        if str(new_case.id.root) == case["oldId"]:
            raise ValueError("Migrated test case must have a distinct identity")
        family["testMappings"][case["oldId"]] = {"id": str(new_case.id.root), "fqn": new_case.fullyQualifiedName.root}
        save()


def apply_family(metadata, family: dict, save, retire=False) -> None:
    if family["conflicts"]:
        raise ValueError("Resolve manifest conflicts before applying this family")
    validate_sources(metadata, family, save)
    if family["state"] == "retired":
        return
    if family["state"] == "planned":
        destination = metadata.get_by_name(Table, family["destination"], include="all")
        if destination is not None:
            if not family.get("creationStarted") or destination.deleted or destination.tableType != TableType.Sharded:
                raise ValueError("Destination appeared after preview; review a fresh manifest")
            if destination.tableSharding.model_dump(mode="json") != family["request"]["tableSharding"]:
                raise ValueError("Interrupted destination does not match reviewed descriptor")
        else:
            family["creationStarted"] = True
            save()
            destination = metadata.create_or_update(CreateTableRequest.model_validate(family["request"]))
        family["destinationId"] = str(destination.id.root)
        family["state"] = "created"
        save()
    transfer_tests(metadata, family, save)
    transfer_edges(metadata, family, save)
    validate_destination(metadata, family)
    family["state"] = "validated"
    save()
    if retire:
        if family["retirementBlocks"]:
            raise ValueError("Retirement blocked: " + "; ".join(family["retirementBlocks"]))
        for source in family["sources"]:
            if source["id"] not in family["retiredIds"]:
                if source["id"] not in family.setdefault("retirementStarted", []):
                    family["retirementStarted"].append(source["id"])
                    save()
                metadata.delete(Table, source["id"], recursive=False, hard_delete=False)
                family["retiredIds"].append(source["id"])
                save()
        family["state"] = "retired"
        save()


def run_migration(args) -> None:
    config = OpenMetadataWorkflowConfig.model_validate(load_config_file(args.config))
    service_connection = config.source.serviceConnection
    connection = service_connection.root.config if service_connection else None
    if not isinstance(connection, BigQueryConnection):
        raise TypeError("This migration requires a BigQuery service")
    path = args.apply or args.output
    if not path:
        raise ValueError("Provide --output for preview or --apply for a reviewed manifest")
    if args.retire and not args.apply:
        raise ValueError("--retire requires --apply")
    manifest = (
        json.loads(path.read_text())
        if args.apply
        else {"formatVersion": 1, "service": config.source.serviceName, "families": []}
    )
    if manifest.get("formatVersion") != 1:
        raise ValueError("Unsupported migration manifest version")
    if manifest["service"] != config.source.serviceName:
        raise ValueError("Manifest service does not match workflow")
    metadata = OpenMetadata(config.workflowConfig.openMetadataServerConfig)
    try:
        _run_migration(metadata, config, manifest, path, bool(args.apply), args.retire)
    finally:
        metadata.close()


def _run_migration(metadata, config, manifest, path, applying, retire):
    connection = config.source.serviceConnection.root.config
    scope = config.source.sourceConfig.config
    if not scope.includeTables:
        raise ValueError("Migration requires includeTables")
    discovered = {}
    catalog_count = 0
    for project in BigquerySource.set_project_id(connection):
        database_fqn = fqn._build(config.source.serviceName, project)
        if filter_by_database(scope.databaseFilterPattern, database_fqn if scope.useFqnForFiltering else project):
            continue
        client = get_bigquery_client_for_project(project, connection)
        try:
            for dataset in client.list_datasets(project=project):
                schema = dataset.dataset_id
                schema_fqn = fqn._build(config.source.serviceName, project, schema)
                if filter_by_schema(scope.schemaFilterPattern, schema_fqn if scope.useFqnForFiltering else schema):
                    continue
                families = inventory_families(
                    client.list_tables(f"{project}.{schema}"),
                    (connection.shardedTables.excludePatterns or ()) if connection.shardedTables else (),
                )
                families = {
                    prefix: family
                    for prefix, family in families.items()
                    if not filter_by_table(
                        scope.tableFilterPattern,
                        fqn._build(*fqn.split(schema_fqn), logical_shard_name(prefix))
                        if scope.useFqnForFiltering
                        else logical_shard_name(prefix),
                    )
                }
                catalog_members = (
                    _catalog_members(
                        metadata,
                        schema_fqn,
                        families,
                        (connection.shardedTables.excludePatterns or ()) if connection.shardedTables else (),
                    )
                    if not applying
                    else {}
                )
                catalog_count += sum(len(tables) for tables in catalog_members.values())
                if catalog_count > MAX_CATALOG_MEMBERS:
                    raise ValueError("Migration exceeds 10000 catalog members; narrow configured filters")
                for prefix, family in families.items():
                    descriptor = family.descriptor(project, schema)
                    destination = fqn._build(*fqn.split(schema_fqn), logical_shard_name(prefix))
                    if len(discovered) >= 10000:
                        raise ValueError("Migration preview exceeds 10000 families; narrow configured project scope")
                    discovered[destination] = descriptor.model_dump(mode="json")
                    if not applying:
                        tables = catalog_members.get(prefix, [])
                        if tables:
                            manifest["families"].append(
                                preview_family(metadata, schema_fqn, family, tables, descriptor)
                            )
        finally:
            client.close()
    if applying:
        for family in manifest["families"]:
            if discovered.get(family["destination"]) != family["request"]["tableSharding"]:
                raise ValueError("Source inventory changed; review a fresh migration preview")
        for family in manifest["families"]:
            apply_family(metadata, family, lambda: checkpoint(path, manifest), retire)
    else:
        checkpoint(path, manifest)


def _catalog_members(metadata, schema_fqn, families, exclusions=()):
    members = {}
    count = 0
    if not families:
        return members
    for table in metadata.list_all_entities(
        Table,
        params={"databaseSchema": schema_fqn},
        fields=["owners", "tags", "extension", "followers", "dataProducts", "domains", "dataModel", "tableConstraints"],
    ):
        parsed = eligible_shard(table.name.root, "TABLE", exclusions)
        if parsed and parsed[0] in families:
            count += 1
            if count > MAX_CATALOG_MEMBERS:
                raise ValueError("Migration exceeds 10000 catalog members; narrow configured filters")
            members.setdefault(parsed[0], []).append(table)
    return members


def validate_sources(metadata, family, save):
    for source in family["sources"]:
        current = metadata.get_by_id(Table, source["id"], fields=["owners", "tags", "extension"])
        if source["id"] in family.get("retirementStarted", []) and source["id"] not in family["retiredIds"]:
            retired = metadata.get_by_name(Table, source["fqn"], include="all")
            if retired and str(retired.id.root) == source["id"] and retired.deleted:
                family["retiredIds"].append(source["id"])
                save()
        if source["id"] not in family["retiredIds"] and (
            not current or current.model_dump(mode="json")["version"] != source["version"]
        ):
            raise ValueError(f"Catalog version changed: {source['fqn']}")
