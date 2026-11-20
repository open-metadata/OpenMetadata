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

"""Table binding selection remains independent of optional connector runtimes."""

import subprocess
import sys
import textwrap

import pytest

from metadata.entity_resolution.table_binding import TableBindingResolution, load_table_binding_resolution


def test_all_connector_resolvers_load_without_specs_or_connector_drivers():
    script = textwrap.dedent("""
        import importlib.abc
        import sys
        from pathlib import Path

        attempted = []
        drivers = (
            "google.cloud.bigquery", "google.cloud.bigquery_storage", "sqlalchemy_bigquery",
            "snowflake.connector", "clickhouse_connect", "clickhouse_sqlalchemy", "psycopg2",
            "pymysql", "pyodbc", "oracledb", "trino", "pyhive", "databricks.sql",
            "metadata.utils.service_spec.default",
            "metadata.ingestion.lineage.sql_lineage", "collate_sqllineage",
        )
        class NoDrivers(importlib.abc.MetaPathFinder):
            def find_spec(self, fullname, path=None, target=None):
                parts = fullname.split(".")
                source = (parts[:4] == ["metadata", "ingestion", "source", "database"]
                          and len(parts) == 6 and parts[-1] in ("metadata", "lineage", "usage", "connection", "service_spec"))
                if source or any(fullname == root or fullname.startswith(root + ".") for root in drivers):
                    attempted.append(fullname)
                    raise ModuleNotFoundError(fullname, name=fullname)

        from metadata.domain.table_reference import TableReference
        from metadata.generated.schema.entity.data.table import Table
        from metadata.entity_resolution.table_binding import TableBindingResolution, load_table_binding_resolution
        import metadata.ingestion.source.database

        # Shared SDK initialization precedes connector resolver selection.
        sys.meta_path.insert(0, NoDrivers())

        root = Path(next(iter(metadata.ingestion.source.database.__path__)))
        specs = sorted(root.glob("*/service_spec.py"))
        assert specs
        for path in specs:
            resolution = load_table_binding_resolution(path.parent.name, None)
            assert isinstance(resolution, TableBindingResolution)

        from uuid import uuid4
        family = Table(id=uuid4(), name="events_yyyymmdd",
            fullyQualifiedName="warehouse.demo_db.analytics.events_yyyymmdd", columns=[],
            tableType="Sharded", tableSharding={
                "prefix": "events_", "suffixFormat": "YYYYMMDD", "shardCount": 1,
                "firstShardDate": "2026-01-01", "lastShardDate": "2026-01-01",
                "representative": {"databaseName": "demo_db", "schemaName": "analytics",
                    "tableName": "events_20260101", "shardDate": "2026-01-01"}})
        from types import SimpleNamespace
        from metadata.generated.schema.entity.services.databaseService import DatabaseService
        from metadata.generated.schema.type.queryParserData import ParsedData
        class Catalog:
            def es_search_from_fqn(self, entity_type, **kwargs):
                assert entity_type is DatabaseService
                return [SimpleNamespace(serviceType=SimpleNamespace(value="BigQuery"))]
            def get_by_name(self, entity, fqn, **kwargs):
                return family if fqn == family.fullyQualifiedName.root else None
        resolution = load_table_binding_resolution("BigQuery", Catalog())
        assert resolution.resolve(TableReference("demo_db", "analytics", "events_20260101$20260101"),
                                  service_name="warehouse") == (family,)
        execution = ParsedData(tables=["demo_db.analytics.events_20260101"],
                               serviceName="warehouse", sql="select 1")
        assert resolution.prepare_usage(execution).tables == ["demo_db.analytics.events_yyyymmdd"]
        assert not attempted, attempted
        print(f"Selected {len(specs)} resolvers and resolved a physical reference with specs and drivers blocked")
    """)
    result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, timeout=60, check=False)
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.fixture
def connector_module(tmp_path, monkeypatch):
    import metadata.ingestion.source.database as database_package

    monkeypatch.setattr(database_package, "__path__", [str(tmp_path), *database_package.__path__])
    package = tmp_path / "test_binding"
    package.mkdir()
    (package / "__init__.py").write_text("")
    yield package / "resolution.py"
    sys.modules.pop("metadata.ingestion.source.database.test_binding.resolution", None)
    sys.modules.pop("metadata.ingestion.source.database.test_binding", None)


@pytest.mark.parametrize("source_type", [None, "Postgres", "not_installed"])
def test_absent_connector_resolution_uses_default(source_type):
    assert type(load_table_binding_resolution(source_type, None)) is TableBindingResolution


@pytest.mark.parametrize(
    "source, error, message",
    [
        ("import missing_binding_dependency", ModuleNotFoundError, "missing_binding_dependency"),
        ("raise AttributeError('module initialization failed')", AttributeError, "module initialization failed"),
        ("", AttributeError, "TableBindingResolution"),
        ("TableBindingResolution = object", TypeError, "must subclass"),
    ],
)
def test_broken_connector_resolution_is_reported(connector_module, source, error, message):
    connector_module.write_text(source)
    with pytest.raises(error, match=message):
        load_table_binding_resolution("test_binding", None)


@pytest.mark.parametrize("initializer", ["import missing_connector_driver", "raise RuntimeError('connector loaded')"])
def test_absent_resolver_does_not_initialize_connector(connector_module, initializer):
    (connector_module.parent / "__init__.py").write_text(initializer)
    assert type(load_table_binding_resolution("test_binding", None)) is TableBindingResolution
