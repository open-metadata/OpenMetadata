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
"""Databend lineage source built on Databend's own lineage records."""

import json
import traceback
from collections import defaultdict
from collections.abc import Generator, Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, cast

from cachetools import LRUCache
from sqlalchemy import bindparam, text
from sqlalchemy.engine import Connection

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.databendConnection import (
    DatabendConnection,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SqlQuery
from metadata.generated.schema.type.entityLineage import ColumnLineage, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSourceType
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.models.ometa_lineage import (
    OMetaFQNLineageRequest,
    OMetaLineageRequest,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.databend.constants import DEFAULT_CATALOG
from metadata.ingestion.source.database.databend.queries import (
    DATABEND_LINEAGE_HISTORY,
    DATABEND_QUERY_LINEAGE_FILTER,
    DATABEND_VIEW_LINEAGE_FILTER,
    DATABEND_VIEW_VERSIONS,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

TABLE_CACHE_SIZE = 1000
# Databend fetches named views directly up to 20 (database, name) checks per query; beyond that it
# lists the whole database (MAX_OPTIMIZED_PATH_CHECKS in Databend's system tables).
VIEW_LOOKUP_BATCH_SIZE = 20


@dataclass(frozen=True)
class LineageEndpoint:
    database: str
    name: str


@dataclass
class LineageEdge:
    """All Databend lineage records between one source and one target, merged."""

    source: LineageEndpoint
    target: LineageEndpoint
    is_view: bool = False
    sql: str | None = None
    columns: dict[str, set[str]] = field(default_factory=dict)

    def add_columns(self, column_lineage: Mapping[str, Any] | None) -> None:
        for mapping in (column_lineage or {}).get("mappings") or []:
            target_column = (mapping.get("target") or {}).get("name")
            if not target_column:
                continue
            source_columns = {source["name"] for source in mapping.get("sources") or [] if source.get("name")}
            if source_columns:
                self.columns.setdefault(target_column, set()).update(source_columns)


# LicenceDenied, LicenseKeyParseError, LicenseKeyInvalid and LicenseKeyExpired.
LICENSE_ERROR_CODES = ("[1112]", "[1401]", "[1402]", "[1404]")

# Databend error codes, matched in the driver's `QueryFailed: [<code>]` message. Privilege and
# license errors are checked first: they can be raised for a table that does exist.
LINEAGE_ERROR_HINTS: tuple[tuple[tuple[str, ...], str], ...] = (
    (
        ("[1063]",),
        "The user is not allowed to read it. Grant access with `GRANT SELECT ON system_history.* TO <user>`.",
    ),
    (
        LICENSE_ERROR_CODES,
        "Databend system_history tables require a valid Databend Enterprise license.",
    ),
    (
        ("[1003]",),
        "The system_history database does not exist. Lineage needs Databend v1.2.933 or later with "
        "`[log.history] on = true` and `[lineage] on = true` in the query configuration.",
    ),
    (
        ("[1025]",),
        "The lineage_history table does not exist. Enable lineage with `[lineage] on = true` in the Databend "
        "query configuration; it requires Databend v1.2.933 or later.",
    ),
)


def explain_lineage_error(exc: Exception) -> str:
    message = str(exc)
    for codes, hint in LINEAGE_ERROR_HINTS:
        if any(code in message for code in codes):
            return hint
    return (
        "Databend lineage requires Databend v1.2.933 or later with `[log.history] on = true` and "
        "`[lineage] on = true`, and SELECT on system_history.lineage_history."
    )


def parse_variant(value: Any) -> Mapping[str, Any] | None:
    """VARIANT columns come back from the driver as JSON text."""
    if value is None or isinstance(value, Mapping):
        return value
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        logger.debug("Skipping unparsable Databend VARIANT value: %r", value)
        return None
    return parsed if isinstance(parsed, Mapping) else None


def merge_lineage_rows(rows: Iterable[Mapping[str, Any]], is_view: bool = False) -> list[LineageEdge]:
    """Merge lineage records, ordered by `updated_on`, into one edge per (source, target)."""
    edges: dict[tuple[LineageEndpoint, LineageEndpoint], LineageEdge] = {}
    for row in rows:
        _add_row(edges, row, parse_variant(row.get("query_info")), is_view=is_view)
    return list(edges.values())


def current_view_rows(
    rows: Iterable[Mapping[str, Any]], view_versions: Mapping[LineageEndpoint, datetime]
) -> list[Mapping[str, Any]]:
    """
    Keep the CREATE_VIEW records of each view's current definition.

    `CREATE OR REPLACE VIEW` leaves the records of the previous definition in lineage_history, and
    a definition without table or view upstreams adds none. A record belongs to the current
    definition only when it was written at or after the view was last created, which
    `system.views.updated_on` records. Views missing from `view_versions` no longer exist.
    """
    current = []
    for row in rows:
        created_on = view_versions.get(_target(row))
        if created_on is not None and _as_utc(row["updated_on"]) >= created_on:
            current.append(row)
    return current


def _add_row(
    edges: dict[tuple[LineageEndpoint, LineageEndpoint], LineageEdge],
    row: Mapping[str, Any],
    query_info: Mapping[str, Any] | None,
    is_view: bool,
) -> None:
    source = LineageEndpoint(row["source_database"], row["source_name"])
    target = LineageEndpoint(row["target_database"], row["target_name"])
    # In-place DML such as UPDATE records the table as its own source.
    if source == target:
        return
    edge = edges.setdefault((source, target), LineageEdge(source=source, target=target))
    edge.is_view = edge.is_view or is_view
    edge.add_columns(parse_variant(row.get("column_lineage")))
    # Rows arrive oldest first, so the last query seen is the most recent one.
    edge.sql = (query_info or {}).get("query_text") or edge.sql


class DatabendLineageSource(LineageSource):
    """
    Read table and column lineage from `system_history.lineage_history`.

    Databend records lineage from its query planner, so no SQL is parsed here. Endpoints are
    matched to tables already ingested by the metadata workflow; edges whose endpoints are not
    in OpenMetadata yet are skipped and picked up by a later run.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata, get_engine: bool = True):
        super().__init__(config, metadata, get_engine)
        self._tables: LRUCache[str, Table | None] = LRUCache(maxsize=TABLE_CACHE_SIZE)
        self._lineage_unavailable = False

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config  # pyright: ignore[reportOptionalMemberAccess]
        if not isinstance(connection, DatabendConnection):
            raise InvalidSourceException(f"Expected DatabendConnection, but got {connection}")
        return cls(config, metadata)

    @property
    def pipeline_config(self) -> DatabaseServiceQueryLineagePipeline:
        return cast("DatabaseServiceQueryLineagePipeline", self.source_config)

    # The sink dispatches on the record type, so override-aware OMetaLineageRequest records travel
    # through the same stream the base class declares as AddLineageRequest.
    def yield_view_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        rows = yield from self._read_lineage(DATABEND_VIEW_LINEAGE_FILTER)
        if rows is None:
            return
        views = {_target(row) for row in rows if not self._is_endpoint_filtered(_target(row))}
        try:
            with self.engine.connect() as connection:  # pyright: ignore[reportOptionalMemberAccess]
                view_versions = self._get_view_versions(connection, views)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Databend view lineage",
                    error=f"Cannot read view definitions from system.views: {exc}",
                    stackTrace=traceback.format_exc(),
                ),
                right=None,
            )
            return

        current_rows = current_view_rows(rows, view_versions)
        emitted_views: set[LineageEndpoint] = set()
        yield from self._yield_requests(merge_lineage_rows(current_rows, is_view=True), emitted_views)
        self._clear_replaced_view_lineage(view for view in view_versions if view not in emitted_views)

    def yield_query_lineage(self) -> Iterable[Either[AddLineageRequest | CreateQueryRequest]]:
        rows = yield from self._read_lineage(
            DATABEND_QUERY_LINEAGE_FILTER.format(
                start_time=_format_timestamp(self.start),
                end_time=_format_timestamp(self.end),
            )
        )
        if rows is not None:
            yield from self._yield_requests(merge_lineage_rows(rows))

    def _read_lineage(self, filters: str) -> Generator[Either, None, Sequence[Mapping[str, Any]] | None]:
        """Read lineage records; returns None after reporting an unreadable lineage_history."""
        # View and query lineage read the same table: report an unavailable table once, not per stage.
        if self._lineage_unavailable:
            return None
        try:
            with self.engine.connect() as connection:  # pyright: ignore[reportOptionalMemberAccess]
                rows = connection.execute(text(DATABEND_LINEAGE_HISTORY.format(filters=filters))).mappings().all()
        except Exception as exc:
            self._lineage_unavailable = True
            yield Either(
                left=StackTraceError(
                    name="Databend lineage",
                    error=f"Cannot read system_history.lineage_history. {explain_lineage_error(exc)} Error: {exc}",
                    stackTrace=traceback.format_exc(),
                ),
                right=None,
            )
            return None
        if not rows:
            logger.info("No Databend lineage records found in system_history.lineage_history for this run")
        return rows

    def _yield_requests(
        self, edges: Iterable[LineageEdge], emitted_targets: set[LineageEndpoint] | None = None
    ) -> Iterator[Either]:
        for edge in edges:
            if self._is_filtered(edge):
                continue
            request = self._build_request(edge)
            if request:
                if emitted_targets is not None:
                    emitted_targets.add(edge.target)
                yield Either(left=None, right=request)

    def _get_view_versions(
        self, connection: Connection, views: Iterable[LineageEndpoint]
    ) -> dict[LineageEndpoint, datetime]:
        """Last creation time of each view that still exists."""
        names_by_database: dict[str, list[str]] = defaultdict(list)
        for view in views:
            names_by_database[view.database].append(view.name)
        query = text(DATABEND_VIEW_VERSIONS).bindparams(bindparam("names", expanding=True))
        versions = {}
        for database, names in names_by_database.items():
            names.sort()
            for start in range(0, len(names), VIEW_LOOKUP_BATCH_SIZE):
                batch = names[start : start + VIEW_LOOKUP_BATCH_SIZE]
                for name, updated_on in connection.execute(query, {"database": database, "names": batch}):
                    versions[LineageEndpoint(database, name)] = _as_utc(updated_on)
        return versions

    def _clear_replaced_view_lineage(self, views: Iterable[LineageEndpoint]) -> None:
        """
        Remove the view lineage of existing views that got no lineage request this run: their current
        definition has no table or view upstream in the default catalog, or every upstream is filtered
        out or not ingested yet. Override only replaces lineage when a request is emitted.

        Lineage of a just-replaced view reaches lineage_history asynchronously, so a view replaced
        right before the run is also cleared here; its new lineage is written by the next run.
        """
        if not self.pipeline_config.overrideViewLineage:
            return
        for view in sorted(views, key=lambda endpoint: (endpoint.database, endpoint.name)):
            table = self._get_table(view)
            if table:
                self.metadata.delete_lineage_by_source_by_name(
                    entity_type="table",
                    entity_fqn=table.fullyQualifiedName.root,  # pyright: ignore[reportOptionalMemberAccess]
                    source=LineageSourceType.ViewLineage.value,
                )

    def _is_endpoint_filtered(self, endpoint: LineageEndpoint) -> bool:
        return filter_by_schema(self.pipeline_config.schemaFilterPattern, endpoint.database) or filter_by_table(
            self.pipeline_config.tableFilterPattern, endpoint.name
        )

    def _is_filtered(self, edge: LineageEdge) -> bool:
        if self._is_endpoint_filtered(edge.source) or self._is_endpoint_filtered(edge.target):
            self.status.filter(_edge_label(edge), "Lineage endpoint filtered out")
            return True
        return False

    def _get_table(self, endpoint: LineageEndpoint) -> Table | None:
        table_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Table,
            service_name=self.config.serviceName,
            database_name=DEFAULT_CATALOG,
            schema_name=endpoint.database,
            table_name=endpoint.name,
            skip_es_search=True,
        )
        if not table_fqn:
            return None
        if table_fqn not in self._tables:
            self._tables[table_fqn] = self.metadata.get_by_name(entity=Table, fqn=table_fqn, fields=["columns"])
        return self._tables[table_fqn]

    def _build_request(self, edge: LineageEdge) -> OMetaLineageRequest | None:
        source_table = self._get_table(edge.source)
        target_table = self._get_table(edge.target)
        if not source_table or not target_table:
            logger.debug("Skipping Databend lineage %s: endpoint not ingested in OpenMetadata", _edge_label(edge))
            return None

        target_fqn = target_table.fullyQualifiedName.root  # pyright: ignore[reportOptionalMemberAccess]
        lineage_request = OMetaFQNLineageRequest(
            from_entity_fqn=source_table.fullyQualifiedName.root,  # pyright: ignore[reportOptionalMemberAccess]
            from_entity_type="table",
            to_entity_fqn=target_fqn,
            to_entity_type="table",
            lineage_details=LineageDetails(
                sqlQuery=SqlQuery(edge.sql) if edge.sql else None,
                source=LineageSourceType.ViewLineage if edge.is_view else LineageSourceType.QueryLineage,
                columnsLineage=_column_lineage(edge, source_table, target_table) or None,
            ),
        )
        # Overriding deletes the view's existing view lineage once per run (the delete-by-name call
        # is cached), so upstreams dropped from the view definition disappear.
        return OMetaLineageRequest(
            lineage_request=lineage_request,
            override_lineage=bool(edge.is_view and self.pipeline_config.overrideViewLineage),
            entity_fqn=target_fqn if edge.is_view else None,
            entity=Table if edge.is_view else None,
        )


def _column_lineage(edge: LineageEdge, source_table: Table, target_table: Table) -> list[ColumnLineage]:
    column_lineage = []
    for target_column, source_columns in sorted(edge.columns.items()):
        to_column = get_column_fqn(target_table, target_column)
        from_columns = sorted(
            column_fqn for column in source_columns if (column_fqn := get_column_fqn(source_table, column))
        )
        if to_column and from_columns:
            column_lineage.append(
                ColumnLineage(
                    fromColumns=[FullyQualifiedEntityName(column) for column in from_columns],
                    toColumn=FullyQualifiedEntityName(to_column),
                )
            )
    return column_lineage


def _target(row: Mapping[str, Any]) -> LineageEndpoint:
    return LineageEndpoint(row["target_database"], row["target_name"])


def _as_utc(value: datetime | str) -> datetime:
    """Databend returns aware UTC timestamps; naive values are UTC as well."""
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _edge_label(edge: LineageEdge) -> str:
    return f"{edge.source.database}.{edge.source.name} -> {edge.target.database}.{edge.target.name}"


def _format_timestamp(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S")
