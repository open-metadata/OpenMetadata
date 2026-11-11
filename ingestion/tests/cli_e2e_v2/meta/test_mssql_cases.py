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
"""Offline MSSQL ownership gates, partition seeding and independently declared catalog scope."""

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import URL

from metadata.generated.schema.entity.data.table import DataType, TableType

from ..features.database.pipelines import LineagePipeline, MetadataPipeline
from ..mssql.baseline import (
    NATIVE_TABLE,
    NATIVE_VIEW,
    PARTITION_INTERVAL_YEARS,
    PARTITION_YEARS_INSIDE,
    PARTITION_YEARS_OUTSIDE,
    PARTITIONED_TABLE,
    build_mssql_baseline,
    person_birthdates,
)
from ..mssql.connector import mssql_invocation
from ..mssql.expected import mssql_expected
from ..mssql.source import INGEST_USER_OPTION, MssqlSource
from ..server import ServerConfig

_REFERENCE_DATE = date(2026, 3, 15)
_SCHEMA = "e2emssqlowned"
_DATABASE = "e2emssqldb"


@pytest.fixture
def owned_source(monkeypatch):
    engine = create_engine(
        URL.create("mssql+pytds", username="SA", password="admin", host="127.0.0.1", port=1433, database=_DATABASE)
    )
    engine.update_execution_options(**{INGEST_USER_OPTION: "fixture_reader"})
    monkeypatch.setenv("E2E_MSSQL_USER", "fixture_reader")
    monkeypatch.setenv("E2E_MSSQL_PASSWORD", "fixture_password")
    monkeypatch.setenv("E2E_MSSQL_HOST_PORT", "127.0.0.1:1433")
    monkeypatch.setenv("E2E_MSSQL_DATABASE", _DATABASE)
    monkeypatch.setenv("OM_SERVER_URL", "http://127.0.0.1:1/api")
    monkeypatch.setenv("OM_JWT_TOKEN", "synthetic-token")
    yield MssqlSource(
        schema=_SCHEMA,
        database=_DATABASE,
        baseline=build_mssql_baseline(_SCHEMA, reference_date=_REFERENCE_DATE),
        reference_date=_REFERENCE_DATE,
        admin_engine=engine,
    )
    engine.dispose()


def _invocation(source, options=None, filters=None, sources=None):
    return mssql_invocation(
        service_name="fixture_service",
        sources=(source,) if sources is None else sources,
        options=MetadataPipeline() if options is None else options,
        filters={} if filters is None else filters,
        server=ServerConfig("http://127.0.0.1:1/api", "synthetic-token", "env"),
    )


@pytest.mark.parametrize(
    "options",
    [MetadataPipeline(), LineagePipeline(processQueryLineage=False, processStoredProcedureLineage=False)],
)
def test_every_invocation_scopes_to_exact_owned_schema(owned_source, options):
    invocation = _invocation(owned_source, options)
    config = invocation.config["source"]
    assert config["sourceConfig"]["config"]["schemaFilterPattern"]["includes"] == [f"^{_SCHEMA}$"]
    assert config["serviceConnection"]["config"]["database"] == "${E2E_MSSQL_DATABASE}"
    assert config["serviceConnection"]["config"]["password"] == "${E2E_MSSQL_PASSWORD}"
    assert config["serviceConnection"]["config"]["scheme"] == "mssql+pytds"
    assert "fixture_password" not in str(invocation.config)


@pytest.mark.parametrize(
    "filters",
    [
        {"schemaFilterPattern": {"includes": ["dbo"]}},
        {"schemaFilterPattern": {"includes": [".*"]}},
        {"schemaFilterPattern": {"includes": []}},
        {"schemaFilterPattern": {"excludes": ["dbo"]}},
        {"databaseFilterPattern": {"includes": [".*"]}},
    ],
)
def test_invocation_rejects_unowned_scopes(owned_source, filters):
    with pytest.raises(ValueError):
        _invocation(owned_source, filters=filters)


def test_invocation_rejects_closed_and_mismatched_sources(owned_source, monkeypatch):
    with pytest.raises(ValueError, match="nonempty tuple"):
        _invocation(owned_source, sources=())
    with monkeypatch.context() as mismatch:
        mismatch.setenv("E2E_MSSQL_HOST_PORT", "127.0.0.1:1")
        with pytest.raises(ValueError, match="fixture instance"):
            _invocation(owned_source)
    owned_source._closed = True
    with pytest.raises(ValueError, match="already been closed"):
        _invocation(owned_source)


def test_expected_catalog_declares_the_native_types_and_the_view():
    expected = mssql_expected("fixture_service", database=_DATABASE, schema=_SCHEMA, reference_date=_REFERENCE_DATE)
    assert expected.databases[0].name == _DATABASE
    schema = expected.databases[0].schemas[0]
    assert {table.name for table in schema.tables} == {
        "customers",
        "transactions",
        NATIVE_TABLE,
        PARTITIONED_TABLE,
        NATIVE_VIEW,
    }
    assert {procedure.name for procedure in schema.stored_procedures} == {"usp_active_customer_count"}
    native = next(table for table in schema.tables if table.name == NATIVE_TABLE)
    view = next(table for table in schema.tables if table.name == NATIVE_VIEW)
    assert view.table_type is TableType.View
    assert [column.name for column in view.columns] == [column.name for column in native.columns]
    types = {column.name: column.data_type for column in native.columns}
    assert types["rowversion_col"] is DataType.TIMESTAMP
    assert types["uniqueidentifier_col"] is DataType.UUID
    assert types["bit_col"] is DataType.BIT
    assert types["smallmoney_col"] is DataType.NUMBER


def test_partition_seeds_straddle_the_configured_window():
    inside, outside = person_birthdates(_REFERENCE_DATE)
    boundary = date(_REFERENCE_DATE.year - PARTITION_INTERVAL_YEARS, _REFERENCE_DATE.month, _REFERENCE_DATE.day)
    assert len(inside) == len(PARTITION_YEARS_INSIDE)
    assert len(outside) == len(PARTITION_YEARS_OUTSIDE)
    assert all(birthdate > boundary for birthdate in inside)
    assert all(birthdate < boundary for birthdate in outside)


def test_partition_seeds_follow_the_run_date():
    """v1's fixed birthdates drift out of the window as the years pass; these do not."""
    later = date(_REFERENCE_DATE.year + 5, _REFERENCE_DATE.month, _REFERENCE_DATE.day)
    inside_now, _ = person_birthdates(_REFERENCE_DATE)
    inside_later, _ = person_birthdates(later)
    assert inside_now != inside_later
    boundary = date(later.year - PARTITION_INTERVAL_YEARS, later.month, later.day)
    assert all(birthdate > boundary for birthdate in inside_later)


def test_baseline_names_avoid_the_connector_default_filters():
    """The connector's defaults exclude these schema, database and procedure patterns."""
    baseline = build_mssql_baseline(_SCHEMA, reference_date=_REFERENCE_DATE)
    assert not _SCHEMA.startswith(("db_", "guest", "sys", "information_schema"))
    assert _DATABASE not in {"msdb", "model", "tempdb"}
    procedures = [statement for statement in baseline.ddl if "CREATE PROCEDURE" in statement]
    assert procedures
    assert all(prefix not in statement for statement in procedures for prefix in (".sp_", ".xp_", ".ms_"))
