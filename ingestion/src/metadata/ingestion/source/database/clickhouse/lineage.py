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
from typing import Any, List, Optional

from metadata.ingestion.lineage.sql_lineage import get_table_entities_from_query
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

    Key design principle: Only override table resolution, not entire lineage pipeline.
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

    def resolve_table_entities_with_fallback(
        self,
        metadata: OpenMetadata,
        service_name: str,
        database_name: Optional[str],
        database_schema: Optional[str],
        table_name: str,
    ) -> Optional[List[Any]]:
        """
        Resolve table entities using Clickhouse-specific fallback strategies.

        Addresses common issue where Clickhouse queries use schema.table format
        that doesn't match OpenMetadata's database/schema/table hierarchy.

        Args:
            metadata: OpenMetadata client
            service_name: Service name for table lookup
            database_name: Database context
            database_schema: Schema context
            table_name: Table name to resolve (may include schema prefix)

        Returns:
            List of table entities if found, None otherwise
        """
        # Define resolution strategies in priority order
        strategies = [
            # 1. Original table name (most common case)
            (database_name, database_schema, table_name, "original"),
        ]

        # 2. Handle schema.table format (common in Clickhouse)
        if "." in table_name and table_name.count(".") == 1:
            schema_part, table_part = table_name.split(".", 1)
            strategies.extend(
                [
                    # Try parsed schema as database_schema
                    (database_name, schema_part, table_part, "parsed_schema_as_schema"),
                    # Try parsed schema as database_name (Clickhouse databases-as-schemas)
                    (
                        schema_part,
                        database_schema,
                        table_part,
                        "parsed_schema_as_database",
                    ),
                    # Try just the table part
                    (database_name, database_schema, table_part, "base_table_only"),
                ]
            )

        # 3. Case variations (only if different from original)
        for case_variant, strategy_name in [
            (table_name.lower(), "lowercase"),
            (table_name.upper(), "uppercase"),
        ]:
            if case_variant != table_name:
                strategies.append(
                    (
                        database_name,
                        database_schema,
                        case_variant,
                        f"case_{strategy_name}",
                    )
                )

        # Try each strategy until one succeeds
        for db_name, schema_name, tbl_name, strategy_name in strategies:
            logger.debug(
                f"Trying table resolution strategy '{strategy_name}': "
                f"db={db_name}, schema={schema_name}, table={tbl_name}"
            )

            entities = get_table_entities_from_query(
                metadata=metadata,
                service_name=service_name,
                database_name=db_name,
                database_schema=schema_name,
                table_name=tbl_name,
            )

            if entities:
                logger.debug(
                    f"Successfully resolved table '{table_name}' using strategy '{strategy_name}'"
                )
                return entities

        # Log failure with context
        logger.warning(
            f"Failed to resolve table '{table_name}' after trying {len(strategies)} strategies. "
            f"Service: {service_name}, Database: {database_name}, Schema: {database_schema}"
        )
        return None

    def _resolve_table_entities(
        self,
        metadata: OpenMetadata,
        service_name: str,
        database_name: Optional[str],
        database_schema: Optional[str],
        table_name: str,
    ) -> Optional[List[Any]]:
        """
        Override point for Clickhouse-specific table resolution.

        This method is called by the parent lineage processing logic
        and provides Clickhouse-specific fallback strategies.
        """
        return self.resolve_table_entities_with_fallback(
            metadata, service_name, database_name, database_schema, table_name
        )

    # Override point for enhanced table resolution
    # The parent lineage processing should call this method instead of the core function
    def get_table_entities_from_query(
        self,
        metadata: OpenMetadata,
        service_name: str,
        database_name: Optional[str],
        database_schema: Optional[str],
        table_name: str,
    ) -> Optional[List[Any]]:
        """
        Public interface for table entity resolution.

        This method will be called by the parent lineage processing logic
        and provides Clickhouse-specific enhanced resolution.
        """
        return self.resolve_table_entities_with_fallback(
            metadata, service_name, database_name, database_schema, table_name
        )
