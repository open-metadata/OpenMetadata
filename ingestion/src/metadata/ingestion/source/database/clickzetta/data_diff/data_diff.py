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
"""ClickZetta adapter for the optional ``data-diff`` dependency.

The OpenMetadata validator imports this module only when the ClickZetta
service spec opts into data diff.  Registration is explicit so installing the
connector cannot unexpectedly add a new data-reading scheme to unrelated
workflows.
"""

from __future__ import annotations

import re
from functools import partial
from typing import Any, ClassVar

import attrs
from data_diff.abcs.database_types import (
    Boolean,
    Date,
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
    ThreadLocalInterpreter,
)
from data_diff.databases.presto import Dialect as PrestoDialect
from data_diff.databases.presto import query_cursor
from data_diff.schema import RawColumnInfo

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")


class ClickzettaDialect(PrestoDialect):
    """Data-diff SQL dialect for ClickZetta's standard SQL surface."""

    name = "ClickZetta"
    ROUNDS_ON_PREC_LOSS = True
    TYPE_CLASSES: ClassVar[dict[str, type]] = {
        "TIMESTAMP": Timestamp,
        "TIMESTAMP_NTZ": Timestamp,
        "TIMESTAMP_TZ": TimestampTZ,
        "DATE": Date,
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
    TYPE_CLASSES.update({key.lower(): value for key, value in TYPE_CLASSES.items()})

    def quote(self, s: str):
        if not isinstance(s, str) or not _IDENTIFIER.fullmatch(s):
            raise ValueError(f"Invalid ClickZetta identifier: {s!r}")
        return f"`{s}`"

    def to_string(self, s: str):
        return f"CAST({s} AS STRING)"

    def parse_type(self, table_path, info: RawColumnInfo):
        """Parse ClickZetta's case-insensitive DESCRIBE type names."""

        data_type = info.data_type.strip().lower()
        if data_type == "timestamp_ntz":
            data_type = "timestamp"
        elif data_type in {"timestamp_tz", "timestamp_ltz"}:
            data_type = "timestamp_tz"

        normalized_info = attrs.evolve(info, data_type=data_type)
        if data_type == "date":
            return Date(
                precision=normalized_info.datetime_precision or 0,
                rounds=self.ROUNDS_ON_PREC_LOSS,
            )
        return super().parse_type(table_path, normalized_info)

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
        # The first guarded implementation required an explicit opt-in. Keep
        # accepting that opt-in, but do not silently turn an explicit false
        # into permission to execute standard OpenMetadata data-diff queries.
        legacy_scan_values = [
            extra.pop(option) for option in ("allowFullTableScan", "clickzettaAllowFullTableScan") if option in extra
        ]
        if any(str(value).strip().lower() != "true" for value in legacy_scan_values):
            raise ValueError(
                "ClickZetta data diff now follows standard OpenMetadata behavior; "
                "remove the legacy allowFullTableScan=false option before enabling it"
            )

        host_parts = host.split(".", 1)
        instance = extra.pop("instance", None) or (host_parts[0] if len(host_parts) == 2 else None)
        if extra:
            raise ValueError(f"Unsupported ClickZetta data-diff connection options: {', '.join(sorted(extra))}")
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
        )

    def _query(self, sql_code: str | ThreadLocalInterpreter) -> list:
        cursor = self._conn.cursor()
        if isinstance(sql_code, ThreadLocalInterpreter):
            sql_code.apply_queries(partial(query_cursor, cursor))
            return []
        cursor.execute(sql_code)
        if sql_code.lstrip().lower().startswith(("select", "show", "describe", "explain")):
            return cursor.fetchall()
        return cursor.fetchone()

    def close(self):
        super().close()
        self._conn.close()

    def select_table_schema(self, path):
        schema, table = self._normalize_table_path(path)
        return f"DESCRIBE {self._quote_identifier(schema)}.{self._quote_identifier(table)}"

    @staticmethod
    def _quote_identifier(value: str) -> str:
        if not isinstance(value, str) or not _IDENTIFIER.fullmatch(value):
            raise ValueError(f"Invalid ClickZetta identifier: {value!r}")
        return f"`{value}`"

    @staticmethod
    def _parse_describe_type(data_type: str) -> tuple[str, int | None, int | None, int | None]:
        """Normalize a ClickZetta DESCRIBE type into data-diff metadata."""

        match = re.fullmatch(r"\s*([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]*)\))?\s*", data_type)
        if not match:
            return data_type.strip().upper(), None, None, None

        base_type = match.group(1).upper()
        args = []
        if match.group(2):
            for value in match.group(2).split(","):
                try:
                    args.append(int(value.strip()))
                except ValueError:
                    args = []
                    break

        datetime_precision = args[0] if args and base_type.startswith("TIMESTAMP") else None
        numeric_precision = args[0] if args and base_type in {"DECIMAL", "NUMERIC"} else None
        numeric_scale = args[1] if len(args) > 1 and base_type in {"DECIMAL", "NUMERIC"} else None
        if base_type == "NUMERIC":
            base_type = "DECIMAL"
        return base_type, datetime_precision, numeric_precision, numeric_scale

    def query_table_schema(self, path):
        """Read ClickZetta's accessible DESCRIBE result instead of information_schema."""

        rows = self._query(self.select_table_schema(path))
        if not rows:
            raise RuntimeError(f"{self.name}: Table '{'.'.join(path)}' does not exist, or has no columns")

        schema = {}
        for row in rows:
            if len(row) < 2 or not row[0] or not row[1]:
                continue
            data_type, datetime_precision, numeric_precision, numeric_scale = self._parse_describe_type(str(row[1]))
            schema[row[0]] = RawColumnInfo(
                column_name=row[0],
                data_type=data_type,
                datetime_precision=datetime_precision,
                numeric_precision=numeric_precision,
                numeric_scale=numeric_scale,
            )

        if not schema:
            raise RuntimeError(f"{self.name}: Table '{'.'.join(path)}' does not exist, or has no columns")
        return schema

    @property
    def is_autocommit(self) -> bool:
        return True


def register_clickzetta_data_diff() -> None:
    """Register the adapter in data-diff's global dispatcher explicitly."""

    from data_diff.databases import _connect

    _connect.DATABASE_BY_SCHEME["clickzetta"] = ClickzettaDatabase
    _connect.connect.database_by_scheme["clickzetta"] = ClickzettaDatabase
