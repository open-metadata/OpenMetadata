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
"""Persisted Exasol native samples, the sample-row limit, and replacement after a mutation."""

import pytest

from ..features.database.entities import entity_exists
from ..features.database.pipelines import AutoClassificationPipeline, MetadataPipeline
from ..features.database.samples import sample_query
from ..runtime import expect
from .baseline import NATIVE_ROWS, NATIVE_TABLE, NATIVE_UPDATED_DECIMAL_VALUE
from .checks import native_sample_rows, native_samples_match, sample_row_count

_ORIGINAL_DECIMAL = NATIVE_ROWS[0]["col_decimal"]
_SAMPLE_LIMIT = 3


def _only(*names):
    return {"tableFilterPattern": {"includes": [f"^({'|'.join(names)})$"]}}


def _sampling(count):
    return AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=count)


@pytest.mark.parametrize(
    "decimal_value",
    [
        pytest.param(_ORIGINAL_DECIMAL, id="original", marks=pytest.mark.e2e_contract("sample.values.original")),
        pytest.param(
            NATIVE_UPDATED_DECIMAL_VALUE, id="updated", marks=pytest.mark.e2e_contract("sample.values.updated")
        ),
    ],
)
def test_persisted_native_sample_values(decimal_value, cli, exasol):
    """v1 counted 2 sample rows; here both rows' values are checked, before and after an update."""
    filters = _only(NATIVE_TABLE)
    cli.run(exasol.invocation(MetadataPipeline(), filters=filters))
    table = expect.poll(exasol.table_query(NATIVE_TABLE)).satisfies(entity_exists)
    if decimal_value != _ORIGINAL_DECIMAL:
        exasol.source.set_value(NATIVE_TABLE, 1, "col_decimal", decimal_value)
    cli.run(exasol.invocation(_sampling(10), filters=filters))
    expect.poll(sample_query(exasol.om, table)).satisfies(
        lambda sampled: native_samples_match(sampled, decimal_value=decimal_value)
    )


@pytest.mark.e2e_contract("sample.limit")
def test_sample_is_bounded_by_sample_data_count(cli, exasol):
    """The configured limit cuts a five-row table short."""
    filters = _only("customers")
    cli.run(exasol.invocation(MetadataPipeline(), filters=filters))
    table = expect.poll(exasol.table_query("customers")).satisfies(entity_exists)
    cli.run(exasol.invocation(_sampling(_SAMPLE_LIMIT), filters=filters))
    expect.poll(sample_query(exasol.om, table)).satisfies(sample_row_count(_SAMPLE_LIMIT))


@pytest.mark.e2e_contract("sample.values.replacement")
def test_reingest_replaces_persisted_samples(cli, exasol):
    filters = _only(NATIVE_TABLE)
    cli.run(exasol.invocation(MetadataPipeline(), filters=filters))
    table = expect.poll(exasol.table_query(NATIVE_TABLE)).satisfies(entity_exists)
    invocation = exasol.invocation(_sampling(10), filters=filters)
    query = sample_query(exasol.om, table)
    cli.run(invocation)
    before = expect.poll(query).satisfies(native_samples_match)
    exasol.source.set_value(NATIVE_TABLE, 1, "col_decimal", NATIVE_UPDATED_DECIMAL_VALUE)
    cli.run(invocation)
    after = expect.poll(query).satisfies(
        lambda sampled: native_samples_match(sampled, decimal_value=NATIVE_UPDATED_DECIMAL_VALUE)
    )
    assert native_sample_rows(after)[0]["col_decimal"] != native_sample_rows(before)[0]["col_decimal"]
    assert after.id == before.id
