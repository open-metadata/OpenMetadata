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
"""Snowflake-specific objects, plus routines and source tags read through the ACCOUNT_USAGE shim."""

import pytest

from metadata.generated.schema.entity.data.table import Constraint, DataType, TableType

from ..features.database.catalog.differ import catalog_matches
from ..features.database.catalog.types import ExpectedColumn, ExpectedTable
from ..features.database.entities import column
from ..features.database.pipelines import MetadataPipeline
from ..runtime import expect
from .checks import (
    has_tags,
    partition_query,
    procedures_have_bodies,
    schema_query,
    table_has_type,
    table_is_clustered_by,
)
from .expected import snowflake_expected, snowflake_schema


def _expected(snowflake, *, procedures=False, extra=()):
    database = snowflake.instance.database
    return snowflake_expected(
        snowflake.service_name,
        database,
        snowflake_schema(database, snowflake.source.schema, procedures=procedures, extra=extra),
    )


def _metadata(**options):
    return MetadataPipeline(includeDDL=True, includeStoredProcedures=False, **options)


@pytest.mark.e2e_contract("procedure.code")
def test_stored_procedures_and_udfs(cli, snowflake):
    """Routines are listed from ACCOUNT_USAGE, which a fresh schema reaches only hours later."""
    shim = snowflake.source.account_usage_shim()
    cli.run(snowflake.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True), account_usage=shim))

    def check(snapshot):
        catalog_matches(_expected(snowflake, procedures=True))(snapshot)
        procedures_have_bodies(snapshot)

    expect.poll(snowflake.catalog_query()).satisfies(check)


@pytest.mark.e2e_contract("tags.source")
def test_source_tags_on_schema_table_and_column(cli, snowflake, snowflake_tag):
    """A Snowflake tag holds one value per object, and a table without its own value inherits the schema's.

    Column tags stay direct: a table's tags stay on the table instead of being copied to every column.
    """
    qualified = snowflake.source.qualified
    tag = f"{qualified}.{snowflake_tag}"
    snowflake.source.run(f"ALTER SCHEMA {qualified} SET TAG {tag} = 'PUBLIC'")
    snowflake.source.run(f"ALTER TABLE {qualified}.customers SET TAG {tag} = 'PII'")
    snowflake.source.run(f"ALTER TABLE {qualified}.customers MODIFY COLUMN email SET TAG {tag} = 'PII'")
    shim = snowflake.source.account_usage_shim()
    cli.run(snowflake.invocation(_metadata(includeTags=True), account_usage=shim))
    pii, public = f"{snowflake_tag}.PII", f"{snowflake_tag}.PUBLIC"
    expect.poll(schema_query(snowflake.om, snowflake.schema_fqn())).satisfies(has_tags(public))

    def check(table):
        has_tags(pii)(table)
        has_tags(pii)(column(table, "EMAIL"))
        for name in ("ID", "STATUS"):
            has_tags()(column(table, name))

    expect.poll(snowflake.table_query("CUSTOMERS")).satisfies(check)
    expect.poll(snowflake.table_query("TRANSACTIONS")).satisfies(has_tags(public))


def _transient_events() -> ExpectedTable:
    return ExpectedTable(
        name="TRANSIENT_EVENTS",
        table_type=TableType.Transient,
        columns=[
            ExpectedColumn("ID", DataType.DECIMAL, constraint=Constraint.NOT_NULL),
            ExpectedColumn("LABEL", DataType.VARCHAR, constraint=Constraint.NULL),
        ],
    )


@pytest.mark.e2e_contract("table.transient.include")
def test_transient_tables_included(cli, snowflake, snowflake_transient_table):
    cli.run(snowflake.invocation(_metadata(), connection={"includeTransientTables": True}))
    expect.poll(snowflake.catalog_query()).satisfies(catalog_matches(_expected(snowflake, extra=[_transient_events()])))


@pytest.mark.e2e_contract("table.transient.exclude")
def test_transient_tables_excluded(cli, snowflake, snowflake_transient_table):
    """The complete inventory proves the transient table, and only it, was skipped."""
    rows = snowflake.source.run(
        f"SELECT IS_TRANSIENT FROM INFORMATION_SCHEMA.TABLES "
        f"WHERE TABLE_SCHEMA = '{snowflake.source.schema}' AND TABLE_NAME = '{snowflake_transient_table}'"
    )
    assert rows == [("YES",)]
    cli.run(snowflake.invocation(_metadata(), connection={"includeTransientTables": False}))
    expect.poll(snowflake.catalog_query()).satisfies(catalog_matches(_expected(snowflake)))


@pytest.mark.e2e_contract("table.dynamic")
def test_dynamic_table(cli, snowflake, snowflake_dynamic_table):
    cli.run(snowflake.invocation(_metadata()))
    dynamic = ExpectedTable(
        name=snowflake_dynamic_table,
        table_type=TableType.Dynamic,
        columns=[ExpectedColumn("ID", DataType.DECIMAL), ExpectedColumn("FULL_NAME", DataType.VARCHAR)],
    )
    expect.poll(snowflake.catalog_query()).satisfies(catalog_matches(_expected(snowflake, extra=[dynamic])))


@pytest.mark.e2e_contract("table.stream")
def test_stream(cli, snowflake, snowflake_stream):
    cli.run(snowflake.invocation(_metadata(), connection={"includeStreams": True}))
    expect.poll(snowflake.table_query(snowflake_stream)).satisfies(table_has_type(TableType.Stream))


@pytest.mark.e2e_contract("partition.cluster-key")
def test_cluster_key_partition(cli, snowflake, snowflake_clustered_table):
    cli.run(snowflake.invocation(_metadata()))
    expect.poll(partition_query(snowflake.om, snowflake.table_fqn(snowflake_clustered_table))).satisfies(
        table_is_clustered_by("CATEGORY", "CREATED_DATE")
    )
