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
"""Live Snowflake schema isolation, owned cleanup, helper scoping and shim fidelity (no OpenMetadata server)."""

import pytest
from sqlalchemy import text

from metadata.ingestion.source.database.snowflake.identifiers import quote_account_usage_schema
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_ACCESS_HISTORY_PROBE,
    SNOWFLAKE_FETCH_SCHEMA_TAGS,
    SNOWFLAKE_FETCH_TABLE_TAGS,
    SNOWFLAKE_GET_STORED_PROCEDURES_AND_FUNCTIONS,
    SNOWFLAKE_LIFE_CYCLE_QUERY,
    SNOWFLAKE_QUERY_LOG_QUERY,
    SNOWFLAKE_TEST_FETCH_TAG,
    SNOWFLAKE_TEST_GET_QUERIES,
)

from . import source as source_module
from .source import SCHEMA_COMMENT, fresh_snowflake_source


def _count(source, table):
    return source.run(f"SELECT COUNT(*) FROM {source.qualified}.{table}")[0][0]


def _schema_exists(instance, schema):
    with instance.admin_engine.connect() as connection:
        count = connection.execute(
            text("SELECT COUNT(*) FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = :schema"), {"schema": schema}
        ).scalar_one()
    return count == 1


def test_sources_isolate_mutations_and_cleanup(snowflake_instance):
    with fresh_snowflake_source(snowflake_instance) as source_b:
        with fresh_snowflake_source(snowflake_instance) as source_a:
            assert source_a.schema != source_b.schema
            assert source_a.run(
                "SELECT COMMENT, RETENTION_TIME FROM INFORMATION_SCHEMA.SCHEMATA "
                f"WHERE SCHEMA_NAME = '{source_a.schema}'"
            ) == [(SCHEMA_COMMENT, 0)]
            source_a.set_value("CUSTOMERS", 1, "CREDIT_SCORE", 999)
            source_a.drop_table("ALL_TYPES")
            assert source_a.run(f"SELECT credit_score FROM {source_a.qualified}.customers WHERE id = 1") == [(999,)]
            with pytest.raises(KeyError):
                source_a.drop_table(f"{source_b.schema}.all_types")
            with pytest.raises(KeyError):
                source_a.set_value("CUSTOMERS", 1, "NOT_A_COLUMN", 1)
            with pytest.raises(ValueError, match="Expected one"):
                source_a.set_value("CUSTOMERS", 999, "CREDIT_SCORE", 1)
            assert _count(source_b, "all_types") == 3
            assert source_b.run(f"SELECT credit_score FROM {source_b.qualified}.customers WHERE id = 1") == [(720,)]
        assert not _schema_exists(snowflake_instance, source_a.schema)
        with pytest.raises(ValueError, match="already been closed"):
            source_a.run("SELECT 1")
        assert _count(source_b, "customers") == 5
    assert not _schema_exists(snowflake_instance, source_b.schema)


def test_seed_failure_removes_schema(snowflake_instance, monkeypatch):
    allocated = []
    seed = source_module._seed_source

    def fail_after_seed(source):
        allocated.append(source.schema)
        seed(source)
        raise RuntimeError("injected seed failure")

    monkeypatch.setattr(source_module, "_seed_source", fail_after_seed)
    with (
        pytest.raises(RuntimeError, match="injected seed failure"),
        fresh_snowflake_source(snowflake_instance),
    ):
        pytest.fail("Setup should not yield")
    assert len(allocated) == 1
    assert not _schema_exists(snowflake_instance, allocated[0])


def test_declared_constraints_are_visible_to_snowflake(snowflake_source):
    """The FK scenario is meaningless unless Snowflake itself reports the informational keys."""
    rows = snowflake_source.run(
        "SELECT TABLE_NAME, CONSTRAINT_TYPE FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS "
        f"WHERE TABLE_SCHEMA = '{snowflake_source.schema}'"
    )
    assert set(rows) == {
        ("ALL_TYPES", "PRIMARY KEY"),
        ("CUSTOMERS", "PRIMARY KEY"),
        ("TRANSACTIONS", "FOREIGN KEY"),
        ("TRANSACTIONS", "PRIMARY KEY"),
    }


