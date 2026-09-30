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
"""Strict native BigQuery samples, sample bounds and persisted sample replacement."""

import pytest

from ..features.database.entities import entity_exists
from ..features.database.pipelines import AutoClassificationPipeline, MetadataPipeline
from ..features.database.samples import sample_query
from ..runtime import expect
from .checks import native_sample_rows, native_samples_match, sample_row_count


def _only(table):
    return {"tableFilterPattern": {"includes": [f"^{table}$"]}}


def _sampling(count):
    return AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=count)


@pytest.mark.e2e_contract("sample.values.native")
def test_persisted_native_sample_values(cli, bigquery):
    filters = _only("all_types")
    cli.run(bigquery.invocation(MetadataPipeline(includeStoredProcedures=False), filters=filters))
    table = expect.poll(bigquery.table_query("all_types")).satisfies(entity_exists)
    cli.run(bigquery.invocation(_sampling(10), filters=filters))
    expect.poll(sample_query(bigquery.om, table)).satisfies(native_samples_match)


@pytest.mark.e2e_contract("sample.limit")
def test_sample_is_bounded_by_sample_data_count(cli, bigquery, bigquery_sample_table):
    """v1 expected 50 persisted rows from a 1000-row table."""
    filters = _only(bigquery_sample_table)
    cli.run(bigquery.invocation(MetadataPipeline(includeStoredProcedures=False), filters=filters))
    table = expect.poll(bigquery.table_query(bigquery_sample_table)).satisfies(entity_exists)
    cli.run(bigquery.invocation(_sampling(50), filters=filters))
    expect.poll(sample_query(bigquery.om, table)).satisfies(sample_row_count(50))


@pytest.mark.e2e_contract("sample.values.replacement")
def test_reingest_replaces_persisted_samples(cli, bigquery):
    filters = _only("all_types")
    cli.run(bigquery.invocation(MetadataPipeline(includeStoredProcedures=False), filters=filters))
    table = expect.poll(bigquery.table_query("all_types")).satisfies(entity_exists)
    invocation = bigquery.invocation(_sampling(10), filters=filters)
    query = sample_query(bigquery.om, table)

    def values_match(sampled, expected):
        assert sampled is not None, "sample data missing"
        assert sampled.id == table.id, "samples belong to a different table"
        actual = {key: row["int_col"] for key, row in native_sample_rows(sampled).items()}
        assert actual == expected, f"int_col samples: expected {expected!r}, got {actual!r}"

    cli.run(invocation)
    before = expect.poll(query).satisfies(lambda sampled: values_match(sampled, {1: 123456, 2: None, 3: None}))
    bigquery.source.set_value("all_types", 1, "int_col", 654321)
    cli.run(invocation)
    after = expect.poll(query).satisfies(lambda sampled: values_match(sampled, {1: 654321, 2: None, 3: None}))
    assert after.id == before.id
