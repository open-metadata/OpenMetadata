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
from collections.abc import Callable, Iterable
from typing import cast

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import StackTraceError
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import (
    QueryParserType,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import (
    get_lineage_by_query,
    get_lineage_via_table_entity,
)
from metadata.ingestion.models.ometa_lineage import LineageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.logger import utils_logger

logger = utils_logger()

PUBLIC_SCHEMA = "public"

# Extra view lineage a connector contributes on top of what the parsers report, called
# with (metadata, view, view_entity, service_names, masked_query) as keyword arguments.
ViewLineageExtension = Callable[..., Iterable[Either[LineageRequest]]]
ViewLineageParserFactory = Callable[..., LineageParser]


def get_host_from_host_port(uri: str) -> str:
    """
    if uri is like "localhost:9000"
    then return the host "localhost"
    """
    return uri.split(":")[0]  # noqa: PLC0207


#  pylint: disable=too-many-locals
def get_view_lineage(
    view: TableView,
    metadata: OpenMetadata,
    service_names: str | list[str],
    connection_type: str,
    timeout_seconds: int,
    parser_type: QueryParserType,
    extension: ViewLineageExtension | None = None,
    parser_factory: ViewLineageParserFactory | None = None,
) -> Iterable[Either[LineageRequest]]:
    """
    Method to generate view lineage
    Now supports cross-database lineage by accepting a list of service names.

    `extension` lets a connector contribute the edges its dialect expresses outside of
    the query the parsers see -- see `LineageSource.get_view_lineage_extension`.
    `parser_factory` lets the connector adapt its DDL while preserving original query metadata.
    """
    if isinstance(service_names, str):
        service_names = [service_names]
    table_name = view.table_name
    schema_name = view.schema_name
    db_name = view.db_name
    schema_fallback = False
    view_definition = view.view_definition
    try:
        table_fqn = fqn.build(
            metadata,
            entity_type=Table,
            service_name=service_names[0],
            database_name=db_name,
            schema_name=schema_name,
            table_name=table_name,
        )
        if table_fqn is None:
            raise ValueError("Could not build view FQN")  # noqa: TRY301 -- share the lookup failure channel
        table_entity = metadata.get_by_name(entity=Table, fqn=table_fqn)
        if not view_definition:
            logger.warning(f"View definition for view {table_fqn} not available")
            return
        if table_entity is None:
            raise ValueError("View entity not found in the catalog")  # noqa: TRY301 -- share the lookup failure channel
    except Exception as exc:
        view_fqn = fqn.build(
            metadata,
            entity_type=Table,
            service_name=service_names[0],
            database_name=db_name,
            schema_name=schema_name,
            table_name=table_name,
            skip_es_search=True,
        )
        yield Either(
            left=StackTraceError(
                name=cast("str", view_fqn),
                error=f"Could not resolve view [{view_fqn}]: {exc}",
                stackTrace=traceback.format_exc(),
            ),
            right=None,
        )
        return

    try:
        connection_type = str(connection_type)
        dialect = ConnectionTypeDialectMapper.dialect_of(connection_type)
        start_time = time.time()
        logger.debug(f"Processing view lineage for: {table_fqn}")
        lineage_parser = (parser_factory or LineageParser)(
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
                    view_entity=table_entity,
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

        if extension:
            yield from extension(
                metadata=metadata,
                view=view,
                view_entity=table_entity,
                service_names=service_names,
                masked_query=lineage_parser.masked_query,
            )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Could not parse query [{view_definition}] ingesting lineage failed: {exc}")
