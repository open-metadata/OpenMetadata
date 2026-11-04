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
"""Verified catalog resolution for BigQuery physical references."""

import re
from dataclasses import replace

from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.engine import (
    EntityResolutionPlan,
    EntityResolver,
    FqnCandidate,
    FqnLookupMode,
    ResolutionTier,
)
from metadata.entity_resolution.table_binding import TableBindingResolution as DefaultTableBindingResolution
from metadata.entity_resolution.table_binding import TableLookup, UnsupportedTableReferenceError
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType
from metadata.generated.schema.type.queryParserData import ParsedData
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.bigquery.sharding import (
    get_table_sharding,
    logical_shard_name,
    parse_shard_name,
    strip_partition_decorator,
)
from metadata.utils import fqn
from metadata.utils.logger import utils_logger

logger = utils_logger()


def _resolve_unscoped_reference(
    metadata: OpenMetadata, reference: TableReference, fields: tuple[str, ...] = ()
) -> tuple[Table, ...]:
    """Resolve physical and logical candidates across services in one bounded search."""
    name = strip_partition_decorator(reference.table)
    wildcard = "*" in name
    if wildcard and (name.count("*") != 1 or not name.endswith("*") or re.search(r"[0-9]+\*", name)):
        raise UnsupportedTableReferenceError(
            "BigQuery wildcard requires member inventory evidence; resolution incomplete"
        )
    parsed = parse_shard_name(name)
    scope = [
        {"term": {field: value}}
        for field, value in (
            ("database.name.keyword", reference.database),
            ("databaseSchema.name.keyword", reference.schema),
        )
        if value
    ]
    service_type = {"term": {"serviceType": "BigQuery"}}
    alternatives: list[dict]
    if wildcard:
        escaped = name[:-1].replace("\\", "\\\\").replace("?", "\\?") + "*"
        alternatives = [{"bool": {"filter": [service_type, {"wildcard": {"name.keyword": escaped.lower()}}]}}]
    else:
        alternatives = [{"term": {"name.keyword": reference.table}}]
        if name != reference.table:
            alternatives.append({"bool": {"filter": [service_type, {"term": {"name.keyword": name}}]}})
        if parsed:
            alternatives.append(
                {
                    "bool": {
                        "filter": [
                            service_type,
                            {"term": {"tableType": "Sharded"}},
                            {"term": {"name.keyword": logical_shard_name(parsed[0])}},
                        ]
                    }
                }
            )
    names = metadata.search_filtered_fqns(
        Table, {"query": {"bool": {"filter": scope, "should": alternatives, "minimum_should_match": 1}}}
    )
    physical, families = {}, {}
    missing = 0
    for candidate in dict.fromkeys(names):
        table = (
            metadata.get_by_name(Table, candidate, fields=list(fields))
            if fields
            else metadata.get_by_name(Table, candidate)
        )
        if table is None or table.deleted or model_str(table.fullyQualifiedName) != candidate:
            if not wildcard:
                raise ValueError("Table changed during candidate search; resolution incomplete")
            missing += 1
            continue
        parts = fqn.split(candidate)
        if len(parts) != 4:
            continue
        service, database, schema, table_name = parts
        if any(
            expected and expected.lower() != actual.lower()
            for expected, actual in ((reference.database, database), (reference.schema, schema))
        ):
            continue
        key = (service, database, schema)
        is_bigquery = table.serviceType == DatabaseServiceType.BigQuery
        descriptor = get_table_sharding(table)
        if wildcard:
            physical_match = is_bigquery and table_name.lower().startswith(name[:-1].lower())
        else:
            physical_match = table_name.lower() == reference.table.lower() or (
                is_bigquery and table_name.lower() == name.lower()
            )
        if physical_match and not (wildcard and descriptor):
            physical[model_str(table.id)] = (key, table)
        elif (
            is_bigquery
            and descriptor
            and descriptor.representative.databaseName == database
            and descriptor.representative.schemaName == schema
            and table_name == logical_shard_name(descriptor.prefix)
            and ((wildcard and descriptor.prefix.startswith(name[:-1])) or (parsed and descriptor.prefix == parsed[0]))
        ):
            families[model_str(table.id)] = (key, table)
    if missing:
        logger.warning(
            "Resolved %d of %d candidates for %s; wildcard results are incomplete",
            len(set(names)) - missing,
            len(set(names)),
            reference,
        )
    # A physical identity wins only within its namespace, never across unrelated services.
    physical_scopes = {key for key, _ in physical.values()}
    return tuple(table for _, table in physical.values()) + tuple(
        table for key, table in families.values() if wildcard or key not in physical_scopes
    )


