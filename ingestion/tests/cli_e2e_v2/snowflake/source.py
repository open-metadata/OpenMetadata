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
"""Owned Snowflake schemas in the configured E2E database.

Snowflake cannot run in a disposable container, so isolation comes from one fresh
schema per test inside a database the E2E identity may write to. Nothing outside
an owned schema is mutated.

ACCOUNT_USAGE views lag by up to two hours, which no fresh schema can wait out.
`SnowflakeSource.account_usage_shim()` builds an owned stand-in schema that
`accountUsageSchema` can point at: the latency-bound views read the same
real-time INFORMATION_SCHEMA data, everything else passes through unchanged.
"""

from __future__ import annotations

import logging
import os
import re
import uuid
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from cryptography.hazmat.primitives import serialization
from snowflake.sqlalchemy import URL
from sqlalchemy import create_engine, text
from tenacity import Retrying, retry_if_exception_type, stop_after_delay, wait_fixed

from ..runtime.ci import mask_secrets
from ..server import Env
from .baseline import build_snowflake_baseline, qualified_schema, quote_identifier

if TYPE_CHECKING:
    from collections.abc import Iterator

    from sqlalchemy.engine import Engine

    from ..features.database.source import SqlSourceBaseline

logger = logging.getLogger(__name__)

ACCOUNT_ENV = "E2E_SNOWFLAKE_ACCOUNT"
USERNAME_ENV = "E2E_SNOWFLAKE_USERNAME"
WAREHOUSE_ENV = "E2E_SNOWFLAKE_WAREHOUSE"
DATABASE_ENV = "E2E_SNOWFLAKE_DATABASE"
ROLE_ENV = "E2E_SNOWFLAKE_ROLE"
PASSWORD_ENV = "E2E_SNOWFLAKE_PASSWORD"
PRIVATE_KEY_ENV = "E2E_SNOWFLAKE_PRIVATE_KEY"
PASSPHRASE_ENV = "E2E_SNOWFLAKE_PASSPHRASE"
# The CLI expands ${VARS} in the raw YAML before parsing, so the key it reads must stay on one line.
CLI_PRIVATE_KEY_ENV = "E2E_SNOWFLAKE_CLI_PRIVATE_KEY"
AUTH_ENV = "E2E_SNOWFLAKE_AUTH"
KEY_PAIR_AUTH = "key_pair"
PASSWORD_AUTH = "password"
SCHEMA_PREFIX = "E2E_SF_"
SCHEMA_COMMENT = "owner=cli-e2e-v2"
_SHIM_SUFFIX = "_AU"
_IDENTIFIER = re.compile(r"^[A-Z_][A-Z0-9_]*$")
_QUERY_ID = re.compile(r"^[0-9a-f-]+$")
# Views the connector reads whose latency is irrelevant to the E2E assertions.
_PASS_THROUGH_VIEWS = ("TABLES", "ACCESS_HISTORY", "DYNAMIC_TABLE_REFRESH_HISTORY", "COPY_HISTORY")
_DML_COUNT_COLUMNS = {
    "number of rows inserted": "inserted",
    "number of rows updated": "updated",
    "number of rows deleted": "deleted",
}
_DML_IGNORED_COLUMNS = {"number of multi-joined rows updated"}


@dataclass(frozen=True)
class SnowflakeInstance:
    database: str
    warehouse: str
    auth: str
    admin_engine: Engine = field(repr=False)


def auth_mode() -> str:
    """`key_pair` (CI) reads the private key variables, `password` suits a test account without MFA."""
    mode = Env(AUTH_ENV, default=KEY_PAIR_AUTH).get()
    if mode not in (KEY_PAIR_AUTH, PASSWORD_AUTH):
        raise ValueError(f"{AUTH_ENV} must be {KEY_PAIR_AUTH!r} or {PASSWORD_AUTH!r}")
    return mode


def _execute(engine: Engine, statement: str) -> None:
    with engine.begin() as connection:
        connection.exec_driver_sql(statement)


def _restore_environment(previous: dict[str, str | None]) -> None:
    for key, value in previous.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


def _private_key_der(pem: str, passphrase: str | None) -> bytes:
    key = serialization.load_pem_private_key(pem.encode(), password=passphrase.encode() if passphrase else None)
    return key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )


