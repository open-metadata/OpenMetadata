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
"""Persisted Postgres native samples and replacement after source mutation."""

import pytest

from ..features.database.entities import entity_exists
from ..features.database.pipelines import AutoClassificationPipeline, MetadataPipeline
from ..features.database.samples import sample_query
from ..runtime import expect
from .checks import native_sample_rows, native_samples_match


def sample_options():
    return AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=10)


@pytest.mark.parametrize(
    "integer_value",
    [
        pytest.param(1234567890, id="original", marks=pytest.mark.e2e_contract("sample.values.original")),
        pytest.param(987654321, id="updated", marks=pytest.mark.e2e_contract("sample.values.updated")),
    ],
)
def test_persisted_native_sample_values(integer_value, cli, postgres):
    filters = {"tableFilterPattern": {"includes": ["^all_datatypes$"]}}
    cli.run(postgres.invocation(MetadataPipeline(), filters=filters))
    table = expect.poll(postgres.table_query("all_datatypes")).satisfies(entity_exists)
    if integer_value != 1234567890:
        postgres.source.set_value("all_datatypes", 1, "column10", integer_value)
    cli.run(postgres.invocation(sample_options(), filters=filters))
    expect.poll(sample_query(postgres.om, table)).satisfies(
        lambda sampled: native_samples_match(sampled, integer_value=integer_value)
    )


@pytest.mark.e2e_contract("sample.values.replacement")
def test_reingest_replaces_persisted_samples(cli, postgres):
    filters = {"tableFilterPattern": {"includes": ["^all_datatypes$"]}}
    cli.run(postgres.invocation(MetadataPipeline(), filters=filters))
    table = expect.poll(postgres.table_query("all_datatypes")).satisfies(entity_exists)
    invocation = postgres.invocation(sample_options(), filters=filters)
    query = sample_query(postgres.om, table)
    cli.run(invocation)
    before = expect.poll(query).satisfies(native_samples_match)
    postgres.source.set_value("all_datatypes", 1, "column10", 987654321)
    cli.run(invocation)
    after = expect.poll(query).satisfies(lambda sampled: native_samples_match(sampled, integer_value=987654321))
    assert native_sample_rows(after)["column10"] != native_sample_rows(before)["column10"]
    assert after.id == before.id
