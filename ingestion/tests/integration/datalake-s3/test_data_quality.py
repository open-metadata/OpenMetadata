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
