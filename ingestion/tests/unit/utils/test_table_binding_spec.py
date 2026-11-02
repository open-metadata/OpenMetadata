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


def test_all_database_specs_and_resolution_load_without_connector_drivers():
    script = textwrap.dedent("""
        import importlib.abc
        import sys
        from pathlib import Path

        attempted = []
        drivers = (
            "google.cloud.bigquery", "google.cloud.bigquery_storage", "sqlalchemy_bigquery",
            "snowflake.connector", "clickhouse_connect", "clickhouse_sqlalchemy", "psycopg2",
            "pymysql", "pyodbc", "oracledb", "trino", "pyhive", "databricks.sql",
        )
        class NoDrivers(importlib.abc.MetaPathFinder):
            def find_spec(self, fullname, path=None, target=None):
                parts = fullname.split(".")
                source = (parts[:4] == ["metadata", "ingestion", "source", "database"]
                          and len(parts) == 6 and parts[-1] in ("metadata", "lineage", "usage", "connection"))
                if source or any(fullname == root or fullname.startswith(root + ".") for root in drivers):
                    attempted.append(fullname)
                    raise ModuleNotFoundError(fullname, name=fullname)
        sys.meta_path.insert(0, NoDrivers())

        from metadata.generated.schema.entity.services.serviceType import ServiceType
        from metadata.domain.table_reference import TableReference
        from metadata.generated.schema.entity.data.table import Table
        from metadata.entity_resolution.table_binding import TableBindingResolution
        from metadata.utils.service_spec.service_spec import BaseSpec, load_table_binding_resolution
        import metadata.ingestion.source.database

        root = Path(next(iter(metadata.ingestion.source.database.__path__)))
        specs = sorted(root.glob("*/service_spec.py"))
        assert specs
        for path in specs:
            spec = BaseSpec.get_for_source(ServiceType.Database, path.parent.name)
            assert spec.metadata_source_class
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
        class Catalog:
            def get_by_name(self, entity, fqn, **kwargs):
                return family if fqn == family.fullyQualifiedName.root else None
        resolution = load_table_binding_resolution("BigQuery", Catalog())
        assert resolution.resolve(TableReference("demo_db", "analytics", "events_20260101$20260101"),
                                  service_name="warehouse") == (family,)
        assert not attempted, attempted
        print(f"Loaded {len(specs)} specs and resolved a physical reference with drivers blocked")
    """)
    result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, timeout=60, check=False)
    assert result.returncode == 0, result.stdout + result.stderr
