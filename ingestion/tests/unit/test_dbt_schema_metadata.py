"""
Exercise schema metadata with dbt artifacts and the OpenMetadata REST boundary.
"""

import fnmatch
import json
from copy import deepcopy
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit
from uuid import uuid4

import jsonpatch
import pytest

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.ingestion.source.database.dbt.dbt_config import _merge_dbt_files
from metadata.ingestion.source.database.dbt.metadata import DbtSource
from metadata.ingestion.source.database.dbt.models import DbtFiles

SOURCE_MANIFEST = Path(__file__).parent / "resources" / "datasets" / "manifest_source_identifier.json"
SOURCE_ID = "source.jaffle_shop.raw.orders"
OTHER_SOURCE_ID = "source.jaffle_shop.payments.payments"
SCHEMA_FQN = "warehouse.RAW_DB.RAW"


def _reference(entity_type, name):
    return {"id": str(uuid4()), "type": entity_type, "name": name, "fullyQualifiedName": name}


class Catalog:
    def __init__(self):
        self.database = _reference("database", "warehouse.RAW_DB")
        self.service = _reference("databaseService", "warehouse")
        self.domain = _reference("domain", "Analytics")
        self.owner = _reference("team", "DataEngineering")
        self.settings_error = None
        self.concurrent_change = False
        self.patch_failure = None
        self.schema = {
            "id": str(uuid4()),
            "name": "RAW",
            "fullyQualifiedName": SCHEMA_FQN,
            "database": self.database,
            "service": self.service,
            "version": 0.1,
        }
        self.tables = {
            f"{SCHEMA_FQN}.{name}": {
                "id": str(uuid4()),
                "name": name,
                "fullyQualifiedName": f"{SCHEMA_FQN}.{name}",
                "databaseSchema": {"type": "databaseSchema", "id": self.schema["id"]},
                "columns": [],
            }
            for name in ("raw_orders", "raw_payments", "stg_orders")
        }
        self.properties = {"reviewed": "boolean", "quality": "integer", "name": "string"}
        self.reads = []
        self.patches = []
        self.attempts = []

    def get(self, path):
        parts = urlsplit(path)
        route = unquote(parts.path)
        query = parse_qs(parts.query)
        self.reads.append(route)
        if route == "/search/fieldQuery":
            pattern = query["fieldValue"][0].lower()
            hits = [
                {"_source": {"fullyQualifiedName": name}}
                for name in self.tables
                if fnmatch.fnmatchcase(name.lower(), pattern)
            ]
            size = int(query["size"][0])
            return {"hits": {"hits": hits[:size], "total": {"relation": "eq", "value": len(hits)}}}
        if route.startswith("/tables/name/"):
            return deepcopy(self.tables.get(route.removeprefix("/tables/name/"))) or self._missing()
        if route.startswith("/tables/"):
            return deepcopy(self._table_by_id(route.removeprefix("/tables/")))
        if route in {
            f"/databaseSchemas/{self.schema['id']}",
            f"/databaseSchemas/name/{self.schema['fullyQualifiedName']}",
        }:
            return deepcopy(self.schema)
        if route == "/domains/name/Analytics":
            return {
                "id": self.domain["id"],
                "name": "Analytics",
                "fullyQualifiedName": "Analytics",
                "domainType": "Aggregate",
                "description": "Analytics",
            }
        if route == "/teams/name/DataEngineering":
            return {
                "id": self.owner["id"],
                "name": "DataEngineering",
                "fullyQualifiedName": "DataEngineering",
                "teamType": "Group",
            }
        if route == "/system/settings/assetCertificationSettings":
            if self.settings_error:
                raise APIError({"code": self.settings_error, "message": "Settings could not be read"})
            return {
                "config_type": "assetCertificationSettings",
                "config_value": {"allowedClassification": "Certification", "validityPeriod": "P30D"},
            }
        if route in {"/tags/name/Tier.Tier1", "/tags/name/Certification.Gold", "/tags/name/Other.Gold"}:
            name = route.removeprefix("/tags/name/")
            return {"id": str(uuid4()), "name": name.split(".")[-1], "fullyQualifiedName": name, "description": "Tag"}
        if route in {"/glossaryTerms/name/Business.Customer", "/glossaryTerms/name/Business.Payment"}:
            name = route.removeprefix("/glossaryTerms/name/")
            return {
                "id": str(uuid4()),
                "name": name.split(".")[-1],
                "fullyQualifiedName": name,
                "description": "Term",
                "glossary": _reference("glossary", "Business"),
            }
        if route == "/metadata/types/name/databaseSchema":
            return {
                "customProperties": [
                    {"name": name, "propertyType": {"name": property_type}}
                    for name, property_type in self.properties.items()
                ]
            }
        if route == "/metadata/types/name/table":
            return {"customProperties": [{"name": "name", "propertyType": {"name": "string"}}]}
        if route.startswith("/metadata/types/name/"):
            return {"customProperties": []}
        return self._missing()

    def _table_by_id(self, table_id):
        for table in self.tables.values():
            if table["id"] == table_id:
                return table
        return self._missing()

    @staticmethod
    def _missing():
        raise APIError({"code": 404, "message": "Not found"})

    def patch(self, path, data, headers=None):
        if path.startswith("/tables/"):
            table = self._table_by_id(path.removeprefix("/tables/"))
            jsonpatch.apply_patch(table, json.loads(data), in_place=True)
            return deepcopy(table)
        assert path == f"/databaseSchemas/{self.schema['id']}"
        assert headers == {"If-Match": f'W/"{self.schema["version"]}"'}
        operations = json.loads(data)
        self.attempts.append(operations)
        if self.concurrent_change:
            self.concurrent_change = False
            self.schema["domains"] = [_reference("domain", "Concurrent")]
            self.schema["extension"] = {"manual": "keep me"}
            self.schema["version"] = 0.2
            raise APIError({"code": 412, "message": "Precondition failed"})
        if self.patch_failure:
            raise APIError({"code": self.patch_failure, "message": "sensitive property contents"})
        if any(
            operation["path"] == "/certification" and operation["value"]["tagLabel"]["tagFQN"] == "Other.Gold"
            for operation in operations
        ):
            raise APIError(
                {"code": 400, "message": "Invalid Classification: Other.Gold is not valid for Certification."}
            )
        self.patches.append(operations)
        self.schema = jsonpatch.apply_patch(self.schema, operations)
        if self.schema.get("certification") and not self.schema["certification"]["appliedDate"]:
            self.schema["certification"].update(appliedDate=10000, expiryDate=20000)
        self.schema["version"] = round(self.schema["version"] + 0.1, 1)
        return deepcopy(self.schema)


