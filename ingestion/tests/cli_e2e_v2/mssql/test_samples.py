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
"""Persisted MSSQL native samples, the sample-row limit, and replacement after a mutation."""

import pytest

from ..features.database.entities import entity_exists
from ..features.database.pipelines import AutoClassificationPipeline, MetadataPipeline
from ..features.database.samples import sample_query
from ..runtime import expect
from .baseline import (
    NATIVE_INTEGER_COLUMN,
    NATIVE_INTEGER_VALUE,
    NATIVE_TABLE,
    NATIVE_UPDATED_INTEGER_VALUE,
    PARTITIONED_TABLE,
    PERSONS_ROW_COUNT,
)
from .checks import native_sample_rows, native_samples_match, sample_row_count

_SAMPLE_LIMIT = 4


def _only(*names):
    return {"tableFilterPattern": {"includes": [f"^({'|'.join(names)})$"]}}


def _sampling(count):
    return AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=count)


@pytest.mark.parametrize(
    "integer_value",
    [
        pytest.param(NATIVE_INTEGER_VALUE, id="original", marks=pytest.mark.e2e_contract("sample.values.original")),
        pytest.param(
            NATIVE_UPDATED_INTEGER_VALUE, id="updated", marks=pytest.mark.e2e_contract("sample.values.updated")
        ),
    ],
)
def test_persisted_native_sample_values(integer_value, cli, mssql):
    filters = _only(NATIVE_TABLE)
    cli.run(mssql.invocation(MetadataPipeline(), filters=filters))
    table = expect.poll(mssql.table_query(NATIVE_TABLE)).satisfies(entity_exists)
    if integer_value != NATIVE_INTEGER_VALUE:
        mssql.source.set_value(NATIVE_TABLE, 1, NATIVE_INTEGER_COLUMN, integer_value)
    cli.run(mssql.invocation(_sampling(10), filters=filters))
    expect.poll(sample_query(mssql.om, table)).satisfies(
        lambda sampled: native_samples_match(sampled, integer_value=integer_value)
    )


@pytest.mark.e2e_contract("sample.limit")
def test_sample_is_bounded_by_sample_data_count(cli, mssql):
    """v1 read all 6 rows of this table; here the configured limit has to cut it short."""
    assert _SAMPLE_LIMIT < PERSONS_ROW_COUNT
    filters = _only(PARTITIONED_TABLE)
    cli.run(mssql.invocation(MetadataPipeline(), filters=filters))
    table = expect.poll(mssql.table_query(PARTITIONED_TABLE)).satisfies(entity_exists)
    cli.run(mssql.invocation(_sampling(_SAMPLE_LIMIT), filters=filters))
    expect.poll(sample_query(mssql.om, table)).satisfies(sample_row_count(_SAMPLE_LIMIT))


@pytest.mark.e2e_contract("sample.values.replacement")
def test_reingest_replaces_persisted_samples(cli, mssql):
    filters = _only(NATIVE_TABLE)
    cli.run(mssql.invocation(MetadataPipeline(), filters=filters))
    table = expect.poll(mssql.table_query(NATIVE_TABLE)).satisfies(entity_exists)
    invocation = mssql.invocation(_sampling(10), filters=filters)
    query = sample_query(mssql.om, table)
    cli.run(invocation)
    before = expect.poll(query).satisfies(native_samples_match)
    mssql.source.set_value(NATIVE_TABLE, 1, NATIVE_INTEGER_COLUMN, NATIVE_UPDATED_INTEGER_VALUE)
    cli.run(invocation)
    after = expect.poll(query).satisfies(
        lambda sampled: native_samples_match(sampled, integer_value=NATIVE_UPDATED_INTEGER_VALUE)
    )
    assert native_sample_rows(after)[NATIVE_INTEGER_COLUMN] != native_sample_rows(before)[NATIVE_INTEGER_COLUMN]
    assert after.id == before.id
