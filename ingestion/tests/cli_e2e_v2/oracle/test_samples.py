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
"""Persisted Oracle sample data and its replacement on re-ingest."""

import pytest

from ..features.database.entities import entity_exists
from ..features.database.pipelines import AutoClassificationPipeline, MetadataPipeline
from ..features.database.samples import sample_query
from ..runtime import expect
from .checks import native_sample_rows

# Uppercase to match the entity name OM stores. The metadata pipeline matches filter
# patterns case-insensitively, but the auto-classification path does not, so a
# lowercase pattern here selects nothing and no sample data is ever written.
_FILTERS = {"tableFilterPattern": {"includes": ["ALL_TYPES"]}}


def _sample_options() -> AutoClassificationPipeline:
    return AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=10)


@pytest.mark.e2e_contract("sample.values.original")
def test_persisted_native_sample_values(cli, oracle):
    """Sample data for the seeded Oracle-native row is persisted with the declared value."""
    cli.run(oracle.invocation(MetadataPipeline(includeStoredProcedures=False), filters=_FILTERS))
    table = expect.poll(oracle.table_query("ALL_TYPES")).satisfies(entity_exists)

    cli.run(oracle.invocation(_sample_options(), filters=_FILTERS))

    def values_match(sampled):
        rows = native_sample_rows(sampled)
        actual = {key: row["number_int_col"] for key, row in rows.items()}
        assert actual == {1: 123456, 2: None, 3: None}, f"number_int_col samples: {actual!r}"

    expect.poll(sample_query(oracle.om, table)).satisfies(values_match)


@pytest.mark.e2e_contract("sample.values.replacement")
def test_reingest_replaces_persisted_samples(cli, oracle):
    """Re-sampling after a source update replaces the stored rows on the same entity."""
    cli.run(oracle.invocation(MetadataPipeline(includeStoredProcedures=False), filters=_FILTERS))
    table = expect.poll(oracle.table_query("ALL_TYPES")).satisfies(entity_exists)
    invocation = oracle.invocation(_sample_options(), filters=_FILTERS)
    query = sample_query(oracle.om, table)

    def values_match(sampled, expected):
        assert sampled is not None, "sample data missing"
        assert sampled.id == table.id, "samples belong to a different table"
        actual = {key: row["number_int_col"] for key, row in native_sample_rows(sampled).items()}
        assert actual == expected, f"number_int_col samples: expected {expected!r}, got {actual!r}"

    cli.run(invocation)
    before = expect.poll(query).satisfies(lambda sampled: values_match(sampled, {1: 123456, 2: None, 3: None}))
    oracle.source.set_value("all_types", 1, "number_int_col", 654321)
    cli.run(invocation)
    after = expect.poll(query).satisfies(lambda sampled: values_match(sampled, {1: 654321, 2: None, 3: None}))
    assert after.id == before.id
