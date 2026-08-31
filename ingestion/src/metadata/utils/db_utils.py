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

"""
Helpers module for db sources
"""

import time
import traceback
from typing import Iterable, List, Union  # noqa: UP035

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import (
    QueryParserType,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import (
    _build_table_lineage,
    get_lineage_by_query,
    get_lineage_via_table_entity,
    get_table_entities_from_query,
)
from metadata.ingestion.models.ometa_lineage import LineageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.clickhouse_utils import get_materialized_view_target_table
from metadata.utils.logger import utils_logger

logger = utils_logger()

PUBLIC_SCHEMA = "public"


def get_host_from_host_port(uri: str) -> str:
    """
    if uri is like "localhost:9000"
    then return the host "localhost"
    """
    return uri.split(":")[0]  # noqa: PLC0207


def get_clickhouse_mv_target_lineage(
    metadata: OpenMetadata,
    view: TableView,
    view_entity: Table,
    service_names: List[str],  # noqa: UP006
    masked_query: str,
) -> Iterable[Either[LineageRequest]]:
    """
    Build the downstream edge of a Clickhouse materialized view created with a
    `TO <schema>.<table>` clause.

    Such a view does not hold any data: every row it computes is written into the target
    table. The SQL parsers report the view itself as the only write target of a
    `CREATE ... VIEW`, so the view -> target table edge is read off the DDL instead.

    A Clickhouse database maps to an OpenMetadata schema, so an unqualified target
    resolves against the schema of the view itself.
    """
    target = get_materialized_view_target_table(view.view_definition)
    if target is None:
        return

    target_schema = target.schema_name or view.schema_name
    target_entities = get_table_entities_from_query(
        metadata=metadata,
        service_names=service_names,
        database_name=view.db_name,
        database_schema=target_schema,
        table_name=target.table_name,
    )
    if not target_entities:
        logger.debug(
            f"Target table [{target_schema}.{target.table_name}] of materialized view "
            f"[{view.schema_name}.{view.table_name}] not found, skipping downstream lineage"
        )
        return

    for target_entity in target_entities:
        yield _build_table_lineage(
            from_entity=view_entity,
            to_entity=target_entity,
            from_table_raw_name=f"{view.schema_name}.{view.table_name}",
            to_table_raw_name=f"{target_schema}.{target.table_name}",
            masked_query=masked_query,
            column_lineage_map={},
            lineage_source=LineageSource.ViewLineage,
        )


#  pylint: disable=too-many-locals
def get_view_lineage(
    view: TableView,
    metadata: OpenMetadata,
    service_names: Union[str, List[str]],  # noqa: UP006, UP007
    connection_type: str,
    timeout_seconds: int,
    parser_type: QueryParserType,
) -> Iterable[Either[LineageRequest]]:
    """
    Method to generate view lineage
    Now supports cross-database lineage by accepting a list of service names.
    """
    if isinstance(service_names, str):
        service_names = [service_names]
    table_name = view.table_name
    schema_name = view.schema_name
    db_name = view.db_name
    schema_fallback = False
    view_definition = view.view_definition
    table_fqn = fqn.build(
        metadata,
        entity_type=Table,
        service_name=service_names[0],  # Use first service for table entity lookup
        database_name=db_name,
        schema_name=schema_name,
        table_name=table_name,
    )
    table_entity: Table = metadata.get_by_name(
        entity=Table,
        fqn=table_fqn,
    )

    if not view_definition:
        logger.warning(f"View definition for view {table_fqn} not available")
        return

    try:
        connection_type = str(connection_type)
        dialect = ConnectionTypeDialectMapper.dialect_of(connection_type)
        start_time = time.time()
        logger.debug(f"Processing view lineage for: {table_fqn}")
        lineage_parser = LineageParser(
            view_definition,
            dialect,
            timeout_seconds=timeout_seconds,
            parser_type=parser_type,
        )
        query_hash = lineage_parser.query_hash

        if table_entity.serviceType == DatabaseServiceType.Postgres:
            # For Postgres, if schema is not defined, we need to use the public schema
            schema_name = PUBLIC_SCHEMA
            schema_fallback = True

        if table_entity.serviceType == DatabaseServiceType.Dremio:
            # Dremio folders nest arbitrarily deep and are flattened into a single dotted
            # schema name (`folder.subfolder`), but a Dremio query spells every folder out
            # as its own path segment. The SQL parser keeps only the first two segments as
            # the qualifier, so for anything nested two or more folders deep the parsed
            # schema can never match the ingested one. Fall back to a schema wildcard.
            schema_fallback = True

        end_time = time.time()
        logger.debug(
            f"[{query_hash}] Time taken to parse view lineage for: {table_fqn} is {end_time - start_time} seconds"
        )
        if lineage_parser.source_tables and lineage_parser.target_tables:
            yield from (
                get_lineage_by_query(
                    metadata,
                    query=view_definition,
                    service_names=service_names,
                    database_name=db_name,
                    schema_name=schema_name,
                    dialect=dialect,
                    timeout_seconds=timeout_seconds,
                    lineage_source=LineageSource.ViewLineage,
                    lineage_parser=lineage_parser,
                    schema_fallback=schema_fallback,
                )
                or []
            )

        else:
            yield from (
                get_lineage_via_table_entity(
                    metadata,
                    table_entity=table_entity,
                    service_names=service_names,
                    database_name=db_name,
                    schema_name=schema_name,
                    query=view_definition,
                    dialect=dialect,
                    timeout_seconds=timeout_seconds,
                    lineage_source=LineageSource.ViewLineage,
                    lineage_parser=lineage_parser,
                    schema_fallback=schema_fallback,
                )
                or []
            )

        if table_entity.serviceType == DatabaseServiceType.Clickhouse:
            yield from get_clickhouse_mv_target_lineage(
                metadata=metadata,
                view=view,
                view_entity=table_entity,
                service_names=service_names,
                masked_query=lineage_parser.masked_query,
            )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Could not parse query [{view_definition}] ingesting lineage failed: {exc}")
