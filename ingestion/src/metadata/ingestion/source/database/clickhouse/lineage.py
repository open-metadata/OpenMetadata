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

import traceback
from collections.abc import Iterable
from typing import NamedTuple

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_SQL_STATEMENT,
)
from metadata.ingestion.source.database.clickhouse.query_parser import (
    ClickhouseQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

CROSS_DATABASE_SEARCH_FIELDS = "fullyQualifiedName,name,columns"

# `search_table_from_es` matches any database or schema on this wildcard
ANY_NAME = "*"


class CandidateCache(NamedTuple):
    """
    Tables already looked up, so that a name shared by several databases costs one search.

    `by_name` holds what the search returned, not what it matched: whether a candidate
    is a replica depends on the columns of the Clickhouse table being matched, and two
    tables of the same name do not necessarily carry the same columns.
    """

    by_fqn: dict[str, Table | None]
    by_name: dict[tuple[str, str], list[Table]]

    @classmethod
    def empty(cls) -> "CandidateCache":
        return cls(by_fqn={}, by_name={})


class ClickhouseLineageSource(ClickhouseQueryParserSource, LineageSource):
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
    """  # noqa: W291

    database_field = ""

    schema_field = "databases"

    def yield_cross_database_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """
        Link a Clickhouse table to the table it replicates in another service.

        Clickhouse holds no reference to where a replicated table came from, so the
        match is made on the table itself: same name, same columns.
        """
        try:
            cross_database_fqns = self.get_cross_database_fqn_from_service_names()
            candidate_cache = CandidateCache.empty()

            for database in self.metadata.list_all_entities(
                entity=Database, params={"service": str(self.config.serviceName)}
            ):
                yield from self._yield_database_cross_lineage(database, cross_database_fqns, candidate_cache)
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=f"{self.config.serviceName} Cross Database Lineage",
                    error=(
                        f"Error to yield cross database lineage details for service [{self.config.serviceName}]: {exc}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )

    def _yield_database_cross_lineage(
        self,
        database: Database,
        cross_database_fqns: list[str],
        candidate_cache: CandidateCache,
    ) -> Iterable[Either[AddLineageRequest]]:
        """Yield the lineage of every table of one Clickhouse database"""
        database_fqn = model_str(database.fullyQualifiedName) if database.fullyQualifiedName else None
        if not database_fqn:
            return

        for table in self.metadata.list_all_entities(entity=Table, params={"database": database_fqn}):
            source_table = self._find_replicated_table(table, database_fqn, cross_database_fqns, candidate_cache)
            if not source_table:
                continue
            lineage_request = self.get_add_cross_database_lineage_request(
                from_entity=source_table,
                to_entity=table,
                column_lineage=self.get_column_lineage(from_table=source_table, to_table=table),
            )
            if lineage_request:
                yield lineage_request

    def _find_replicated_table(
        self,
        table: Table,
        database_fqn: str,
        cross_database_fqns: list[str],
        candidate_cache: CandidateCache,
    ) -> Table | None:
        """
        The table this one replicates, looked up by FQN first and by name second.

        A Clickhouse database maps to an OpenMetadata schema under a single `default`
        database, so the schema of a replicated table rarely lines up with the schema
        it came from and the FQN lookup alone finds nothing. The search by name covers
        that, at the cost of having to resolve ambiguity itself.
        """
        return self._find_by_fqn(table, database_fqn, cross_database_fqns, candidate_cache) or self._find_by_name(
            table, candidate_cache
        )

    def _find_by_fqn(
        self,
        table: Table,
        database_fqn: str,
        cross_database_fqns: list[str],
        candidate_cache: CandidateCache,
    ) -> Table | None:
        """The table at the same schema and name under one of the other services"""
        table_fqn = model_str(table.fullyQualifiedName) if table.fullyQualifiedName else None
        if not table_fqn or not table_fqn.startswith(f"{database_fqn}."):
            return None

        table_suffix = table_fqn[len(database_fqn) :]
        for cross_database_fqn in cross_database_fqns:
            candidate_fqn = f"{cross_database_fqn}{table_suffix}"
            if candidate_fqn not in candidate_cache.by_fqn:
                candidate_cache.by_fqn[candidate_fqn] = self.metadata.get_by_name(Table, fqn=candidate_fqn)
            candidate = candidate_cache.by_fqn[candidate_fqn]
            if candidate and self.check_same_table(table, candidate):
                return candidate

        return None

    def _find_by_name(self, table: Table, candidate_cache: CandidateCache) -> Table | None:
        """
        The only table of the other services carrying this name and these columns.

        Two tables of the same name in different schemas are indistinguishable here, so
        an ambiguous match yields nothing: a missing edge beats a wrong one.
        """
        table_name = table.name.root
        for service_name in self.source_config.crossDatabaseServiceNames or []:  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
            if (service_name, table_name) not in candidate_cache.by_name:
                candidate_cache.by_name[(service_name, table_name)] = (
                    fqn.search_table_from_es(
                        metadata=self.metadata,
                        database_name=ANY_NAME,
                        schema_name=ANY_NAME,
                        service_name=service_name,
                        table_name=table_name,
                        fetch_multiple_entities=True,
                        fields=CROSS_DATABASE_SEARCH_FIELDS,
                    )
                    or []
                )

            candidates = candidate_cache.by_name[(service_name, table_name)]
            matches = [candidate for candidate in candidates if self._replicates(table, candidate)]
            if len(matches) == 1:
                return matches[0]
            if matches:
                logger.info(
                    "Skipping cross database lineage for [%s]: [%s] holds %s tables named [%s] "
                    "with the same columns (%s)",
                    model_str(table.fullyQualifiedName),
                    service_name,
                    len(matches),
                    table_name,
                    ", ".join(model_str(match.fullyQualifiedName) for match in matches),
                )
                return None

        return None

    def _replicates(self, table: Table, candidate: Table) -> bool:
        """
        Whether the candidate is the same table, judged on the columns alone.

        Unlike the lookup by FQN, nothing but the columns backs a match found by name,
        so a table whose columns were not loaded is not a match.
        """
        return bool(table.columns) and bool(candidate.columns) and self.check_same_table(table, candidate)
