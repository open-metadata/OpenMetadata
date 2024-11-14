#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
test data quality
"""
from typing import List

import pytest

from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase


class TestDataQuality:
    @pytest.mark.parametrize(
        "test_case_name,expected_status",
        [
            ("first_name_includes_john", TestCaseStatus.Success),
            ("first_name_is_john", TestCaseStatus.Failed),
        ],
    )
    def test_data_quality(
        self, run_test_suite_workflow, metadata, test_case_name, expected_status
    ):
        test_cases: List[TestCase] = metadata.list_entities(
            TestCase, fields=["*"], skip_on_failure=True
        ).entities
        test_case: TestCase = next(
            (t for t in test_cases if t.name.root == test_case_name), None
        )
        assert test_case is not None
        assert test_case.testCaseResult.testCaseStatus == expected_status

    @pytest.mark.parametrize(
        "test_case_name,failed_rows",
        [
            ("first_name_includes_john", None),
            ("first_name_is_john", 1),
        ],
    )
    def test_data_quality_with_sample(
        self, run_sampled_test_suite_workflow, metadata, test_case_name, failed_rows
    ):
        test_cases: List[TestCase] = metadata.list_entities(
            TestCase, fields=["*"], skip_on_failure=True
        ).entities
        test_case: TestCase = next(
            (t for t in test_cases if t.name.root == test_case_name), None
        )
        assert test_case is not None
        if failed_rows:
            assert test_case.testCaseResult.failedRows == pytest.approx(
                failed_rows, abs=1
            )

    @pytest.mark.parametrize(
        "test_case_name,expected_status,failed_rows",
        [
            ("first_name_includes_john", TestCaseStatus.Success, None),
            ("first_name_is_john", TestCaseStatus.Failed, 1),
        ],
    )
    def test_data_quality_with_partition(
        self,
        run_partitioned_test_suite_workflow,
        metadata,
        test_case_name,
        expected_status,
        failed_rows,
    ):
        test_cases: List[TestCase] = metadata.list_entities(
            TestCase, fields=["*"], skip_on_failure=True
        ).entities
        test_case: TestCase = next(
            (t for t in test_cases if t.name.root == test_case_name), None
        )
        assert test_case is not None
        assert test_case.testCaseResult.testCaseStatus == expected_status
        if failed_rows:
            assert test_case.testCaseResult.failedRows == failed_rows