@pytest.fixture
def manifest():
    payload = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    payload["nodes"]["model.jaffle_shop.orders"].pop("compiled_code", None)
    first = payload["sources"][SOURCE_ID]
    second = deepcopy(first)
    second.update(
        name="payments",
        identifier="raw_payments",
        unique_id=OTHER_SOURCE_ID,
        source_name="payments",
        fqn=["jaffle_shop", "payments", "payments"],
    )
    first["meta"] = {"openmetadata": {"customProperties": {"name": "table orders"}}}
    first["source_meta"] = {"openmetadata": {"domain": "Analytics", "customProperties": {"reviewed": False}}}
    second["meta"] = {"openmetadata": {"customProperties": {"name": "table payments"}}}
    second["source_meta"] = {"openmetadata": {"domain": "Analytics", "customProperties": {"quality": 0}}}
    payload["sources"][OTHER_SOURCE_ID] = second
    return payload


@pytest.fixture
def source_factory(tmp_path):
    def build(manifest, *, enabled=None, **options):
        manifest_path = tmp_path / "manifest.json"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        catalog = Catalog()
        metadata = OpenMetadata(
            OpenMetadataConnection(
                hostPort="http://localhost:8585/api",
                authProvider="openmetadata",
                securityConfig={"jwtToken": "test-token"},
                enableVersionValidation=False,
            )
        )
        metadata.client = catalog
        config = {
            "type": "dbt",
            "serviceName": "warehouse",
            "sourceConfig": {
                "config": {
                    "type": "DBT",
                    "includeTags": False,
                    **({"includeSchemaMetadata": enabled} if enabled is not None else {}),
                    "dbtConfigSource": {"dbtConfigType": "local", "dbtManifestFilePath": str(manifest_path)},
                    **options,
                }
            },
        }
        source = DbtSource.create(config, metadata)
        return source, catalog

    return build


def _table_links(source):
    records = list(source._iter())
    assert all(record.left is None for record in records), [record.left for record in records if record.left]
    return [
        model_str(record.right.table_entity.fullyQualifiedName)
        for record in records
        if isinstance(record.right, DataModelLink)
    ]


