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
"""Data quality and auto-classification against Informix.

Both ride on the sampler, which wraps every query in a limited subquery -- the
component Informix rejected outright until the dialect learned SKIP/FIRST. That
made them the last unexercised part of the connector, and the parts most likely
to fail for reasons the metadata and profiler runs would never surface.
"""

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuiteConfigType,
)
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.ingestion.ometa.utils import model_str
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow

# lob_types holds exactly two rows. One case is deliberately wrong: a suite where
# every test passes cannot tell a working runner from one that never ran.
TEST_CASES = [
    {
        "name": "informix_row_count_is_two",
        "testDefinitionName": "tableRowCountToEqual",
        "parameterValues": [{"name": "value", "value": "2"}],
        "expected": TestCaseStatus.Success,
    },
    {
        "name": "informix_id_is_never_null",
        "testDefinitionName": "columnValuesToBeNotNull",
        "columnName": "id",
        "expected": TestCaseStatus.Success,
    },
    {
        "name": "informix_id_within_range",
        "testDefinitionName": "columnValuesToBeBetween",
        "columnName": "id",
        "parameterValues": [
            {"name": "minValue", "value": "0"},
            {"name": "maxValue", "value": "10"},
        ],
        "expected": TestCaseStatus.Success,
    },
    {
        "name": "informix_row_count_is_deliberately_wrong",
        "testDefinitionName": "tableRowCountToEqual",
        "parameterValues": [{"name": "value", "value": "999"}],
        "expected": TestCaseStatus.Failed,
    },
]


@pytest.fixture(scope="module")
def table_fqn(db_service) -> str:
    return f"{db_service.fullyQualifiedName.root}.itest.informix.lob_types"


@pytest.fixture(scope="module")
def test_case_results(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    sink_config,
    workflow_config,
    metadata,
    db_service,
    table_fqn,
) -> dict:
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(
        TestSuiteWorkflow,
        {
            "source": {
                "type": "informix",
                "serviceName": f"informix_dq_{model_str(db_service.name)}",
                "sourceConfig": {
                    "config": {
                        "type": TestSuiteConfigType.TestSuite.value,
                        "entityFullyQualifiedName": table_fqn,
                    }
                },
            },
            "processor": {
                "type": "orm-test-runner",
                "config": {"testCases": [{k: v for k, v in c.items() if k != "expected"} for c in TEST_CASES]},
            },
            "sink": sink_config,
            "workflowConfig": workflow_config,
        },
    )

    def _fqn_of(case: dict) -> str:
        """A column test hangs off the column's FQN, a table test off the table's."""
        parent = f"{table_fqn}.{case['columnName']}" if "columnName" in case else table_fqn
        return f"{parent}.{case['name']}"

    return {
        case["name"]: metadata.get_by_name(
            entity=TestCase,
            fqn=_fqn_of(case),
            fields=["testCaseResult", "testDefinition", "testSuite"],
            nullable=True,
        )
        for case in TEST_CASES
    }


class TestDataQuality:
    @pytest.mark.parametrize("case", TEST_CASES, ids=lambda c: c["name"])
    def test_case_runs_and_reports_the_right_verdict(self, test_case_results, case):
        result = test_case_results[case["name"]]
        assert result is not None, f"{case['name']} produced no test case"
        assert result.testCaseResult is not None, f"{case['name']} ran but stored no result"
        # Carry the engine's own message: an Aborted case says why here, and
        # without it the failure is just one enum that is not another.
        assert result.testCaseResult.testCaseStatus == case["expected"], result.testCaseResult.result

    def test_a_failing_case_actually_fails(self, test_case_results):
        """Guards the suite itself: all-passing tests cannot detect a runner that never ran."""
        failing = test_case_results["informix_row_count_is_deliberately_wrong"]
        assert failing.testCaseResult.testCaseStatus == TestCaseStatus.Failed


class TestAutoClassification:
    def test_sample_data_is_collected(
        self,
        patch_passwords_for_db_services,
        run_workflow,
        ingestion_config,
        classifier_config,
        metadata,
        table_fqn,
    ):
        """Sampling is what Informix rejected before the dialect learned SKIP/FIRST."""
        run_workflow(MetadataWorkflow, ingestion_config)
        run_workflow(AutoClassificationWorkflow, classifier_config)
        table = metadata.get_by_name(entity=Table, fqn=table_fqn)
        sample = metadata.get_sample_data(table)
        assert sample.sampleData is not None
        assert sample.sampleData.rows, "sampling returned no rows"
