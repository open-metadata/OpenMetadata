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
"""BigQuery data-quality workflow: the v1 tableDiff self-comparison."""

import pytest

# Aliased so pytest does not try to collect the generated Test* models as test classes.
from metadata.data_quality.api.models import TestCaseDefinition as CaseDefinition
from metadata.generated.schema.entity.data.table import TableProfilerConfig
from metadata.generated.schema.tests.basic import TestCaseStatus as CaseStatus
from metadata.generated.schema.tests.testCase import TestCaseParameterValue as CaseParameter
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.samplingConfig import ProfileSampleConfig, SampleConfigType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig

from ..features.database.entities import entity_exists
from ..features.database.pipelines import MetadataPipeline
from ..runtime import expect
from .checks import dq_case_has_status, dq_case_query


@pytest.mark.e2e_contract("dq.table-diff")
def test_table_diff_against_itself_succeeds(request, cli, bigquery, bigquery_sample_table):
    """v1 diffed a 1000-row table against itself with a 100-row static sample."""
    table = bigquery_sample_table
    cli.run(
        bigquery.invocation(
            MetadataPipeline(includeStoredProcedures=False),
            filters={"tableFilterPattern": {"includes": [f"^{table}$"]}},
        )
    )
    table_fqn = bigquery.table_fqn(table)
    expect.poll(bigquery.table_query(table)).satisfies(entity_exists)
    bigquery.om.create_or_update_table_profiler_config(
        table_fqn,
        TableProfilerConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.STATIC,
                config=StaticSamplingConfig(profileSample=100, profileSampleType=ProfileSampleType.ROWS),
            ),
        ),
    )
    case = CaseDefinition(
        name="bigquery_table_diff",
        testDefinitionName="tableDiff",
        computePassedFailedRowCount=True,
        parameterValues=[
            CaseParameter(name="table2", value=table_fqn),
            CaseParameter(name="keyColumns", value='["id"]'),
        ],
    )
    case_fqn = f"{table_fqn}.{case.name}"

    def remove_case():
        existing = dq_case_query(bigquery.om, case_fqn).read()
        if existing is not None:
            bigquery.om.delete(entity=type(existing), entity_id=existing.id, recursive=True, hard_delete=True)

    request.addfinalizer(remove_case)
    cli.run(bigquery.table_diff_invocation(table, [case]))
    expect.poll(dq_case_query(bigquery.om, case_fqn)).satisfies(dq_case_has_status(CaseStatus.Success))
