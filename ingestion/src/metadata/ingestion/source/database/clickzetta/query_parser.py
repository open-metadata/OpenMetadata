#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Common ClickZetta query-history parsing for usage and lineage ingestion."""

from abc import ABC
from collections.abc import Mapping
from datetime import date, datetime, timezone
from typing import Any, Optional

from metadata.generated.schema.entity.services.connections.database.clickzettaConnection import (
    ClickzettaConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import DateTime
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.clickzetta.queries import (
    ClickzettaQueryHistoryMode,
    build_clickzetta_query_history_sql,
    validate_query_history_filter_condition,
    validate_query_history_table,
)
from metadata.ingestion.source.database.query_parser_source import QueryParserSource

CLICKZETTA_LIFECYCLE_QUERY_TYPES = frozenset(
    {
        "ALTER",
        "DELETE",
        "DROP",
        "INSERT",
        "MERGE",
        "TRUNCATE",
        "UPDATE",
    }
)


def _row_mapping(row: Any) -> dict[str, Any]:
    if hasattr(row, "_mapping"):
        return dict(row._mapping)
    if hasattr(row, "_asdict"):
        return dict(row._asdict())
    if isinstance(row, Mapping):
        return dict(row)
    raise TypeError(f"Unsupported ClickZetta query-history row type: {type(row)!r}")


def _lowercase_keys(row: Any) -> dict[str, Any]:
    return {str(key).lower(): value for key, value in _row_mapping(row).items()}


def _coerce_datetime(value: Any) -> Optional[datetime]:  # noqa: UP045
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time(), tzinfo=timezone.utc)
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _coerce_bool(value: Any) -> Optional[bool]:  # noqa: UP045
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "aborted", "cancelled", "canceled", "failed"}:
            return True
        if normalized in {"false", "0", "no", "n", "completed", "success", "succeeded"}:
            return False
    return None


def _coerce_float(value: Any) -> Optional[float]:  # noqa: UP045
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _is_lifecycle_query(query_type: Any, query_text: str) -> bool:
    if isinstance(query_type, str) and query_type.strip().upper() in CLICKZETTA_LIFECYCLE_QUERY_TYPES:
        return True
    normalized_query = query_text.strip().lower()
    return normalized_query.startswith(("alter ", "delete ", "drop ", "insert ", "merge ", "truncate ", "update "))


def normalize_clickzetta_query_row(
    row: Any,
    *,
    service_name: str,
    database_name: Optional[str] = None,  # noqa: UP045
    database_schema: Optional[str] = None,  # noqa: UP045
    include_usage: bool,
) -> Optional[TableQuery]:  # noqa: UP045
    """Convert one canonical query-history row into OpenMetadata's TableQuery."""
    values = _lowercase_keys(row)
    query_value = values.get("query_text")
    if isinstance(query_value, bytes):
        query_text = query_value.decode(errors="ignore")
    elif query_value is not None:
        query_text = str(query_value)
    else:
        query_text = ""
    query_text = query_text.replace("\\n", "\n").strip()
    if not query_text:
        return None

    start_time = values.get("start_time")
    end_time = values.get("end_time")
    analysis_date = _coerce_datetime(start_time) or datetime.now(timezone.utc)
    resolved_database = values.get("database_name") or database_name
    resolved_schema = values.get("schema_name") or database_schema
    query_type = values.get("query_type")
    query_type = str(query_type) if query_type is not None else None

    return TableQuery(
        dialect=Dialect.ANSI.value,
        query=query_text,
        query_type=query_type,
        exclude_usage=include_usage and _is_lifecycle_query(query_type, query_text),
        userName=str(values["user_name"]) if values.get("user_name") is not None else None,
        startTime=str(start_time) if start_time is not None else None,
        endTime=str(end_time) if end_time is not None else None,
        analysisDate=DateTime(analysis_date),
        aborted=_coerce_bool(values.get("aborted")),
        databaseName=str(resolved_database) if resolved_database is not None else None,
        databaseSchema=str(resolved_schema) if resolved_schema is not None else None,
        duration=_coerce_float(values.get("duration")),
        serviceName=service_name,
        cost=_coerce_float(values.get("cost")),
    )


class ClickzettaQueryParserSource(QueryParserSource, ABC):
    """Base source for ClickZetta usage and query-lineage extraction."""

    query_history_mode: ClickzettaQueryHistoryMode

    @classmethod
    def create(
        cls,
        config_dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,  # noqa: UP045
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        if config.serviceConnection is None:
            raise InvalidSourceException("ClickZetta service connection is required")
        connection: ClickzettaConnection = config.serviceConnection.root.config
        if not isinstance(connection, ClickzettaConnection):
            raise InvalidSourceException(f"Expected ClickzettaConnection, but got {connection}")
        return cls(config, metadata)

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata, get_engine: bool = True):
        super().__init__(config, metadata, get_engine=get_engine)
        # ClickZetta is not yet part of the global mapper. ANSI is the safe
        # parser choice until a vendor-specific sqlglot dialect is contributed.
        self.dialect = Dialect.ANSI

    @property
    def query_history_table(self) -> str:
        table = getattr(self.service_connection, "queryHistoryTable", None)
        if not table:
            raise InvalidSourceException("ClickZetta queryHistoryTable is required for usage or lineage extraction")
        return validate_query_history_table(table)

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        try:
            filter_condition = validate_query_history_filter_condition(
                getattr(self.source_config, "filterCondition", None)
            )
        except (TypeError, ValueError) as exc:
            raise InvalidSourceException(str(exc)) from exc

        return build_clickzetta_query_history_sql(
            query_history_table=self.query_history_table,
            start_time=start_time,
            end_time=end_time,
            database_name=getattr(self.service_connection, "databaseName", None),
            database_schema=getattr(self.service_connection, "databaseSchema", None),
            query_history_mode=self.query_history_mode,
            filter_condition=filter_condition,
            result_limit=getattr(self.source_config, "resultLimit", None),
        )

    def get_database_name(self, data: dict) -> Optional[str]:  # noqa: UP045
        return data.get("database_name") or getattr(self.service_connection, "databaseName", None)

    def get_schema_name(self, data: dict) -> Optional[str]:  # noqa: UP045
        return data.get("schema_name") or getattr(self.service_connection, "databaseSchema", None)

    def normalize_query_row(self, row: Any, *, include_usage: bool) -> Optional[TableQuery]:  # noqa: UP045
        return normalize_clickzetta_query_row(
            row,
            service_name=self.config.serviceName,
            database_name=getattr(self.service_connection, "databaseName", None),
            database_schema=getattr(self.service_connection, "databaseSchema", None),
            include_usage=include_usage,
        )
