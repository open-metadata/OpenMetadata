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
"""Offline Exasol ownership gates and the usage workflow shape."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import URL

from metadata.generated.schema.metadataIngestion.workflow import OpenMetadataWorkflowConfig

from ..exasol.baseline import NATIVE_COLUMN_NAMES, NATIVE_ROWS, build_exasol_baseline
from ..exasol.connector import exasol_invocation, exasol_usage_invocation
from ..exasol.source import INGEST_USER_OPTION, ExasolSource
from ..features.database.pipelines import LineagePipeline, MetadataPipeline
from ..server import ServerConfig

_SCHEMA = "e2eexaowned"
_SERVER = ServerConfig("http://127.0.0.1:1/api", "synthetic-token", "env")


@pytest.fixture
def owned_source(monkeypatch):
    engine = create_engine(URL.create("exa+websocket", username="sys", password="exasol", host="127.0.0.1", port=8563))
    engine.update_execution_options(**{INGEST_USER_OPTION: "fixture_reader"})
    monkeypatch.setenv("E2E_EXASOL_USER", "fixture_reader")
    monkeypatch.setenv("E2E_EXASOL_PASSWORD", "fixture_password")
    monkeypatch.setenv("E2E_EXASOL_HOST_PORT", "127.0.0.1:8563")
    monkeypatch.setenv("OM_SERVER_URL", "http://127.0.0.1:1/api")
    monkeypatch.setenv("OM_JWT_TOKEN", "synthetic-token")
    yield ExasolSource(schema=_SCHEMA, baseline=build_exasol_baseline(_SCHEMA), admin_engine=engine)
    engine.dispose()


def _invocation(source, options=None, filters=None, sources=None):
    return exasol_invocation(
        service_name="fixture_service",
        sources=(source,) if sources is None else sources,
        options=MetadataPipeline() if options is None else options,
        filters={} if filters is None else filters,
        server=_SERVER,
    )


@pytest.mark.parametrize(
    "options",
    [MetadataPipeline(), LineagePipeline(processQueryLineage=False, processStoredProcedureLineage=False)],
)
def test_every_invocation_scopes_to_exact_owned_schema(owned_source, options):
    invocation = _invocation(owned_source, options)
    config = invocation.config["source"]
    assert config["sourceConfig"]["config"]["schemaFilterPattern"]["includes"] == [f"^{_SCHEMA}$"]
    connection = config["serviceConnection"]["config"]
    assert connection["password"] == "${E2E_EXASOL_PASSWORD}"
    assert connection["tls"] == "ignore-certificate"
    assert "fixture_password" not in str(invocation.config)


@pytest.mark.parametrize(
    "filters",
    [
        {"schemaFilterPattern": {"includes": ["sys"]}},
        {"schemaFilterPattern": {"includes": [".*"]}},
        {"schemaFilterPattern": {"includes": []}},
        {"schemaFilterPattern": {"excludes": ["sys"]}},
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
        mismatch.setenv("E2E_EXASOL_HOST_PORT", "127.0.0.1:1")
        with pytest.raises(ValueError, match="fixture instance"):
            _invocation(owned_source)
    owned_source._closed = True
    with pytest.raises(ValueError, match="already been closed"):
        _invocation(owned_source)
    with pytest.raises(ValueError, match="already been closed"):
        exasol_usage_invocation(service_name="s", source=owned_source, staging_dir="/tmp/x", server=_SERVER)


def test_usage_invocation_is_a_valid_workflow_scoped_to_the_owned_schema(owned_source, tmp_path):
    invocation = exasol_usage_invocation(
        service_name="fixture_service", source=owned_source, staging_dir=tmp_path, server=_SERVER
    )
    assert invocation.subcommand == "usage"
    config = invocation.config
    assert config["source"]["type"] == "exasol-usage"
    assert config["stage"]["config"]["filename"] == config["bulkSink"]["config"]["filename"] == str(tmp_path)
    condition = config["source"]["sourceConfig"]["config"]["filterCondition"]
    assert f"'{_SCHEMA}.'" in condition
    # The connector formats its statement with the condition and hands it to the
    # driver; a LIKE wildcard would need paramstyle escaping the condition cannot carry.
    assert "%" not in condition
    assert "fixture_password" not in str(config)
    OpenMetadataWorkflowConfig.model_validate(
        {
            **config,
            "source": {
                **config["source"],
                "serviceConnection": {
                    "config": {**config["source"]["serviceConnection"]["config"], "hostPort": "127.0.0.1:8563"}
                },
            },
        }
    )


def test_usage_invocation_rejects_a_schema_it_could_not_scope_safely(owned_source, tmp_path):
    owned_source.schema = "e2eexa'; drop"
    with pytest.raises(ValueError, match="lower-case identifiers"):
        exasol_usage_invocation(service_name="s", source=owned_source, staging_dir=tmp_path, server=_SERVER)


def test_native_rows_seed_every_declared_column():
    baseline = build_exasol_baseline(_SCHEMA)
    declared = [column.name for column in baseline.metadata.tables[f"{_SCHEMA}.datatypes"].columns]
    assert tuple(declared) == NATIVE_COLUMN_NAMES
    assert all(set(row) == set(declared) for row in NATIVE_ROWS)
    # Hand-written DDL leaves the schema unquoted so Exasol folds it like CREATE SCHEMA does.
    assert all(f'"{_SCHEMA}"' not in statement for statement in baseline.ddl)
