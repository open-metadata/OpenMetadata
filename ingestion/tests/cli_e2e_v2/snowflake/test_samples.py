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
"""Strict native Snowflake samples, sample bounds and persisted sample replacement."""

import pytest

from metadata.generated.schema.entity.data.table import TableProfilerConfig

from ..features.database.entities import entity_exists
from ..features.database.pipelines import AutoClassificationPipeline, MetadataPipeline
from ..features.database.samples import sample_query
from ..runtime import expect
from .checks import native_sample_rows, native_samples_match, sample_row_count


def _only(table):
    return {"tableFilterPattern": {"includes": [f"^{table}$"]}}


def _metadata():
    return MetadataPipeline(includeStoredProcedures=False)


def _sampling(count):
    return AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=count)


@pytest.mark.e2e_contract("sample.values.native")
def test_persisted_native_sample_values(cli, snowflake):
    filters = _only("ALL_TYPES")
    cli.run(snowflake.invocation(_metadata(), filters=filters))
    table = expect.poll(snowflake.table_query("ALL_TYPES")).satisfies(entity_exists)
    cli.run(snowflake.invocation(_sampling(10), filters=filters))
    expect.poll(sample_query(snowflake.om, table)).satisfies(native_samples_match)


@pytest.mark.e2e_contract("sample.limit")
def test_sample_is_bounded_by_sample_data_count(cli, snowflake, snowflake_sample_table):
    """A 1000-row table must persist exactly sampleDataCount rows."""
    filters = _only(snowflake_sample_table)
    cli.run(snowflake.invocation(_metadata(), filters=filters))
    table = expect.poll(snowflake.table_query(snowflake_sample_table)).satisfies(entity_exists)
    cli.run(snowflake.invocation(_sampling(50), filters=filters))
    expect.poll(sample_query(snowflake.om, table)).satisfies(sample_row_count(50))


@pytest.mark.e2e_contract("sample.values.replacement")
def test_reingest_replaces_persisted_samples(cli, snowflake):
    filters = _only("ALL_TYPES")
    cli.run(snowflake.invocation(_metadata(), filters=filters))
    table = expect.poll(snowflake.table_query("ALL_TYPES")).satisfies(entity_exists)
    invocation = snowflake.invocation(_sampling(10), filters=filters)
    query = sample_query(snowflake.om, table)

    def values_match(sampled, expected):
        assert sampled is not None, "sample data missing"
        assert sampled.id == table.id, "samples belong to a different table"
        actual = {key: row["INT_COL"] for key, row in native_sample_rows(sampled).items()}
        assert actual == expected, f"INT_COL samples: expected {expected!r}, got {actual!r}"

    cli.run(invocation)
    before = expect.poll(query).satisfies(lambda sampled: values_match(sampled, {1: 123456, 2: None, 3: None}))
    snowflake.source.set_value("ALL_TYPES", 1, "INT_COL", 654321)
    cli.run(invocation)
    after = expect.poll(query).satisfies(lambda sampled: values_match(sampled, {1: 654321, 2: None, 3: None}))
    assert after.id == before.id


@pytest.mark.e2e_contract("sample.values.query")
def test_profile_query_samples_keep_native_values(cli, snowflake):
    """A table's profile query samples raw driver cells, which must persist like a regular sample.

    The query leaves out row 3, so a sample that ignored it would not match.
    """
    filters = _only("ALL_TYPES")
    cli.run(snowflake.invocation(_metadata(), filters=filters))
    table = expect.poll(snowflake.table_query("ALL_TYPES")).satisfies(entity_exists)
    snowflake.om.create_or_update_table_profiler_config(
        snowflake.table_fqn("ALL_TYPES"),
        TableProfilerConfig(profileQuery=f"SELECT * FROM {snowflake.source.qualified}.all_types WHERE id <> 3"),
    )
    cli.run(snowflake.invocation(_sampling(10), filters=filters))

    def queried_rows_match(sampled):
        native_samples_match(sampled, ids={1, 2})

    expect.poll(sample_query(snowflake.om, table)).satisfies(queried_rows_match)
