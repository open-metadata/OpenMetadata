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

"""
Tests for RandomNumFn function
"""

import pytest
from sqlalchemy import create_mock_engine

from metadata.profiler.orm.functions.random_num import RandomNumFn
from metadata.profiler.orm.registry import Dialects

DIALECT_URL_MAP = {
    Dialects.PinotDB: "pinot://localhost:8099/test",
    Dialects.MySQL: "mysql://localhost/test",
    Dialects.Postgres: "postgresql://localhost/test",
    Dialects.BigQuery: "bigquery://test-project/test-dataset",
    Dialects.SQLite: "sqlite:///:memory:",
    Dialects.MSSQL: "mssql+pyodbc://localhost/test",
    Dialects.Oracle: "oracle://localhost/test",
    Dialects.Snowflake: "snowflake://user:pass@account/db/schema",
    Dialects.ClickHouse: "clickhouse://localhost/test",
    Dialects.Vertica: "vertica+vertica_python://localhost/test",
    Dialects.Hive: "hive://localhost:10000/default",
    Dialects.Impala: "impala://localhost/default",
    Dialects.Db2: "db2+ibm_db://localhost/test",
    Dialects.IbmDbSa: "ibm_db_sa://localhost/test",
    Dialects.Ibmi: "ibmi://localhost/test",
    Dialects.Hana: "hana://localhost/test",
    Dialects.Teradata: "teradatasql://localhost/test",
    Dialects.Cockroach: "cockroachdb://localhost/test",
    Dialects.MariaDB: "mariadb://localhost/test",
}


def compile_random_fn_for_dialect(dialect_name: str) -> str:
    """
    Helper function to compile RandomNumFn for a given dialect.
    Creates an engine with the appropriate URL for the dialect.
    """
    url = DIALECT_URL_MAP.get(dialect_name, "sqlite:///:memory:")
    engine = create_mock_engine(url, lambda sql, *args, **kwargs: ...)
    random_fn = RandomNumFn()
    compiled = random_fn.compile(engine)
    return str(compiled)


@pytest.mark.parametrize(
    "dialect_name,expected_sql",
    [
        (Dialects.PinotDB, "0"),
        (Dialects.MySQL, "ABS(RAND()) * 100"),
        (Dialects.Postgres, "ABS((RANDOM() * 100)::INTEGER)"),
        (Dialects.BigQuery, "CAST(100*RAND() AS INT64)"),
        (Dialects.SQLite, "ABS(RANDOM()) % 100"),
        (Dialects.MSSQL, "ABS(CHECKSUM(NewId()))"),
        (Dialects.Oracle, "ABS(DBMS_RANDOM.VALUE) * 100"),
        (Dialects.Snowflake, "0"),
        (Dialects.ClickHouse, "toInt8(RAND(10)/4294967295*100)"),
        (Dialects.Vertica, "(RANDOM() * 100)::INTEGER"),
        (Dialects.Hive, "ABS(RAND()) * 100"),
        (Dialects.Impala, "ABS(RAND()) * 100"),
        (Dialects.Db2, "ABS(RAND()) * 100"),
        (Dialects.IbmDbSa, "ABS(RAND()) * 100"),
        (Dialects.Ibmi, "ABS(RANDOM()) * 100"),
        (Dialects.Hana, "ABS(RAND()) * 100"),
        (Dialects.Teradata, "0"),
        (Dialects.Cockroach, "ABS((RANDOM() * 100)::INTEGER)"),
        (Dialects.MariaDB, "ABS(RANDOM()) * 100"),
    ],
    ids=[
        "pinot",
        "mysql",
        "postgres",
        "bigquery",
        "sqlite",
        "mssql",
        "oracle",
        "snowflake",
        "clickhouse",
        "vertica",
        "hive",
        "impala",
        "db2",
        "ibm_db_sa",
        "ibmi",
        "hana",
        "teradata",
        "cockroach",
        "default",
    ],
)
def test_random_num_fn_dialects(dialect_name, expected_sql):
    """Parameterized test for RandomNumFn across multiple dialects"""
    result = compile_random_fn_for_dialect(dialect_name)
    assert result == expected_sql
