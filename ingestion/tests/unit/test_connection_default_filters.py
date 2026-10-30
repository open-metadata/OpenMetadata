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
"""Default connection filter patterns exclude engine system schemas, and nothing a user could own.

ADR:2026-10-30-database-connection-defaults-exclude-system-schemas
"""

import json
from pathlib import Path

import pytest

from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.utils.filters import filter_by_database, filter_by_schema

CONNECTIONS_DIR = (
    Path(__file__).resolve().parents[3]
    / "openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database"
)

FILTERS = {"database": filter_by_database, "schema": filter_by_schema}

# (connection, level, names the default must exclude, names it must keep)
CASES = [
    ("mariaDB", "schema", ["information_schema", "performance_schema"], ["sales"]),
    ("singleStore", "schema", ["information_schema"], ["sales"]),
    ("doris", "schema", ["__internal_schema", "information_schema"], ["mysql_app"]),
    ("greenplum", "database", ["template0", "template1"], ["postgres"]),
    ("greenplum", "schema", ["information_schema", "gp_toolkit"], ["public"]),
    ("cockroach", "database", ["system"], ["defaultdb", "postgres"]),
    ("cockroach", "schema", ["information_schema", "crdb_internal", "pg_extension"], ["public"]),
    ("azureSQL", "database", ["msdb", "model", "tempdb"], ["sales"]),
    ("azureSQL", "schema", ["db_owner", "guest", "sys", "INFORMATION_SCHEMA"], ["dbo"]),
    ("synapse", "database", ["tempdb"], ["sales"]),
    ("synapse", "schema", ["db_datareader", "sys"], ["dbo"]),
    ("clickhouse", "schema", ["system", "INFORMATION_SCHEMA", "information_schema"], ["default", "system_logs"]),
    ("trino", "database", ["system"], ["hive", "iceberg"]),
    ("trino", "schema", ["information_schema"], ["default"]),
    ("presto", "database", ["system"], ["hive"]),
    ("presto", "schema", ["information_schema"], ["default"]),
    # _SYS_BIC holds the calculation views that SAP HANA lineage resolves against
    ("sapHana", "schema", ["SYS", "_SYS_REPO", "_SYS_STATISTICS"], ["_SYS_BIC", "SYSTEM", "SYS_DATA"]),
    ("db2", "schema", ["SYSIBM", "SYSCAT", "SYSTOOLS", "NULLID", "SQLJ"], ["SYSTEM_DATA", "SYSAPP"]),
    ("teradata", "schema", ["DBC", "Sys_Calendar", "TD_SYSFNLIB", "TDStats"], ["DBC_COPY", "TD_SALES"]),
    ("exasol", "schema", ["SYS", "EXA_STATISTICS"], ["SYSTEM_X", "RETAIL"]),
    (
        "cassandra",
        "schema",
        ["system", "system_auth", "system_schema", "system_virtual_schema"],
        ["system_logs", "app"],
    ),
    ("mongoDB", "schema", ["admin", "local", "config"], ["configs", "app"]),
    ("couchbase", "schema", ["_system"], ["_default", "inventory"]),
    ("impala", "schema", ["_impala_builtins"], ["default"]),
    ("druid", "schema", ["INFORMATION_SCHEMA", "sys"], ["druid", "lookup"]),
    ("hive", "schema", ["sys", "information_schema"], ["default", "sys_logs"]),
]


def _default_filter(connection: str, level: str) -> FilterPattern:
    schema = json.loads((CONNECTIONS_DIR / f"{connection}Connection.json").read_text())
    return FilterPattern.model_validate(schema["properties"][f"{level}FilterPattern"]["default"])


@pytest.mark.parametrize(("connection", "level", "excluded", "kept"), CASES)
def test_default_filter_excludes_only_system_names(connection, level, excluded, kept):
    pattern = _default_filter(connection, level)
    is_filtered = FILTERS[level]

    assert [name for name in excluded if not is_filtered(pattern, name)] == []
    assert [name for name in kept if is_filtered(pattern, name)] == []
