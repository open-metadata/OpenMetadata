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
"""Offline Postgres ownership gates and independently declared catalog scope."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import URL

from metadata.generated.schema.entity.data.table import DataType, TableType

from ..features.database.pipelines import LineagePipeline, MetadataPipeline
from ..postgres.baseline import build_postgres_baseline
from ..postgres.connector import postgres_invocation
from ..postgres.expected import postgres_expected
from ..postgres.source import PostgresSource
from ..server import ServerConfig


@pytest.fixture
def owned_source(monkeypatch):
    engine = create_engine(
        URL.create(
            "postgresql+psycopg2", username="postgres", password="admin", host="127.0.0.1", port=5432, database="e2e"
        )
    )
    engine.update_execution_options(e2e_postgres_ingest_user="fixture_reader")
    monkeypatch.setenv("E2E_POSTGRES_USER", "fixture_reader")
    monkeypatch.setenv("E2E_POSTGRES_PASSWORD", "fixture_password")
    monkeypatch.setenv("E2E_POSTGRES_HOST_PORT", "127.0.0.1:5432")
    monkeypatch.setenv("E2E_POSTGRES_DATABASE", "e2e")
    monkeypatch.setenv("OM_SERVER_URL", "http://127.0.0.1:1/api")
    monkeypatch.setenv("OM_JWT_TOKEN", "synthetic-token")
    yield PostgresSource("e2epgowned", "e2e", build_postgres_baseline("e2epgowned"), engine)
    engine.dispose()


def _invocation(source, options=None, filters=None, sources=None):
    return postgres_invocation(
        service_name="fixture_service",
        sources=(source,) if sources is None else sources,
        options=MetadataPipeline() if options is None else options,
        filters={} if filters is None else filters,
        server=ServerConfig("http://127.0.0.1:1/api", "synthetic-token", "env"),
    )


@pytest.mark.parametrize("options", [MetadataPipeline(), LineagePipeline(processQueryLineage=False)])
def test_every_invocation_scopes_to_exact_owned_schema(owned_source, options):
    invocation = _invocation(owned_source, options)
    config = invocation.config["source"]
    assert config["sourceConfig"]["config"]["schemaFilterPattern"]["includes"] == ["^e2epgowned$"]
    assert config["serviceConnection"]["config"]["database"] == "${E2E_POSTGRES_DATABASE}"
    assert config["serviceConnection"]["config"]["authType"]["password"] == "${E2E_POSTGRES_PASSWORD}"
    assert "fixture_password" not in str(invocation.config)


@pytest.mark.parametrize(
    "filters",
    [
        {"schemaFilterPattern": {"includes": ["public"]}},
        {"schemaFilterPattern": {"includes": [".*"]}},
        {"schemaFilterPattern": {"includes": []}},
        {"schemaFilterPattern": {"excludes": ["public"]}},
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
        mismatch.setenv("E2E_POSTGRES_HOST_PORT", "127.0.0.1:1")
        with pytest.raises(ValueError, match="fixture instance"):
            _invocation(owned_source)
    owned_source._closed = True
    with pytest.raises(ValueError, match="already been closed"):
        _invocation(owned_source)


def test_expected_catalog_contains_all_22_native_view_columns():
    expected = postgres_expected("fixture_service", database="e2e", schema="e2epgowned")
    assert expected.databases[0].name == "e2e"
    schema = expected.databases[0].schemas[0]
    assert {table.name for table in schema.tables} == {
        "customers",
        "transactions",
        "all_datatypes",
        "view_all_datatypes",
    }
    view = next(table for table in schema.tables if table.name == "view_all_datatypes")
    assert view.table_type is TableType.View
    assert len(view.columns) == 22
    assert {column.name: column.data_type for column in view.columns}["column13"] is DataType.JSON
