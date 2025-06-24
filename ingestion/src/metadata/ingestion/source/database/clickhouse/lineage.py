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
Clickhouse lineage module
"""
import itertools
import traceback
from typing import Any, Iterable, List, Optional

from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.sql_lineage import (
    _build_table_lineage,
    get_table_entities_from_query,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_SQL_STATEMENT,
)
from metadata.ingestion.source.database.clickhouse.query_parser import (
    ClickhouseQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import (
    LineageSource as BaseLineageSource,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ClickhouseLineageSource(ClickhouseQueryParserSource, BaseLineageSource):
    """
    Implements the necessary methods to extract
    Database lineage from Clickhouse Source
    """

    sql_stmt = CLICKHOUSE_SQL_STATEMENT

    filters = """
        and (
            query_kind='Create' 
            or (query_kind='Insert' and query ilike '%%insert%%into%%select%%')
        )
    """

    database_field = ""

    schema_field = "databases"

    def get_clickhouse_table_entities_from_query(
        self,
        metadata: OpenMetadata,
        service_name: str,
        database_name: Optional[str],
        database_schema: Optional[str],
        table_name: str,
    ) -> Optional[List[Any]]:
        """
        Clickhouse-specific table entity resolution with enhanced fallback strategies.

        This method uses multiple strategies to resolve table names with schema prefixes,
        which is common in Clickhouse queries but can cause resolution issues.
        """
        # Strategy 1: Use the original core function first
        entities = get_table_entities_from_query(
            metadata=metadata,
            service_name=service_name,
            database_name=database_name,
            database_schema=database_schema,
            table_name=table_name,
        )

        if entities:
            logger.debug(
                f"Found table entities for '{table_name}' using original strategy"
            )
            return entities

        # Strategy 2: Handle schema.table format - extract schema and table parts
        if "." in table_name:
            parts = table_name.split(".")
            if len(parts) == 2:
                schema_part, table_part = parts
                logger.debug(
                    f"Trying schema.table split: schema='{schema_part}', table='{table_part}'"
                )

                # Try with the parsed schema as database_schema
                entities = get_table_entities_from_query(
                    metadata=metadata,
                    service_name=service_name,
                    database_name=database_name,
                    database_schema=schema_part,
                    table_name=table_part,
                )

                if entities:
                    logger.debug(
                        f"Found table entities using parsed schema '{schema_part}'"
                    )
                    return entities

                # Try with the parsed schema as database_name (Clickhouse databases as schemas)
                entities = get_table_entities_from_query(
                    metadata=metadata,
                    service_name=service_name,
                    database_name=schema_part,
                    database_schema=database_schema,
                    table_name=table_part,
                )

                if entities:
                    logger.debug(
                        f"Found table entities using parsed schema '{schema_part}' as database"
                    )
                    return entities

        # Strategy 3: Try with original schema but just the base table name
        if "." in table_name:
            base_table_name = table_name.split(".")[-1]
            logger.debug(f"Trying with base table name: '{base_table_name}'")

            entities = get_table_entities_from_query(
                metadata=metadata,
                service_name=service_name,
                database_name=database_name,
                database_schema=database_schema,
                table_name=base_table_name,
            )

            if entities:
                logger.debug(
                    f"Found table entities using base table name '{base_table_name}'"
                )
                return entities

        # Strategy 4: Case variations
        for case_variant in [table_name.lower(), table_name.upper()]:
            if case_variant != table_name:
                logger.debug(f"Trying case variant: '{case_variant}'")

                entities = get_table_entities_from_query(
                    metadata=metadata,
                    service_name=service_name,
                    database_name=database_name,
                    database_schema=database_schema,
                    table_name=case_variant,
                )

                if entities:
                    logger.debug(
                        f"Found table entities using case variant '{case_variant}'"
                    )
                    return entities

        # Log the failure with more detail
        logger.warning(
            f"Table entity [{table_name}] not found in OpenMetadata after trying multiple strategies. "
            f"Service: {service_name}, Database: {database_name}, Schema: {database_schema}"
        )
        return None

    def _create_clickhouse_lineage_by_table_name(
        self,
        metadata: OpenMetadata,
        from_table: str,
        to_table: str,
        service_name: str,
        database_name: Optional[str],
        schema_name: Optional[str],
        masked_query: str,
        column_lineage_map: dict,
        lineage_source=None,
        procedure: Optional[Any] = None,
        graph=None,
    ) -> Iterable[Either[Any]]:
        """
        Clickhouse-specific version of _create_lineage_by_table_name that uses
        enhanced table entity resolution.
        """
        try:
            from_table_entities = self.get_clickhouse_table_entities_from_query(
                metadata=metadata,
                service_name=service_name,
                database_name=database_name,
                database_schema=schema_name,
                table_name=from_table,
            )

            to_table_entities = self.get_clickhouse_table_entities_from_query(
                metadata=metadata,
                service_name=service_name,
                database_name=database_name,
                database_schema=schema_name,
                table_name=to_table,
            )

            if graph is not None and (not from_table_entities or not to_table_entities):
                # Add nodes and edges with minimal data
                graph.add_node(
                    from_table,
                    fqns=[
                        table.fullyQualifiedName.root for table in from_table_entities
                    ]
                    if from_table_entities
                    else [],
                )
                graph.add_node(
                    to_table,
                    fqns=[table.fullyQualifiedName.root for table in to_table_entities]
                    if to_table_entities
                    else [],
                )
                graph.add_edge(from_table, to_table)
                return

            for from_entity, to_entity in itertools.product(
                from_table_entities or [], to_table_entities or []
            ):
                if to_entity and from_entity:
                    yield _build_table_lineage(
                        to_entity=to_entity,
                        from_entity=from_entity,
                        to_table_raw_name=to_table,
                        from_table_raw_name=from_table,
                        masked_query=masked_query,
                        column_lineage_map=column_lineage_map,
                        lineage_source=lineage_source,
                        procedure=procedure,
                    )

        except Exception as exc:
            logger.error(
                f"Failed to create Clickhouse lineage from {from_table} to {to_table}: {exc}"
            )
            # Return empty instead of yielding error to avoid disrupting the flow
            return

    def get_clickhouse_lineage_by_query(
        self,
        metadata: OpenMetadata,
        service_name: str,
        database_name: Optional[str],
        schema_name: Optional[str],
        query: str,
        dialect,
        timeout_seconds: int,
        lineage_source=None,
        graph=None,
    ) -> Iterable[Either[Any]]:
        """
        Clickhouse-specific version of get_lineage_by_query that uses enhanced table resolution.

        This method replicates the logic from sql_lineage.get_lineage_by_query but uses
        the Clickhouse-specific table entity resolution method.
        """
        try:
            from metadata.ingestion.lineage.parser import LineageParser
            from metadata.ingestion.lineage.sql_lineage import (
                get_source_table_names,
                populate_column_lineage_map,
            )

            column_lineage = {}

            lineage_parser = LineageParser(
                query, dialect, timeout_seconds=timeout_seconds
            )
            masked_query = lineage_parser.masked_query
            logger.debug(
                f"Running Clickhouse lineage with query: {masked_query or query}"
            )

            raw_column_lineage = lineage_parser.column_lineage
            column_lineage.update(populate_column_lineage_map(raw_column_lineage))

            # Handle intermediate tables
            for intermediate_table in lineage_parser.intermediate_tables:
                for source_table in lineage_parser.source_tables:
                    for procedure, from_table_name in get_source_table_names(
                        metadata=metadata,
                        dialect=dialect,
                        source_table=source_table,
                        database_name=database_name,
                        schema_name=schema_name,
                        service_name=service_name,
                        timeout_seconds=timeout_seconds,
                        column_lineage=column_lineage,
                    ):
                        yield from self._create_clickhouse_lineage_by_table_name(
                            metadata,
                            from_table=str(from_table_name),
                            to_table=str(intermediate_table),
                            service_name=service_name,
                            database_name=database_name,
                            schema_name=schema_name,
                            masked_query=masked_query,
                            column_lineage_map=column_lineage,
                            lineage_source=lineage_source,
                            procedure=procedure,
                            graph=graph,
                        )
                for target_table in lineage_parser.target_tables:
                    yield from self._create_clickhouse_lineage_by_table_name(
                        metadata,
                        from_table=str(intermediate_table),
                        to_table=str(target_table),
                        service_name=service_name,
                        database_name=database_name,
                        schema_name=schema_name,
                        masked_query=masked_query,
                        column_lineage_map=column_lineage,
                        lineage_source=lineage_source,
                    )

            # Handle direct source to target relationships
            if not lineage_parser.intermediate_tables:
                for target_table in lineage_parser.target_tables:
                    for source_table in lineage_parser.source_tables:
                        for procedure, from_table_name in get_source_table_names(
                            metadata=metadata,
                            dialect=dialect,
                            source_table=source_table,
                            database_name=database_name,
                            schema_name=schema_name,
                            service_name=service_name,
                            timeout_seconds=timeout_seconds,
                            column_lineage=column_lineage,
                        ):
                            yield from self._create_clickhouse_lineage_by_table_name(
                                metadata,
                                from_table=str(from_table_name),
                                to_table=str(target_table),
                                service_name=service_name,
                                database_name=database_name,
                                schema_name=schema_name,
                                masked_query=masked_query,
                                column_lineage_map=column_lineage,
                                lineage_source=lineage_source,
                                procedure=procedure,
                                graph=graph,
                            )

        except Exception as exc:
            logger.error(
                f"Clickhouse lineage processing failed for service [{service_name}]: {exc}"
            )
            # Return empty instead of yielding error to avoid disrupting the flow
            return

    def query_lineage_generator(self, table_queries, queue) -> Iterable[Either[Any]]:
        """
        Override the query lineage generator to use Clickhouse-specific lineage processing.
        """
        try:
            if self.graph is None and self.source_config.enableTempTableLineage:
                import networkx as nx

                # Create a directed graph
                self.graph = nx.DiGraph()

            for table_query in table_queries or []:
                if not self._query_already_processed(table_query):
                    # Use Clickhouse-specific lineage processing
                    lineages = self.get_clickhouse_lineage_by_query(
                        metadata=self.metadata,
                        query=table_query.query,
                        service_name=table_query.serviceName,
                        database_name=table_query.databaseName,
                        schema_name=table_query.databaseSchema,
                        dialect=self.dialect,
                        timeout_seconds=self.source_config.parsingTimeoutLimit,
                        graph=self.graph,
                    )

                    for lineage_request in lineages or []:
                        queue.put(lineage_request)

                        # If we identified lineage properly, ingest the original query
                        if lineage_request.right:
                            try:
                                from metadata.generated.schema.api.data.createQuery import (
                                    CreateQueryRequest,
                                )
                                from metadata.generated.schema.type.basic import (
                                    FullyQualifiedEntityName,
                                    SqlQuery,
                                )

                                queue.put(
                                    Either(
                                        right=CreateQueryRequest(
                                            query=SqlQuery(table_query.query),
                                            query_type=table_query.query_type,
                                            duration=table_query.duration,
                                            processedLineage=True,
                                            service=FullyQualifiedEntityName(
                                                self.config.serviceName
                                            ),
                                        )
                                    )
                                )
                            except ImportError as e:
                                logger.debug(
                                    f"Could not import schema classes for query creation: {e}"
                                )
                                # Continue without creating the query request
                                pass
        except Exception as exc:
            logger.error(f"Clickhouse query lineage generator failed: {exc}")
            logger.debug(traceback.format_exc())
