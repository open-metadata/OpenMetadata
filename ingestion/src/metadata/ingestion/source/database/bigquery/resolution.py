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
from metadata.entity_resolution.engine import EntityResolutionPlan, FqnCandidate, FqnLookupMode, ResolutionTier
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.source.database.bigquery.sharding import (
    get_table_sharding,
    logical_shard_name,
    parse_shard_name,
    strip_partition_decorator,
)
from metadata.utils import fqn


def resolve_bigquery_reference(resolver, service: str, reference: TableReference, fields=(), include=None):
    reference = replace(reference, table=strip_partition_decorator(reference.table))
    parts = (service, reference.database, reference.schema, reference.table)
    wildcard = any(part is None or "*" in part for part in parts)
    name = ".".join(fqn.quote_name(part) if part is not None else "*" for part in parts)
    mode = FqnLookupMode.WILDCARD if wildcard else FqnLookupMode.EXACT
    plan = EntityResolutionPlan(Table, (ResolutionTier((FqnCandidate(name, mode),)),), fields, include, 100)
    if "*" in reference.table and re.search(r"[0-9]+\*", reference.table):
        raise ValueError("Date-constrained BigQuery wildcards require member inventory evidence; resolution incomplete")
    exact = resolver.resolve(plan)
    if exact:
        return exact
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