@contextmanager
def snowflake_account() -> Iterator[SnowflakeInstance]:
    """Authenticate the E2E identity and export the CLI key, restoring the environment on exit."""
    auth = auth_mode()
    url_args = {
        "account": Env(ACCOUNT_ENV).get(),
        "user": Env(USERNAME_ENV).get(),
        "warehouse": Env(WAREHOUSE_ENV).get(),
        "database": Env(DATABASE_ENV).get(),
    }
    role = Env(ROLE_ENV, required=False).get()
    if role:
        url_args["role"] = role
    with ExitStack() as cleanup:
        if auth == PASSWORD_AUTH:
            password = Env(PASSWORD_ENV).get()
            mask_secrets(password)
            connect_args: dict[str, Any] = {"password": password}
        else:
            pem = Env(PRIVATE_KEY_ENV).get().replace("\\n", "\n")
            passphrase = Env(PASSPHRASE_ENV, required=False).get()
            cli_key = pem.replace("\n", "\\n")
            mask_secrets(pem, cli_key, passphrase or "")
            connect_args = {"private_key": _private_key_der(pem, passphrase)}
            cleanup.callback(_restore_environment, {CLI_PRIVATE_KEY_ENV: os.environ.get(CLI_PRIVATE_KEY_ENV)})
            os.environ[CLI_PRIVATE_KEY_ENV] = cli_key
        engine = create_engine(URL(**url_args), connect_args=connect_args, hide_parameters=True)
        cleanup.callback(engine.dispose)
        with engine.connect() as connection:
            database, warehouse = connection.execute(text("SELECT CURRENT_DATABASE(), CURRENT_WAREHOUSE()")).one()
        if not database or not warehouse:
            raise ValueError(f"{DATABASE_ENV} and {WAREHOUSE_ENV} must name a database and warehouse the role can use")
        logger.info("Snowflake E2E account authenticated, auth=%s database=%s", auth, database)
        yield SnowflakeInstance(database, warehouse, auth, engine)


@dataclass(frozen=True)
class DmlResult:
    """One DML statement's query ID and the row counts Snowflake returned for it."""

    query_id: str
    inserted: int = 0
    updated: int = 0
    deleted: int = 0


@dataclass(frozen=True)
class AccountUsageShim:
    """An owned stand-in for SNOWFLAKE.ACCOUNT_USAGE, addressed through `accountUsageSchema`."""

    database: str
    schema: str
    engine: Engine = field(repr=False)

    @property
    def name(self) -> str:
        return f"{self.database}.{self.schema}"

    @property
    def qualified(self) -> str:
        return qualified_schema(self.database, self.schema)

    def record(self, *results: DmlResult) -> None:
        """Expose UPDATE and DELETE counts that INFORMATION_SCHEMA.QUERY_HISTORY() does not report."""
        if not results:
            raise ValueError("record at least one DML result")
        if any(not _QUERY_ID.match(result.query_id) for result in results):
            raise ValueError("query IDs must be Snowflake query IDs")
        rows = ", ".join(f"('{result.query_id}', {result.updated}, {result.deleted})" for result in results)
        _execute(self.engine, f"INSERT INTO {self.qualified}.DML_RESULTS VALUES {rows}")

    def wait_for_queries(self, query_ids: list[str], *, timeout: float = 120) -> None:
        """Block until the shim's QUERY_HISTORY lists every query, so profiling cannot read a stale history."""
        if not query_ids or any(not _QUERY_ID.match(query_id) for query_id in query_ids):
            raise ValueError("query IDs must be nonempty Snowflake query IDs")
        wanted = set(query_ids)
        listed = ", ".join(f"'{query_id}'" for query_id in query_ids)

        def visible():
            with self.engine.connect() as connection:
                seen = set(
                    connection.exec_driver_sql(
                        f"SELECT QUERY_ID FROM {self.qualified}.QUERY_HISTORY WHERE QUERY_ID IN ({listed})"
                    ).scalars()
                )
            assert wanted <= seen, f"queries not yet in QUERY_HISTORY: {sorted(wanted - seen)}"

        Retrying(
            retry=retry_if_exception_type(AssertionError),
            stop=stop_after_delay(timeout),
            wait=wait_fixed(2),
            reraise=True,
        )(visible)