def test_source_meta_patches_existing_schema_once_and_keeps_table_outputs(manifest, source_factory):
    source, catalog = source_factory(manifest, enabled=True)
    tables = _table_links(source)

    assert set(tables) == {f"{SCHEMA_FQN}.raw_orders", f"{SCHEMA_FQN}.raw_payments", f"{SCHEMA_FQN}.stg_orders"}
    assert len(catalog.patches) == 1
    assert catalog.schema["domains"] == [{"type": "domain", "id": catalog.domain["id"]}]
    assert catalog.schema["extension"] == {"reviewed": False, "quality": 0}
    assert catalog.tables[f"{SCHEMA_FQN}.raw_orders"]["extension"] == {"name": "table orders"}
    assert catalog.tables[f"{SCHEMA_FQN}.raw_payments"]["extension"] == {"name": "table payments"}
    assert catalog.reads.count("/metadata/types/name/databaseSchema") == 1

    assert _table_links(source) == tables
    assert len(catalog.patches) == 1


def test_schema_metadata_uses_case_insensitive_source_table_binding(manifest, source_factory):
    source, catalog = source_factory(manifest, enabled=True)
    schema_fqn = SCHEMA_FQN.lower()
    catalog.schema.update(name="raw", fullyQualifiedName=schema_fqn)
    catalog.database.update(name="raw_db", fullyQualifiedName="warehouse.raw_db")
    catalog.tables = {
        name.lower(): {**table, "fullyQualifiedName": name.lower()} for name, table in catalog.tables.items()
    }

    assert f"{schema_fqn}.raw_orders" in _table_links(source)
    assert len(catalog.patches) == 1
    assert catalog.schema["extension"] == {"reviewed": False, "quality": 0}
    assert not source.status.failures


@pytest.mark.parametrize("enabled", [None, False])
def test_disabled_schema_metadata_keeps_table_outputs(manifest, source_factory, enabled):
    source, catalog = source_factory(manifest, enabled=enabled)
    assert len(_table_links(source)) == 3
    assert not catalog.patches
    assert not any("databaseSchema" in route for route in catalog.reads)


@pytest.mark.parametrize("source_meta", [{}, None])
def test_empty_source_meta_does_not_fall_back_to_table_meta(manifest, source_factory, source_meta):
    for node in manifest["sources"].values():
        if source_meta is None:
            node.pop("source_meta")
        else:
            node["source_meta"] = source_meta
    source, catalog = source_factory(manifest, enabled=True)

    assert len(_table_links(source)) == 3
    assert not catalog.patches
    assert not any("databaseSchema" in route for route in catalog.reads)


def test_cloud_merged_artifacts_use_the_active_manifest_declarations(manifest, source_factory):
    oldest = deepcopy(manifest)
    oldest["sources"][SOURCE_ID]["source_meta"]["openmetadata"]["customProperties"]["reviewed"] = True
    oldest["sources"][OTHER_SOURCE_ID]["source_meta"]["openmetadata"]["customProperties"]["quality"] = 99
    merged = DbtFiles(dbt_manifest=manifest)
    _merge_dbt_files(merged, DbtFiles(dbt_manifest=oldest))
    source, catalog = source_factory(merged.dbt_manifest, enabled=True)

    assert len(_table_links(source)) == 3
    assert catalog.schema["extension"] == {"reviewed": False, "quality": 0}
    assert len(catalog.patches) == 1


def test_conflicting_declarations_skip_only_the_conflicting_field(manifest, source_factory):
    manifest["sources"][OTHER_SOURCE_ID]["source_meta"]["openmetadata"]["customProperties"]["reviewed"] = True
    source, catalog = source_factory(manifest, enabled=True)
    catalog.schema["extension"] = {"reviewed": True, "manual": "keep me"}
    _table_links(source)

    assert catalog.schema["extension"] == {"reviewed": True, "manual": "keep me", "quality": 0}
    assert len(catalog.patches) == 1
    [warning] = [next(iter(item.values())) for item in source.status.warnings if "Conflicting" in str(item)]
    assert SOURCE_ID in warning and OTHER_SOURCE_ID in warning


def test_refetches_after_precondition_failure_and_preserves_new_direct_domain(manifest, source_factory):
    source, catalog = source_factory(manifest, enabled=True)
    catalog.concurrent_change = True
    _table_links(source)

    assert len(catalog.attempts) == 2
    assert {operation["path"] for operation in catalog.attempts[0]} == {"/domains", "/extension"}
    assert {operation["path"] for operation in catalog.attempts[1]} == {"/extension"}
    assert catalog.schema["domains"][0]["name"] == "Concurrent"
    assert catalog.schema["extension"] == {"reviewed": False, "quality": 0, "manual": "keep me"}


