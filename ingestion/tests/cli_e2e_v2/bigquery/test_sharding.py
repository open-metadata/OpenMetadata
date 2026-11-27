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
"""Opt-in live BigQuery family identity and representative execution."""

import pytest

from metadata.data_quality.api.models import TestCaseDefinition as CaseDefinition
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.tests.basic import TestCaseStatus as CaseStatus

from ..features.database.entities import entity_exists
from ..features.database.pipelines import AutoClassificationPipeline, MetadataPipeline
from ..features.database.profiles import table_has_row_count
from ..features.database.samples import sample_query
from ..runtime import expect
from .checks import dq_case_has_status, dq_case_query
from .test_profiles import profiler_options


def grouped(bigquery, options):
    invocation = bigquery.invocation(options, filters={"tableFilterPattern": {"includes": ["^events_yyyymmdd$"]}})
    if isinstance(options, MetadataPipeline):
        invocation.config["source"]["sourceConfig"]["config"]["shardedTables"] = {"enabled": True}
    return invocation


@pytest.mark.e2e_contract("catalog.sharding")
def test_family_rollover_and_persisted_execution_scope(request, cli, bigquery):
    for suffix, rows in (("20260101", "1"), ("20260102", "1, 2")):
        bigquery.source.run(
            f"CREATE TABLE {bigquery.source.qualified}.events_{suffix} AS SELECT id FROM UNNEST([{rows}]) AS id"
        )
    cli.run(grouped(bigquery, MetadataPipeline(includeStoredProcedures=False)))
    table = expect.poll(bigquery.table_query("events_yyyymmdd")).satisfies(entity_exists)
    assert table.tableType == TableType.Sharded
    assert table.tableSharding.shardCount == 2
    assert table.tableSharding.representative.tableName == "events_20260102"
    cli.run(grouped(bigquery, profiler_options()))
    measured = expect.poll(bigquery.profile_query("events_yyyymmdd")).satisfies(table_has_row_count(2))
    assert measured.profile.executionSource.tableName == "events_20260102"
    assert all(
        column.profile.executionSource.tableName == "events_20260102" for column in measured.columns if column.profile
    )
    cli.run(
        grouped(
            bigquery,
            AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=10),
        )
    )
    sampled = expect.poll(sample_query(bigquery.om, table)).satisfies(entity_exists)
    assert sampled.sampleData.executionSource.tableName == "events_20260102"
    assert len(sampled.sampleData.rows) == 2
    case = CaseDefinition(
        name="representative_row_count",
        testDefinitionName="tableRowCountToBeBetween",
        parameterValues=[{"name": "minValue", "value": "2"}, {"name": "maxValue", "value": "2"}],
    )
    case_fqn = f"{table.fullyQualifiedName.root}.{case.name}"

    def remove_case():
        existing = dq_case_query(bigquery.om, case_fqn).read()
        if existing is not None:
            bigquery.om.delete(type(existing), existing.id, recursive=True, hard_delete=True)

    request.addfinalizer(remove_case)
    cli.run(bigquery.table_diff_invocation("events_yyyymmdd", [case]))
    tested = expect.poll(dq_case_query(bigquery.om, case_fqn)).satisfies(dq_case_has_status(CaseStatus.Success))
    assert tested.testCaseResult.evaluationScope.executionSource.tableName == "events_20260102"
    bigquery.source.run(f"CREATE TABLE {bigquery.source.qualified}.events_20260103 AS SELECT 3 AS id")
    cli.run(grouped(bigquery, MetadataPipeline(includeStoredProcedures=False)))
    rolled = expect.poll(bigquery.table_query("events_yyyymmdd")).satisfies(entity_exists)
    assert rolled.id == table.id
    assert rolled.tableSharding.representative.tableName == "events_20260103"
    historical = bigquery.om.get_latest_table_profile(rolled.fullyQualifiedName.root)
    assert historical.profile.executionSource.tableName == "events_20260102"
    historical_case = dq_case_query(bigquery.om, case_fqn).read()
    assert historical_case.testCaseResult.evaluationScope.executionSource.tableName == "events_20260102"
