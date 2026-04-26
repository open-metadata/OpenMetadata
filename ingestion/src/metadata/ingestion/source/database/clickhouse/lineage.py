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
import re
import traceback
from typing import Iterable, Optional

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityLineage import (
    EntitiesEdge,
    LineageDetails,
    Source,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_SQL_STATEMENT,
)
from metadata.ingestion.source.database.clickhouse.query_parser import (
    ClickhouseQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.models import TableView
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Regex to extract the TO <schema>.<table> clause from a ClickHouse
# MATERIALIZED VIEW DDL. Handles both simple and REFRESH EVERY / DEFINER variants.
_CLICKHOUSE_MV_TO_RE = re.compile(
        r"""
            \bTO\s+                         # literal TO keyword
                (?:`?(?P<schema>[^`.\s]+)`?\.)?  # optional schema (backtick-quoted or plain)
                    `?(?P<table>[^`\s(,]+)`?         # table name
                        """,
        re.IGNORECASE | re.VERBOSE,
)


def _extract_mv_to_table(ddl: str) -> Optional[tuple]:
        """
            Given the DDL of a ClickHouse MATERIALIZED VIEW, return (schema, table)
                for the TO clause target, or None if the DDL does not use the TO syntax.
                    """
        if not re.search(r"\bMATERIALIZED\s+VIEW\b", ddl, re.IGNORECASE):
                    return None
                match = _CLICKHOUSE_MV_TO_RE.search(ddl)
    if match:
                return match.group("schema"), match.group("table")
            return None


class ClickhouseLineageSource(ClickhouseQueryParserSource, LineageSource):
        """
            Implements the necessary methods to extract
                Database lineage from Clickhouse Source.

                    Adds support for the ClickHouse-specific MATERIALIZED VIEW ... TO <schema>.<table>
                        syntax, which creates an explicit downstream lineage link from the materialized
                            view to the target table specified by the TO clause.

                                Fixes: https://github.com/open-metadata/OpenMetadata/issues/26265
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

    def _get_mv_downstream_lineage(
                self, view: TableView
    ) -> Iterable[Either[AddLineageRequest]]:
                """
                        For a ClickHouse MATERIALIZED VIEW that uses the TO <schema>.<table> syntax,
                                emit an extra AddLineageRequest linking the view itself to the target table.

                                        The existing view-lineage processing already handles the upstream link
                                                (FROM <source_table> -> view). This method adds the missing downstream link
                                                        (view -> TO <target_table>).
                                                                """
                if not view.view_definition:
                                return

                result = _extract_mv_to_table(view.view_definition)
                if result is None:
                                return

                to_schema, to_table = result
                if not to_table:
                                return

                effective_schema = to_schema or view.schema_name

        try:
                        from_entity = self.metadata.get_by_name(
                                            entity=self.metadata._get_entity_class("table"),  # noqa: SLF001
                                            fqn=f"{self.config.serviceName}.{view.db_name}.{view.schema_name}.{view.table_name}",
                        )
                        to_entity = self.metadata.get_by_name(
                            entity=self.metadata._get_entity_class("table"),  # noqa: SLF001
                            fqn=f"{self.config.serviceName}.{view.db_name}.{effective_schema}.{to_table}",
                        )

            if from_entity and to_entity:
                                column_lineage = self.get_column_lineage(from_entity, to_entity)
                                yield Either(
                                    right=AddLineageRequest(
                                        edge=EntitiesEdge(
                                            fromEntity=EntityReference(
                                                id=Uuid(from_entity.id.root), type="table"
                                            ),
                                            toEntity=EntityReference(
                                                id=Uuid(to_entity.id.root), type="table"
                                            ),
                                            lineageDetails=LineageDetails(
                                                source=Source.ViewLineage,
                                                columnsLineage=column_lineage,
                                            ),
                                        )
                                    )
                                )
                                logger.debug(
                                    f"Added downstream lineage for ClickHouse MATERIALIZED VIEW "
                                    f"{view.table_name} -> {effective_schema}.{to_table}"
                                )
else:
                if not from_entity:
                                        logger.debug(
                                                                    f"Could not find view entity for {view.table_name} "
                                                                    f"in service {self.config.serviceName}"
                                        )
                                    if not to_entity:
                                                            logger.debug(
                                                                                        f"Could not find TO-table entity {effective_schema}.{to_table} "
                                                                                        f"in service {self.config.serviceName}"
                                                            )
except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                                f"Failed to build downstream lineage for ClickHouse MATERIALIZED VIEW "
                                f"{view.table_name}: {exc}"
            )

    def yield_view_lineage(self) -> Iterable[Either[AddLineageRequest]]:
                """
                        Extends the base view lineage processing with ClickHouse-specific
                                MATERIALIZED VIEW TO <schema>.<table> downstream link generation.
                                        """
        yield from super().yield_view_lineage()

        logger.info(
                        "Processing ClickHouse MATERIALIZED VIEW downstream lineage (TO clause)"
        )
        for view in self.view_lineage_producer():
                        yield from self._get_mv_downstream_lineage(view)

