"""ClickZetta adapter for the optional ``data-diff`` dependency.

The OpenMetadata validator imports this module only when the ClickZetta
service spec opts into data diff.  Registration is explicit so installing the
connector cannot unexpectedly add a new data-reading scheme to unrelated
workflows.
"""

from __future__ import annotations

import re
from typing import Any, ClassVar

import attrs
from data_diff.abcs.database_types import (
    Boolean,
    Decimal,
    Float,
    Integer,
    Text,
    Timestamp,
    TimestampTZ,
)
from data_diff.databases.base import (
    CHECKSUM_HEXDIGITS,
    CHECKSUM_OFFSET,
    BaseDialect,
    Database,
)
from data_diff.databases.presto import Dialect as PrestoDialect

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")


class ClickzettaDialect(PrestoDialect):
    """Data-diff SQL dialect for ClickZetta's standard SQL surface."""

    name = "ClickZetta"
    ROUNDS_ON_PREC_LOSS = True
    TYPE_CLASSES: ClassVar[dict[str, type]] = {
        "TIMESTAMP": Timestamp,
        "TIMESTAMP_TZ": TimestampTZ,
        "INT8": Integer,
        "INT16": Integer,
        "INT32": Integer,
        "INT64": Integer,
        "INTEGER": Integer,
        "BIGINT": Integer,
        "FLOAT32": Float,
        "FLOAT64": Float,
        "FLOAT": Float,
        "DOUBLE": Float,
        "STRING": Text,
        "VARCHAR": Text,
        "CHAR": Text,
        "BOOLEAN": Boolean,
        "BOOL": Boolean,
        "DECIMAL": Decimal,
    }

    def quote(self, s: str):
        if not isinstance(s, str) or not _IDENTIFIER.fullmatch(s):
            raise ValueError(f"Invalid ClickZetta identifier: {s!r}")
        return f"`{s}`"

    def to_string(self, s: str):
        return f"CAST({s} AS STRING)"

    def md5_as_hex(self, s: str) -> str:
        return f"MD5(CAST({s} AS STRING))"

    def md5_as_int(self, s: str) -> str:
        # ClickZetta exposes MD5 as a hex string.  CONV keeps the hash
        # expression deterministic while avoiding a full row materialization.
        return (
            f"CAST(CONV(SUBSTR({self.md5_as_hex(s)}, 1, {CHECKSUM_HEXDIGITS}), "
            f"16, 10) AS DECIMAL(38, 0)) - {CHECKSUM_OFFSET}"
        )

    def normalize_timestamp(self, value: str, coltype: Timestamp) -> str:
        return self.to_string(value)

    def normalize_number(self, value: str, coltype: Float | Decimal) -> str:
        return self.to_string(value)

    def normalize_boolean(self, value: str, coltype: Boolean) -> str:
        return self.to_string(value)


@attrs.define(frozen=False, init=False)
class ClickzettaDatabase(Database):
    """DB-API data-diff connection using the pinned ClickZetta connector."""

    DIALECT_CLASS: ClassVar[type[BaseDialect]] = ClickzettaDialect
    CONNECT_URI_HELP = "clickzetta://<user>:<password>@<instance>.<service>/<workspace>?virtualcluster=<name>"
    CONNECT_URI_PARAMS: ClassVar[list[str]] = ["workspace"]
    CONNECT_URI_KWPARAMS: ClassVar[list[str]] = ["virtualcluster"]

    _conn: Any
    allow_full_table_scan: bool = attrs.field(default=False, init=False)

    def __init__(
        self,
        *,
        host: str,
        workspace: str,
        virtualcluster: str,
        user: str | None = None,
        password: str | None = None,
        port: int | None = None,
        schema: str | None = None,
        protocol: str = "https",
        **extra,
    ) -> None:
        super().__init__()
        self.default_schema = schema or "public"
        self.allow_full_table_scan = (
            str(extra.pop("allowFullTableScan", extra.pop("clickzettaAllowFullTableScan", "false"))).strip().lower()
            == "true"
        )

        host_parts = host.split(".", 1)
        instance = extra.pop("instance", None) or (host_parts[0] if len(host_parts) == 2 else None)
        service = host_parts[1] if len(host_parts) == 2 else host_parts[0]
        if port:
            service = f"{service}:{port}"
        if not instance:
            raise ValueError("ClickZetta data-diff URL must include an instance in the host")

        from clickzetta.connector.v0 import dbapi

        self._conn = dbapi.connect(
            username=user,
            password=password,
            instance=instance,
            workspace=workspace,
            vcluster=virtualcluster,
            service=service,
            schema=self.default_schema,
            protocol=protocol,
            **extra,
        )

    def _query(self, sql_code: str) -> list:
        normalized_sql = sql_code.lower()
        if "information_schema.columns" not in normalized_sql and not self.allow_full_table_scan:
            raise RuntimeError(
                "ClickZetta data diff is disabled for data queries unless "
                "allowFullTableScan=true is explicitly configured"
            )
        cursor = self._conn.cursor()
        cursor.execute(sql_code)
        if sql_code.lstrip().lower().startswith(("select", "show", "explain")):
            return cursor.fetchall()
        return cursor.fetchone()

    def close(self):
        super().close()
        self._conn.close()

    def select_table_schema(self, path):
        schema, table = self._normalize_table_path(path)
        # ClickZetta's information schema is exposed beneath sys, like the
        # native job-history view used by the usage/lineage source.
        return (
            "SELECT column_name, data_type, datetime_precision, numeric_precision, numeric_scale "
            "FROM sys.information_schema.columns "
            f"WHERE table_name = '{self._quote_literal(table)}' "
            f"AND table_schema = '{self._quote_literal(schema)}'"
        )

    @staticmethod
    def _quote_literal(value: str) -> str:
        if not isinstance(value, str) or not _IDENTIFIER.fullmatch(value):
            raise ValueError(f"Invalid ClickZetta schema/table name: {value!r}")
        return value.replace("'", "''")

    @property
    def is_autocommit(self) -> bool:
        return True


def register_clickzetta_data_diff() -> None:
    """Register the adapter in data-diff's global dispatcher explicitly."""

    from data_diff.databases import _connect

    _connect.DATABASE_BY_SCHEME["clickzetta"] = ClickzettaDatabase
    _connect.connect.database_by_scheme["clickzetta"] = ClickzettaDatabase