def _mappings(result):
    """Result keys case-folded, since the dialect may normalize Snowflake's upper-case column names."""
    return [{key.lower(): value for key, value in row._mapping.items()} for row in result]


def test_account_usage_shim_serves_the_connector_queries_in_real_time(snowflake_instance):
    """Each ACCOUNT_USAGE query the connector issues must run against the shim and see fresh objects."""
    with fresh_snowflake_source(snowflake_instance) as source:
        qualified, database, schema = source.qualified, source.database, source.schema
        source.run(f"CREATE TAG {qualified}.E2E_SHIM_TAG ALLOWED_VALUES 'PII', 'PUBLIC'")
        source.run(f"ALTER SCHEMA {qualified} SET TAG {qualified}.E2E_SHIM_TAG = 'PUBLIC'")
        source.run(f"ALTER TABLE {qualified}.customers SET TAG {qualified}.E2E_SHIM_TAG = 'PII'")
        shim = source.account_usage_shim()
        update = source.dml(f"UPDATE {qualified}.customers SET credit_score = 701 WHERE id = 1")
        shim.record(update)
        shim.wait_for_queries([update.query_id])
        account_usage = quote_account_usage_schema(shim.name)

        with snowflake_instance.admin_engine.connect() as connection:
            routines = _mappings(
                connection.execute(
                    text(
                        SNOWFLAKE_GET_STORED_PROCEDURES_AND_FUNCTIONS.format(
                            account_usage=account_usage, database_name=database, schema_name=schema
                        )
                    )
                )
            )
            table_tags = _mappings(
                connection.execute(
                    text(SNOWFLAKE_FETCH_TABLE_TAGS.format(account_usage=account_usage)),
                    {"database_name": database, "schema_name": schema},
                )
            )
            schema_tags = _mappings(
                connection.execute(
                    text(SNOWFLAKE_FETCH_SCHEMA_TAGS.format(account_usage=account_usage)), {"database_name": database}
                )
            )
            history = _mappings(
                connection.execute(
                    text(
                        SNOWFLAKE_QUERY_LOG_QUERY.format(
                            account_usage_schema=account_usage,
                            tablename="CUSTOMERS",
                            insert="INSERT",
                            update="UPDATE",
                            delete="DELETE",
                            merge="MERGE",
                        )
                    )
                )
            )
            for probe in (SNOWFLAKE_TEST_FETCH_TAG, SNOWFLAKE_TEST_GET_QUERIES, SNOWFLAKE_ACCESS_HISTORY_PROBE):
                connection.execute(text(probe.format(account_usage=account_usage))).all()
            connection.execute(
                text(
                    SNOWFLAKE_LIFE_CYCLE_QUERY.format(
                        account_usage=account_usage, schema_name=schema, database_name=database
                    )
                )
            ).all()

        assert {(row["name"], row["procedure_type"]) for row in routines} == {
            ("SP_ACTIVE_CUSTOMER_COUNT", "StoredProcedure"),
            ("FN_CONVERT_AMOUNT", "UDF"),
        }
        # Table level only, because the column references Snowflake reports as inherited must not be listed.
        assert [(row["tag_name"], row["tag_value"], row["object_name"], row["column_name"]) for row in table_tags] == [
            ("E2E_SHIM_TAG", "PII", "CUSTOMERS", None)
        ]
        assert [(row["tag_name"], row["tag_value"]) for row in schema_tags if row["schema_name"] == schema] == [
            ("E2E_SHIM_TAG", "PUBLIC")
        ]
        counts = {row["query_id"]: (row["rows_inserted"], row["rows_updated"], row["rows_deleted"]) for row in history}
        assert counts[update.query_id] == (0, 1, 0)
        assert _schema_exists(snowflake_instance, shim.schema)
    assert not _schema_exists(snowflake_instance, shim.schema)