def _string_literal(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def _tag_references_select(database: str, function: str, name: str, domain: str) -> str:
    return (
        "SELECT TAG_DATABASE, TAG_SCHEMA, TAG_NAME, TAG_VALUE, OBJECT_DATABASE, OBJECT_SCHEMA, OBJECT_NAME, "
        f"DOMAIN, COLUMN_NAME, APPLY_METHOD FROM TABLE({quote_identifier(database)}.INFORMATION_SCHEMA.{function}("
        f"{_string_literal(name)}, '{domain}'))"
    )


def _shim_statements(shim: AccountUsageShim, schema: str, tables: list[str]) -> list[str]:
    database = shim.database
    db = quote_identifier(database)
    owned = _string_literal(schema)
    qualified = shim.qualified
    references = [
        _tag_references_select(database, "TAG_REFERENCES", db, "database"),
        _tag_references_select(database, "TAG_REFERENCES", f"{db}.{quote_identifier(schema)}", "schema"),
    ]
    for table in tables:
        name = f"{db}.{quote_identifier(schema)}.{quote_identifier(table)}"
        references.append(_tag_references_select(database, "TAG_REFERENCES", name, "table"))
        references.append(_tag_references_select(database, "TAG_REFERENCES_ALL_COLUMNS", name, "table"))
    return [
        f"CREATE TABLE IF NOT EXISTS {qualified}.DML_RESULTS (QUERY_ID VARCHAR, ROWS_UPDATED NUMBER, ROWS_DELETED NUMBER)",
        # ACCOUNT_USAGE keeps dropped routines with a DELETED timestamp, and live ones carry NULL.
        f"CREATE OR REPLACE VIEW {qualified}.PROCEDURES AS SELECT *, NULL::TIMESTAMP_LTZ AS DELETED "
        f"FROM {db}.INFORMATION_SCHEMA.PROCEDURES WHERE PROCEDURE_SCHEMA = {owned}",
        f"CREATE OR REPLACE VIEW {qualified}.FUNCTIONS AS SELECT *, NULL::TIMESTAMP_LTZ AS DELETED "
        f"FROM {db}.INFORMATION_SCHEMA.FUNCTIONS WHERE FUNCTION_SCHEMA = {owned}",
        # The table functions also return inherited references, which ACCOUNT_USAGE does not list.
        f"CREATE OR REPLACE VIEW {qualified}.TAG_REFERENCES AS SELECT *, NULL::TIMESTAMP_LTZ AS OBJECT_DELETED "
        f"FROM ({' UNION ALL '.join(references)}) WHERE APPLY_METHOD <> 'INHERITED'",
        # QUERY_HISTORY() has ROWS_INSERTED but no UPDATE or DELETE counts, and its ROWS_PRODUCED counts
        # rewritten rows, so those two come from each statement's own result, recorded by the test.
        f"""
        CREATE OR REPLACE VIEW {qualified}.QUERY_HISTORY AS
        SELECT
            h.QUERY_ID, h.QUERY_TEXT, h.DATABASE_NAME, h.SCHEMA_NAME, h.QUERY_TYPE, h.USER_NAME, h.ROLE_NAME,
            h.WAREHOUSE_NAME, h.EXECUTION_STATUS, h.START_TIME, h.END_TIME, h.TOTAL_ELAPSED_TIME,
            h.CREDITS_USED_CLOUD_SERVICES, h.ROWS_PRODUCED,
            COALESCE(h.ROWS_INSERTED, 0) AS ROWS_INSERTED,
            COALESCE(r.ROWS_UPDATED, 0) AS ROWS_UPDATED,
            COALESCE(r.ROWS_DELETED, 0) AS ROWS_DELETED
        FROM TABLE({db}.INFORMATION_SCHEMA.QUERY_HISTORY(
            END_TIME_RANGE_START => DATEADD('hour', -6, CURRENT_TIMESTAMP()), RESULT_LIMIT => 10000
        )) h
        LEFT JOIN {qualified}.DML_RESULTS r ON r.QUERY_ID = h.QUERY_ID
        """,
        *(
            f"CREATE OR REPLACE VIEW {qualified}.{view} AS SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.{view}"
            for view in _PASS_THROUGH_VIEWS
        ),
    ]


@dataclass
class SnowflakeSource:
    instance: SnowflakeInstance
    schema: str
    baseline: SqlSourceBaseline
    _cleanup: ExitStack = field(repr=False)
    _shim: AccountUsageShim | None = field(default=None, init=False, repr=False)
    _closed: bool = field(default=False, init=False, repr=False)

    @property
    def database(self) -> str:
        return self.instance.database

    @property
    def qualified(self) -> str:
        return qualified_schema(self.database, self.schema)

    def require_active(self) -> None:
        if self._closed:
            raise ValueError("Snowflake source has already been closed")

    def _table(self, name: str):
        """Look up a declared table by its declared or folded upper-case name."""
        self.require_active()
        return self.baseline.metadata.tables[f"{self.schema}.{name.lower()}"]

    def run(self, statement: str) -> list[Any]:
        """Run one statement and return its rows, if any."""
        self.require_active()
        with self.instance.admin_engine.begin() as connection:
            result = connection.exec_driver_sql(statement)
            return list(result) if result.returns_rows else []

    def dml(self, statement: str) -> DmlResult:
        """Run one DML statement and return Snowflake's own row counts for it."""
        self.require_active()
        with self.instance.admin_engine.begin() as connection:
            cursor = connection.connection.cursor()
            try:
                cursor.execute(statement)
                names = [column[0].lower() for column in cursor.description]
                row = cursor.fetchone()
                query_id = cursor.sfqid
            finally:
                cursor.close()
        unknown = set(names) - _DML_COUNT_COLUMNS.keys() - _DML_IGNORED_COLUMNS
        if unknown:
            raise ValueError(f"not a DML result: {sorted(unknown)}")
        counts = {
            _DML_COUNT_COLUMNS[name]: value
            for name, value in zip(names, row, strict=True)
            if name in _DML_COUNT_COLUMNS
        }
        return DmlResult(query_id, **counts)

    def drop_table(self, name: str) -> None:
        """Drop a declared table in this owned schema."""
        self._table(name).drop(self.instance.admin_engine)

    def set_value(self, table: str, key: int, column: str, value: Any) -> None:
        """Update one declared column by primary key in this owned schema."""
        declared = self._table(table)
        target_column = declared.c[column.lower()]
        with self.instance.admin_engine.begin() as connection:
            result = connection.execute(declared.update().where(declared.c.id == key).values({target_column: value}))
            if result.rowcount != 1:
                raise ValueError(f"Expected one {table} row for key {key}, found {result.rowcount}")

    def set_description(self, table: str, description: str) -> None:
        declared = self._table(table)
        self.run(f"COMMENT ON TABLE {self.qualified}.{declared.name} IS {_string_literal(description)}")

    def account_usage_shim(self) -> AccountUsageShim:
        """Create or refresh the owned ACCOUNT_USAGE stand-in.

        TAG_REFERENCES enumerates this schema's tables when called, so call it after
        creating every object whose tags the test reads.
        """
        self.require_active()
        if self._shim is None:
            shim = AccountUsageShim(self.database, f"{self.schema}{_SHIM_SUFFIX}", self.instance.admin_engine)
            _execute(self.instance.admin_engine, f"CREATE SCHEMA {shim.qualified} COMMENT = '{SCHEMA_COMMENT}'")
            self._cleanup.callback(
                _execute, self.instance.admin_engine, f"DROP SCHEMA IF EXISTS {shim.qualified} CASCADE"
            )
            self._shim = shim
        tables = [
            row[0]
            for row in self.run(
                f"SELECT TABLE_NAME FROM {quote_identifier(self.database)}.INFORMATION_SCHEMA.TABLES "
                f"WHERE TABLE_SCHEMA = {_string_literal(self.schema)} ORDER BY TABLE_NAME"
            )
        ]
        for statement in _shim_statements(self._shim, self.schema, tables):
            _execute(self.instance.admin_engine, statement)
        return self._shim


def _seed_source(source: SnowflakeSource) -> None:
    with source.instance.admin_engine.begin() as connection:
        source.baseline.metadata.create_all(connection, checkfirst=False)
        for seed in source.baseline.seeds:
            table = source.baseline.metadata.tables[f"{source.schema}.{seed.table_name}"]
            connection.execute(table.insert().values(seed.rows))
        for statement in source.baseline.ddl:
            connection.exec_driver_sql(statement)


@contextmanager
def fresh_snowflake_source(instance: SnowflakeInstance) -> Iterator[SnowflakeSource]:
    """Create and seed one fresh schema, attempting the drop even on partial setup failure."""
    schema = f"{SCHEMA_PREFIX}{uuid.uuid4().hex.upper()}"
    if not _IDENTIFIER.match(schema):
        raise ValueError("generated schema name is not a plain identifier")
    with ExitStack() as cleanup:
        source = SnowflakeSource(instance, schema, build_snowflake_baseline(instance.database, schema), cleanup)
        try:
            # Zero retention: a dropped schema leaves no Time Travel storage behind.
            _execute(
                instance.admin_engine,
                f"CREATE SCHEMA {source.qualified} DATA_RETENTION_TIME_IN_DAYS = 0 COMMENT = '{SCHEMA_COMMENT}'",
            )
            cleanup.callback(_execute, instance.admin_engine, f"DROP SCHEMA IF EXISTS {source.qualified} CASCADE")
            _seed_source(source)
            logger.info("Owned Snowflake schema=%s.%s", instance.database, schema)
            yield source
        finally:
            source._closed = True
