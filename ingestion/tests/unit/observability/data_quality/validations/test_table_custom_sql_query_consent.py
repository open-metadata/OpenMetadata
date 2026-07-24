#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Tests for the Custom SQL Query failed-row sample consent gate."""

from datetime import datetime
from unittest.mock import Mock
from uuid import uuid4

import pytest

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.data_quality.validations.table.base.tableCustomSQLQuery import Strategy
from metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery import (
    TableCustomSQLQueryValidator,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.entityReference import EntityReference

TEST_CASE_NAME = "test_custom_sql_query_consent"
ENTITY_LINK = "<#E::table::service.db.users>"


def _make_test_case(*, compute_passed_failed_row_count: bool) -> TestCase:
    return TestCase(
        name=TEST_CASE_NAME,
        entityLink=ENTITY_LINK,
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
        computePassedFailedRowCount=compute_passed_failed_row_count,
    )


def _make_validator(*, compute_passed_failed_row_count: bool) -> TableCustomSQLQueryValidator:
    return TableCustomSQLQueryValidator(
        runner=Mock(),
        test_case=_make_test_case(compute_passed_failed_row_count=compute_passed_failed_row_count),
        execution_date=datetime.now(),
    )


def _failed_response(validator: TableCustomSQLQueryValidator) -> TestCaseResultResponse:
    return TestCaseResultResponse(
        testCase=validator.test_case,
        testCaseResult=TestCaseResult(
            timestamp=int(datetime.now().timestamp() * 1000),
            testCaseStatus=TestCaseStatus.Failed,
        ),
    )


def _passing_response(validator: TableCustomSQLQueryValidator) -> TestCaseResultResponse:
    return TestCaseResultResponse(
        testCase=validator.test_case,
        testCaseResult=TestCaseResult(
            timestamp=int(datetime.now().timestamp() * 1000),
            testCaseStatus=TestCaseStatus.Success,
        ),
    )


def test_consent_off_does_not_collect_failed_samples(monkeypatch):
    """computePassedFailedRowCount=False → no sample on failure."""
    validator = _make_validator(compute_passed_failed_row_count=False)
    monkeypatch.setattr(validator, "_get_strategy", lambda: Strategy.ROWS)

    fetch_called = False

    def _should_not_be_called():
        nonlocal fetch_called
        fetch_called = True
        return Mock()

    monkeypatch.setattr(validator, "fetch_failed_rows_sample", _should_not_be_called)

    response = _failed_response(validator)
    validator.result_with_failed_samples(response)

    assert response.failedRowsSample is None
    assert response.inspectionQuery is None
    assert fetch_called is False


def test_consent_on_collects_failed_samples(monkeypatch):
    """computePassedFailedRowCount=True → sample attached on failure."""
    validator = _make_validator(compute_passed_failed_row_count=True)
    monkeypatch.setattr(validator, "_get_strategy", lambda: Strategy.ROWS)

    sample_marker = Mock(name="failed_rows_sample")
    inspection_marker = "SELECT * FROM users WHERE 1=1"
    monkeypatch.setattr(validator, "fetch_failed_rows_sample", lambda: sample_marker)
    monkeypatch.setattr(validator, "get_inspection_query", lambda: inspection_marker)

    response = _failed_response(validator)
    validator.result_with_failed_samples(response)

    assert response.failedRowsSample is sample_marker
    assert response.inspectionQuery == inspection_marker
    assert response.validateColumns is False


def test_consent_on_but_strategy_is_count_does_not_collect(monkeypatch):
    """Strategy.COUNT → no sample regardless of consent."""
    validator = _make_validator(compute_passed_failed_row_count=True)
    monkeypatch.setattr(validator, "_get_strategy", lambda: Strategy.COUNT)
    monkeypatch.setattr(
        validator,
        "fetch_failed_rows_sample",
        lambda: pytest.fail("fetch should not be called for Strategy.COUNT"),
    )

    response = _failed_response(validator)
    validator.result_with_failed_samples(response)

    assert response.failedRowsSample is None
    assert response.inspectionQuery is None


def test_passing_status_does_not_collect_even_with_consent(monkeypatch):
    """Passing status → no sample regardless of consent."""
    validator = _make_validator(compute_passed_failed_row_count=True)
    monkeypatch.setattr(validator, "_get_strategy", lambda: Strategy.ROWS)
    monkeypatch.setattr(
        validator,
        "fetch_failed_rows_sample",
        lambda: pytest.fail("fetch should not be called when the test passed"),
    )

    response = _passing_response(validator)
    validator.result_with_failed_samples(response)

    assert response.failedRowsSample is None
    assert response.inspectionQuery is None
