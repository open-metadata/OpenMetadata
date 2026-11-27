#  pylint: disable=too-many-lines
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
"""Apply the source declarations in a dbt run to existing database schemas."""

import json
from collections import defaultdict
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from types import SimpleNamespace
from typing import TYPE_CHECKING, Any
from uuid import UUID

from antlr4.error.Errors import ParseCancellationException

from metadata.generated.schema.configuration.assetCertificationSettings import AssetCertificationSettings
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import StackTraceError
from metadata.generated.schema.settings.settings import SettingType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel, TagSource
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.mixins.patch_mixin import (
    MAX_OPTIMISTIC_LOCK_RETRIES,
    _entity_etag,
    _is_precondition_failed,
    convert_uuids_to_strings,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.dbt.dbt_utils import (
    find_domain_by_name,
    format_domain_reference,
    get_corrected_name,
    get_source_physical_name,
    validate_custom_property_value,
)
from metadata.utils import fqn
from metadata.utils.tag_utils import get_tag_label, get_tag_labels

if TYPE_CHECKING:
    from metadata.ingestion.source.database.dbt.metadata import DbtSource

_SCHEMA_FIELDS = ["owners", "domains", "tags", "extension", "certification"]
_TIER = "Tier"
_UNREAD = object()


def _qualified_label(value: object) -> tuple[str, ...]:
    if not isinstance(value, str) or not value.strip():
        return ()
    try:
        return tuple(fqn.split(value.strip()))
    except (ValueError, ParseCancellationException):
        return ()


def _label_fqn(label: TagLabel) -> str:
    return model_str(label.tagFQN)


def _direct_refs(refs: list[EntityReference] | None) -> set[tuple[str, str]]:
    return {(ref.type, model_str(ref.id)) for ref in refs or [] if not ref.inherited}


def _ref_values(refs: list[EntityReference]) -> list[dict[str, str]]:
    return [{"type": entity_type, "id": entity_id} for entity_type, entity_id in sorted(_direct_refs(refs))]


@dataclass
class _SchemaDeclarations:
    name: str
    sources: list[tuple[str, object]] = dataclass_field(default_factory=list)


class _AmbiguousSourceError(ValueError):
    pass


class _SchemaWriteError(ValueError):
    """Carries a failure reason that can be shown without logging request values."""


class DbtSchemaMetadata:
    """Collect a run's declarations before writing any schema, including across Cloud environments."""

    def __init__(self, source: "DbtSource"):
        self.source = source
        self.metadata = source.metadata
        # One entry per declared schema and at most one declaration per active source table.
        self.schemas: dict[UUID, _SchemaDeclarations] = {}
        self.property_definitions: dict | None = None
        self.certification_classification: str | object | None = _UNREAD

    def collect(self, sources: dict, bindings: dict[str, Table | None]) -> None:
        exact_schemas: dict[tuple[str, str], DatabaseSchema | None] = {}
        for source_id, table in bindings.items():
            node = sources[source_id]
            config = getattr(node, "config", None)
            enabled = config.get("enabled") if isinstance(config, dict) else getattr(config, "enabled", None)
            if enabled is False:
                continue
            try:
                schema = self._resolve_schema(node, table, exact_schemas)
            except _AmbiguousSourceError:
                self.source.status.warning(source_id, "Ambiguous physical source; skipped schema metadata")
                continue
            except Exception as exc:
                self._failed(source_id, "resolve schema metadata target", exc)
                continue

            if schema:
                schema_id, schema_name = schema
                self.schemas.setdefault(schema_id, _SchemaDeclarations(schema_name)).sources.append(
                    (source_id, node.source_meta)
                )
            else:
                self.source.status.warning(source_id, "No existing physical database schema found for source metadata")

    def _resolve_schema(
        self, node: Any, table: Table | None, exact_schemas: dict[tuple[str, str], DatabaseSchema | None]
    ) -> tuple[UUID, str] | None:
        database = get_corrected_name(node.database)
        schema = get_corrected_name(node.schema_)
        mapped = self.source.catalog_mapping.get(database.casefold()) if database else None
        if binding := self._verified_binding(database, schema, get_source_physical_name(node), mapped, table):
            reference = binding.databaseSchema
            if reference is None:
                raise _SchemaWriteError("Physical table has no schema reference")
            schema_name = (
                model_str(reference.fullyQualifiedName)
                if reference.fullyQualifiedName
                else ".".join(fqn.split(model_str(binding.fullyQualifiedName))[:3])
            )
            return reference.id.root, schema_name

        if not schema:
            return None
        for catalog in dict.fromkeys((mapped, database)):
            if catalog is None:
                continue
            key = (catalog, schema)
            if key not in exact_schemas:
                schema_fqn = fqn.build(
                    self.metadata,
                    DatabaseSchema,
                    service_name=self.source.config.serviceName,
                    database_name=catalog,
                    schema_name=schema,
                )
                exact_schemas[key] = (
                    self.metadata.get_by_name(DatabaseSchema, schema_fqn) if isinstance(schema_fqn, str) else None
                )
            existing = exact_schemas[key]
            if existing and not existing.deleted:
                return existing.id.root, model_str(existing.fullyQualifiedName)
        return None

    def _verified_binding(
        self, database: str | None, schema: str | None, table_name: str, mapped: str | None, table: Table | None
    ) -> Table | None:
        service = self.source.config.serviceName
        scopes = [(service, database)]
        if self.source.source_config.searchAcrossDatabases:
            scopes.append((None, database))
        if mapped:
            scopes = [(service, mapped), (None, mapped), *scopes]

        actual_fqn = (
            model_str(table.fullyQualifiedName) if table and not table.deleted and table.fullyQualifiedName else None
        )
        wildcard_scopes = []
        for service_name, catalog in dict.fromkeys(scopes):
            if not (service_name and catalog and schema):
                wildcard_scopes.append((service_name, catalog))
                continue
            expected_fqn = fqn.build(
                self.metadata,
                Table,
                service_name=service_name,
                database_name=catalog,
                schema_name=schema,
                table_name=table_name,
                skip_es_search=True,
            )
            if actual_fqn and isinstance(expected_fqn, str) and actual_fqn.lower() == expected_fqn.lower():
                return table

        for service_name, catalog in wildcard_scopes:
            # Ordinary table ingestion may take the first search match. A schema write
            # needs a unique binding, including the hits omitted from the first page.
            pattern = ".".join(
                fqn.quote_name(part).replace("\\", "\\\\").replace("*", "\\*").replace("?", "\\?")
                if part is not None
                else "*"
                for part in (service_name, catalog, schema, table_name)
            )
            matches = self.metadata.search_fqn_candidates(Table, pattern, wildcard=True, size=2)
            if not matches.total_is_exact or matches.total > 1:
                raise _AmbiguousSourceError
            if matches.total == 1:
                if len(matches.fqns) != 1:
                    raise _SchemaWriteError("Table search did not return its reported match")
                matched_fqn = matches.fqns[0]
                if actual_fqn:
                    if actual_fqn != matched_fqn:
                        raise _SchemaWriteError("Physical source binding changed during validation")
                    return table
                return self.metadata.get_by_name(Table, matched_fqn, nullable=False)
        if table:
            raise _SchemaWriteError("Physical source table does not match its declared scope")
        return None

    def _failed(self, name: str, operation: str, exc: Exception, fields: tuple[str, ...] = ()) -> None:
        code = (exc.status_code or exc.code) if isinstance(exc, APIError) else None
        reason = f"HTTP {code}" if code is not None else type(exc).__name__
        if isinstance(exc, _SchemaWriteError):
            reason = str(exc)
        scope = f" ({', '.join(fields)})" if fields else ""
        self.source.status.failed(StackTraceError(name=name, error=f"Could not {operation}{scope}: {reason}"))

    def apply(self) -> None:
        for schema_id, declaration in sorted(self.schemas.items()):
            fields: tuple[str, ...] = ()
            try:
                values = self._merge_declarations(declaration)
                if values:
                    fields = tuple(sorted({field for field, _ in values}))
                    self._patch(schema_id, declaration.name, values)
            except Exception as exc:
                self._failed(declaration.name, "apply dbt schema metadata", exc, fields)

    def _merge_declarations(self, declaration: _SchemaDeclarations) -> dict[tuple[str, str], Any]:
        values: dict[tuple[str, str], list[tuple[str, Any]]] = defaultdict(list)
        for source_id, source_meta in sorted(declaration.sources, key=lambda item: item[0]):
            for key, value in self._normalize(source_id, source_meta).items():
                values[key].append((source_id, value))

        merged = {}
        for key, candidates in sorted(values.items()):
            first = candidates[0][1]
            if all(value == first for _, value in candidates):
                merged[key] = first
            else:
                ids = ", ".join(sorted({source_id for source_id, _ in candidates}))
                label = ".".join(part for part in key if part)
                self.source.status.warning(declaration.name, f"Conflicting dbt {label} declarations from {ids}")
        return merged

    def _normalize(self, source_id: str, source_meta: object) -> dict[tuple[str, str], Any]:
        if not isinstance(source_meta, dict):
            self.source.status.warning(source_id, "Invalid source metadata; expected an object")
            return {}
        options = source_meta.get("openmetadata") or {}
        if not isinstance(options, dict):
            self.source.status.warning(source_id, "Invalid openmetadata source metadata; expected an object")
            options = {}
        values: dict[tuple[str, str], Any] = {}
        self._normalize_references(source_id, source_meta, options, values)
        for field, normalize in (("tier", self._tier_label), ("certification", self._certificate_label)):
            if value := options.get(field):
                label = normalize(value)
                if label:
                    values[field, ""] = label
                else:
                    self.source.status.warning(source_id, f"Could not resolve declared schema {field}")

        if glossary := options.get("glossary"):
            if isinstance(glossary, list):
                for term in glossary:
                    labels = (
                        get_tag_labels(self.metadata, [term], tag_type=GlossaryTerm) if isinstance(term, str) else None
                    )
                    if labels:
                        for label in labels:
                            values["glossary", _label_fqn(label)] = label
                    else:
                        self.source.status.warning(source_id, "Could not resolve a declared schema glossary term")
            else:
                self.source.status.warning(source_id, "Invalid schema glossary declaration; expected a list")

        if properties := options.get("customProperties"):
            if isinstance(properties, dict):
                values.update(self._properties(source_id, properties))
            else:
                self.source.status.warning(source_id, "Invalid schema custom properties; expected an object")
        return values

    def _normalize_references(self, source_id: str, source_meta: dict, options: dict, values: dict) -> None:
        if self.source.source_config.dbtUpdateOwners and (owner := options.get("owner") or source_meta.get("owner")):
            names = [owner] if isinstance(owner, str) else owner
            if isinstance(names, list) and all(isinstance(name, str) and name.strip() for name in names):
                resolved = [self.source.get_dbt_owner(SimpleNamespace(meta={"owner": name}), None) for name in names]
                if all(resolved):
                    values["owners", ""] = _ref_values([ref for refs in resolved if refs for ref in refs.root])
            if ("owners", "") not in values:
                self.source.status.warning(source_id, "Could not resolve declared schema owners")

        if domain := options.get("domain"):
            entity = find_domain_by_name(self.metadata, domain) if isinstance(domain, str) else None
            reference = format_domain_reference(entity) if entity else None
            if reference:
                values["domains", ""] = _ref_values([EntityReference.model_validate(reference)])
            else:
                self.source.status.warning(source_id, "Could not resolve declared schema domain")

    def _tier_label(self, value: object) -> TagLabel | None:
        parts = _qualified_label(value)
        if len(parts) == 2 and parts[0] == _TIER:
            return get_tag_label(self.metadata, fqn.unquote_name(parts[1]), _TIER)
        return None

    def _certificate_label(self, value: object) -> TagLabel | None:
        parts = _qualified_label(value)
        if len(parts) not in (1, 2):
            return None

        if self.certification_classification is _UNREAD:
            self.certification_classification = self._get_certification_classification()
        configured = self.certification_classification
        if len(parts) == 2 and configured and parts[0] != configured:
            return None
        classification = parts[0] if len(parts) == 2 else configured
        if isinstance(classification, str):
            return get_tag_label(self.metadata, fqn.unquote_name(parts[-1]), classification)
        return None

    def _get_certification_classification(self) -> str | None:
        try:
            settings = self.metadata.get_settings_by_name(SettingType.assetCertificationSettings)
        except Exception as exc:
            code = (exc.status_code or exc.code) if isinstance(exc, APIError) else None
            if code not in (403, 404):
                self.source.status.warning("dbt schema metadata", "Could not read asset certification settings")
            return None
        if settings and isinstance(settings.config_value, AssetCertificationSettings):
            return settings.config_value.allowedClassification
        return None

    def _properties(self, source_id: str, properties: dict) -> dict[tuple[str, str], Any]:
        if self.property_definitions is None:
            self.property_definitions = self.source._fetch_custom_property_definitions("databaseSchema")

        values = {}
        for name, value in properties.items():
            if value in (None, "", [], {}):
                continue
            definition = self.property_definitions.get(name) or {}
            property_type = (definition.get("propertyType") or {}).get("name")
            if property_type == "boolean" and isinstance(value, bool):
                values["extension", name] = value
                continue
            if property_type and property_type != "boolean":
                valid, _, converted = validate_custom_property_value(
                    property_name=name,
                    property_type=property_type,
                    property_config=(definition.get("customPropertyConfig") or {}).get("config"),
                    value=value,
                    metadata=self.metadata,
                )
                if valid and converted is not None:
                    values["extension", name] = convert_uuids_to_strings(converted)
                    continue
            self.source.status.warning(source_id, f"Unknown or invalid schema custom property {name}")
        return values

    def _patch(self, schema_id: UUID, name: str, values: dict[tuple[str, str], Any]) -> None:
        stale_etag = None
        for _ in range(MAX_OPTIMISTIC_LOCK_RETRIES + 1):
            schema = self.metadata.get_by_id(DatabaseSchema, str(schema_id), _SCHEMA_FIELDS, nullable=False)
            if not schema or schema.deleted:
                raise _SchemaWriteError("Schema no longer exists")
            changes = self._changes(schema, values)
            if not changes:
                return
            etag = _entity_etag(schema) if "version" in schema.model_fields_set else None
            if etag is None or etag == stale_etag:
                raise _SchemaWriteError("The server did not accept the schema version precondition")
            try:
                self._send_patch(schema, changes, etag)
            except APIError as exc:
                if not _is_precondition_failed(exc):
                    raise
                stale_etag = etag
            else:
                return
        self.source.status.failed(
            StackTraceError(
                name=name, error="Could not apply dbt schema metadata: concurrent updates exhausted retries"
            )
        )

    def _send_patch(self, schema: DatabaseSchema, changes: dict, etag: str) -> None:
        patch = [{"op": "add", "path": f"/{field}", "value": value} for field, value in changes.items()]
        try:
            result = self.metadata.client.patch(
                path=f"{self.metadata.get_suffix(DatabaseSchema)}/{model_str(schema.id)}",
                data=json.dumps(patch),
                headers={"If-Match": etag},
            )
        except APIError as exc:
            if not (
                "certification" in changes
                and self.certification_classification is None
                and (exc.status_code or exc.code) == 400
                and str(exc).startswith("Invalid Classification:")
            ):
                raise
            # The settings GET is admin-only on some servers. A fully qualified
            # label can still be checked by schema PATCH without broadening access.
            self.source.status.warning(model_str(schema.fullyQualifiedName), "Server rejected schema certification")
            remaining = {field: value for field, value in changes.items() if field != "certification"}
            if remaining:
                self._send_patch(schema, remaining, etag)
            return
        if not result:
            raise _SchemaWriteError("The schema PATCH did not acknowledge the write")
        self.source.status.updated(schema)

    def _changes(self, schema: DatabaseSchema, values: dict[tuple[str, str], Any]) -> dict:
        changes = {}
        name = model_str(schema.fullyQualifiedName)
        for field in ("owners", "domains"):
            proposed = values.get((field, ""))
            if not proposed:
                continue
            refs = getattr(schema, field)
            current = _direct_refs(refs.root if refs else None)
            if not current:
                changes[field] = proposed
            elif current != {(ref["type"], ref["id"]) for ref in proposed}:
                self.source.status.warning(name, f"Preserved directly assigned schema {field}")

        current_tags = schema.tags or []
        labels = {(tag.source, _label_fqn(tag)) for tag in current_tags}
        added = {
            (TagSource.Glossary, label): value
            for (field, label), value in values.items()
            if field == "glossary" and (TagSource.Glossary, label) not in labels
        }
        if tier := values.get(("tier", "")):
            existing_tiers = {
                label
                for source, label in labels
                if source == TagSource.Classification and label.startswith(f"{_TIER}.")
            }
            if not existing_tiers:
                added[TagSource.Classification, _label_fqn(tier)] = tier
            elif _label_fqn(tier) not in existing_tiers:
                self.source.status.warning(name, "Preserved existing schema tier")
        if added:
            changes["tags"] = [
                tag.model_dump(mode="json", exclude_none=True) for tag in [*current_tags, *added.values()]
            ]

        if certificate := values.get(("certification", "")):
            if not schema.certification:
                # PATCH requires both dates, which the server replaces on application.
                changes["certification"] = {
                    "tagLabel": certificate.model_dump(mode="json", exclude_none=True),
                    "appliedDate": 0,
                    "expiryDate": 0,
                }
            elif _label_fqn(schema.certification.tagLabel) != _label_fqn(certificate):
                self.source.status.warning(name, "Preserved existing schema certification")

        extension = schema.extension.root if schema.extension else {}
        declared = {key: value for (field, key), value in values.items() if field == "extension"}
        if declared:
            if not isinstance(extension, dict):
                raise _SchemaWriteError("Existing schema extension is not an object")
            merged = {**extension, **declared}
            if json.dumps(merged, sort_keys=True) != json.dumps(extension, sort_keys=True):
                changes["extension"] = merged
        return changes