@pytest.mark.parametrize("code", [403, 404, 412])
def test_schema_patch_failure_is_scoped_and_sanitized(manifest, source_factory, code):
    source, catalog = source_factory(manifest, enabled=True)
    catalog.patch_failure = code
    _table_links(source)

    assert len(catalog.attempts) == 1
    assert not catalog.patches
    [failure] = source.status.failures
    assert failure.name == SCHEMA_FQN
    assert "extension" in failure.error
    assert "sensitive property contents" not in failure.error


def test_scan_uses_exact_schema_only_when_source_table_is_missing(manifest, source_factory):
    source, catalog = source_factory(manifest, enabled=True)
    del catalog.tables[f"{SCHEMA_FQN}.raw_orders"]
    del catalog.tables[f"{SCHEMA_FQN}.raw_payments"]
    _table_links(source)

    assert len(catalog.patches) == 1
    assert catalog.reads.count(f"/databaseSchemas/name/{SCHEMA_FQN}") == 1
    assert catalog.schema["extension"] == {"reviewed": False, "quality": 0}


def test_ambiguous_cross_service_table_never_selects_a_schema(manifest, source_factory):
    source, catalog = source_factory(manifest, enabled=True, searchAcrossDatabases=True)
    original = catalog.tables.pop(f"{SCHEMA_FQN}.raw_orders")
    for service in ("east", "west"):
        table_fqn = f"{service}.RAW_DB.RAW.raw_orders"
        catalog.tables[table_fqn] = {
            **original,
            "fullyQualifiedName": table_fqn,
            "id": str(uuid4()),
            "databaseSchema": _reference("databaseSchema", f"{service}.RAW_DB.RAW"),
        }
    _table_links(source)

    assert catalog.schema["extension"] == {"quality": 0}
    assert any("Ambiguous physical source" in warning.get(SOURCE_ID, "") for warning in source.status.warnings)


def test_filtered_source_does_not_contribute_schema_metadata(manifest, source_factory):
    source, catalog = source_factory(manifest, enabled=True, tableFilterPattern={"excludes": ["raw_orders"]})
    assert f"{SCHEMA_FQN}.raw_orders" not in _table_links(source)
    assert catalog.schema["extension"] == {"quality": 0}


@pytest.mark.parametrize(
    ("settings_error", "requested_label", "applied_label"),
    [
        (None, "Gold", "Certification.Gold"),
        (403, "Certification.Gold", "Certification.Gold"),
        (403, "Gold", None),
        (503, "Gold", None),
        (403, "Other.Gold", None),
    ],
)
def test_certification_resolution_and_repeated_runs(
    manifest, source_factory, settings_error, requested_label, applied_label
):
    manifest["sources"][SOURCE_ID]["source_meta"]["openmetadata"]["certification"] = requested_label
    source, catalog = source_factory(manifest, enabled=True)
    catalog.settings_error = settings_error
    _table_links(source)

    assert len(catalog.patches) == 1
    assert catalog.schema["extension"]["reviewed"] is False
    expected_certification = catalog.schema.get("certification")
    if applied_label:
        assert expected_certification["tagLabel"]["tagFQN"] == applied_label
        assert expected_certification["expiryDate"] == 20000
    else:
        assert expected_certification is None

    _table_links(source)
    assert catalog.schema.get("certification") == expected_certification
    assert len(catalog.patches) == 1


def test_inherited_owner_and_domain_can_be_overridden_alongside_tags(manifest, source_factory):
    manifest["sources"][SOURCE_ID]["source_meta"]["owner"] = "DataEngineering"
    manifest["sources"][SOURCE_ID]["source_meta"]["openmetadata"].update(
        tier="Tier.Tier1", glossary=["Business.Customer"]
    )
    manifest["sources"][OTHER_SOURCE_ID]["source_meta"]["openmetadata"]["glossary"] = ["Business.Payment"]
    source, catalog = source_factory(manifest, enabled=True, dbtUpdateOwners=True)
    catalog.schema.update(
        owners=[{**_reference("team", "Parent"), "inherited": True}],
        domains=[{**_reference("domain", "Parent"), "inherited": True}],
        tags=[{"tagFQN": "Existing.Tag", "source": "Classification", "labelType": "Manual", "state": "Confirmed"}],
    )
    _table_links(source)

    assert catalog.schema["owners"] == [{"type": "team", "id": catalog.owner["id"]}]
    assert catalog.schema["domains"] == [{"type": "domain", "id": catalog.domain["id"]}]
    assert {tag["tagFQN"] for tag in catalog.schema["tags"]} == {
        "Existing.Tag",
        "Tier.Tier1",
        "Business.Customer",
        "Business.Payment",
    }
    assert len(catalog.patches) == 1