def _resolve_scoped_reference(resolver, service: str, reference: TableReference, fields=(), include=None):
    reference = replace(reference, table=strip_partition_decorator(reference.table))
    parts = (service, reference.database, reference.schema, reference.table)
    wildcard = any(part is None or "*" in part for part in parts)
    name = ".".join(fqn.quote_name(part) if part is not None else "*" for part in parts)
    mode = FqnLookupMode.WILDCARD if wildcard else FqnLookupMode.EXACT
    plan = EntityResolutionPlan(
        Table, (ResolutionTier((FqnCandidate(name, mode),)),), fields, include, 100, warn_on_partial=True
    )
    if "*" in reference.table and re.search(r"[0-9]+\*", reference.table):
        raise UnsupportedTableReferenceError(
            "Date-constrained BigQuery wildcards require member inventory evidence; resolution incomplete"
        )
    exact = resolver.resolve(plan)
    if exact:
        return exact
    family = _resolve_shard_family(resolver, service, reference, fields, include)
    if family or wildcard or include in ("all", "deleted"):
        return family
    # Query parsers lower-case names BigQuery keeps case-sensitive. Only a single
    # match is taken: Account and ACCOUNT can both exist, and either could be meant
    variants = resolver.resolve(
        replace(plan, tiers=(ResolutionTier((FqnCandidate(name, FqnLookupMode.CASE_INSENSITIVE_EXACT),)),))
    )
    return variants if len(variants) == 1 else ()


def _resolve_shard_family(resolver, service: str, reference: TableReference, fields, include) -> tuple[Table, ...]:
    parsed = parse_shard_name(reference.table)
    if not parsed or service == "*":
        return ()
    prefix, _ = parsed
    logical = ".".join(
        fqn.quote_name(part) if part else "*"
        for part in (service, reference.database, reference.schema, logical_shard_name(prefix))
    )
    candidates = resolver.resolve(
        EntityResolutionPlan(
            Table,
            (
                ResolutionTier(
                    (
                        FqnCandidate(
                            logical,
                            FqnLookupMode.WILDCARD
                            if not reference.database or not reference.schema
                            else FqnLookupMode.EXACT,
                        ),
                    )
                ),
            ),
            fields,
            include,
            100,
            warn_on_partial=True,
        )
    )
    return tuple(
        table
        for table in candidates
        if (descriptor := get_table_sharding(table))
        and descriptor.prefix == prefix
        and (not reference.database or descriptor.representative.databaseName == reference.database)
        and (not reference.schema or descriptor.representative.schemaName == reference.schema)
    )


class BigQueryTableBindingResolution(DefaultTableBindingResolution):
    def resolve(
        self,
        reference: TableReference,
        *,
        service_name: str | None = None,
        fields: tuple[str, ...] = (),
        include: str | None = None,
        lookup: TableLookup = TableLookup.CATALOG,
    ) -> tuple[Table, ...]:
        if not service_name or service_name == "*":
            if include in ("all", "deleted"):
                raise ValueError("Search-assisted resolution supports active entities only")
            return _resolve_unscoped_reference(self.metadata, reference, fields)
        engine = self.engine or EntityResolver(self.metadata)
        try:
            return _resolve_scoped_reference(engine, service_name, reference, fields, include)
        finally:
            if self.engine is None:
                engine.close()

    def prepare_usage(self, execution: ParsedData) -> ParsedData:
        from metadata.entity_resolution.table_search import get_table_fqn_from_query_name, search_table_entities

        targets = {}
        joins = {}
        for table in execution.tables:
            database, schema, name = get_table_fqn_from_query_name(table)
            if not name:
                raise ValueError("Usage reference has no table name")
            matches = search_table_entities(
                self.metadata,
                execution.serviceName,
                database or execution.databaseName,
                schema or execution.databaseSchema,
                name,
            )
            resolved = [
                (
                    model_str(entity.id),
                    ".".join(fqn.quote_name(part) for part in fqn.split(model_str(entity.fullyQualifiedName))[1:]),
                )
                for entity in matches or ()
            ]
            for identity, target in resolved or [(table, table)]:
                targets[identity] = target
                joins.setdefault(target, []).extend((execution.joins or {}).get(table) or [])
        return execution.model_copy(update={"tables": list(targets.values()), "joins": joins})


TableBindingResolution = BigQueryTableBindingResolution