def test_mapped_cross_service_table_selects_its_quoted_schema(manifest, source_factory):
    original_schema = manifest["sources"][SOURCE_ID]["schema"]
    for node in manifest["sources"].values():
        node["schema"] = "raw.layer"
    source, catalog = source_factory(manifest, enabled=True, catalogMapping={"RAW_DB": "mapped.catalog"})
    target_fqn = 'other_service."mapped.catalog"."raw.layer"'
    catalog.schema["fullyQualifiedName"] = target_fqn
    for name in ("raw_orders", "raw_payments"):
        old_fqn = f"warehouse.RAW_DB.{original_schema}.{name}"
        table = catalog.tables.pop(old_fqn)
        fqn = f"{target_fqn}.{name}"
        table["fullyQualifiedName"] = fqn
        catalog.tables[fqn] = table

    assert f"{target_fqn}.raw_orders" in _table_links(source)
    assert len(catalog.patches) == 1
    assert catalog.schema["extension"] == {"reviewed": False, "quality": 0}


def test_missing_or_inactive_sources_leave_schema_untouched(manifest, source_factory):
    manifest["disabled"] = {SOURCE_ID: [manifest["sources"].pop(SOURCE_ID)]}
    manifest["sources"][OTHER_SOURCE_ID]["config"] = {"enabled": False}
    manifest["nodes"] = {}
    source, catalog = source_factory(manifest, enabled=True)

    _table_links(source)

    assert not catalog.patches
    assert not any("databaseSchema" in route for route in catalog.reads)


def test_schema_without_a_version_is_never_patched(manifest, source_factory):
    source, catalog = source_factory(manifest, enabled=True)
    del catalog.schema["version"]
    _table_links(source)

    assert not catalog.attempts
    [failure] = source.status.failures
    assert failure.name == SCHEMA_FQN
    assert "did not accept the schema version precondition" in failure.error


def test_invalid_declarations_leave_other_schema_fields_eligible(manifest, source_factory):
    manifest["sources"][SOURCE_ID]["source_meta"]["openmetadata"].update(
        domain="MissingDomain",
        tier="NotTier.Gold",
        glossary=["Missing.Term", 17],
        customProperties={"reviewed": "false", "undefinedProperty": "never applied"},
    )
    source, catalog = source_factory(manifest, enabled=True)
    _table_links(source)

    assert catalog.schema["extension"] == {"quality": 0}
    assert catalog.schema["domains"] == [{"type": "domain", "id": catalog.domain["id"]}]
    assert "tags" not in catalog.schema
    assert len(catalog.patches) == 1
    assert any("undefinedProperty" in item.get(SOURCE_ID, "") for item in source.status.warnings)
    assert any("schema tier" in item.get(SOURCE_ID, "") for item in source.status.warnings)
    assert any("schema glossary" in item.get(SOURCE_ID, "") for item in source.status.warnings)


def test_already_bound_quoted_catalog_keeps_its_schema(manifest, source_factory):
    for node in manifest["sources"].values():
        node["database"] = "raw.catalog"
    source, catalog = source_factory(manifest, enabled=True, catalogMapping={"raw.catalog": "mapped.catalog"})
    actual_fqn = 'warehouse."raw.catalog".RAW'
    decoy_fqn = 'other_service."mapped.catalog".RAW'
    catalog.schema["fullyQualifiedName"] = actual_fqn
    decoy = _reference("databaseSchema", decoy_fqn)
    for name in ("raw_orders", "raw_payments"):
        original = catalog.tables.pop(f"{SCHEMA_FQN}.{name}")
        original["fullyQualifiedName"] = f"{actual_fqn}.{name}"
        catalog.tables[original["fullyQualifiedName"]] = original
        catalog.tables[f"{decoy_fqn}.{name}"] = {
            **original,
            "id": str(uuid4()),
            "fullyQualifiedName": f"{decoy_fqn}.{name}",
            "databaseSchema": decoy,
        }

    assert f"{actual_fqn}.raw_orders" in _table_links(source)
    assert len(catalog.patches) == 1
    assert catalog.schema["extension"] == {"reviewed": False, "quality": 0}
    assert not source.status.failures
