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

"""
Unit tests for ResultCapturingProcessor
"""
from unittest.mock import MagicMock, create_autospec
from uuid import uuid4

import pytest

from metadata.data_quality.api.models import TestCaseResultResponse, TestCaseResults
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.basic import TestCaseResult, TestResultValue
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    TestCaseEntityName,
    Timestamp,
)
from metadata.ingestion.api.models import Either, Entity
from metadata.ingestion.api.steps import Processor
from metadata.sdk.data_quality.result_capturing_processor import (
    ResultCapturingProcessor,
)


@pytest.fixture
def mock_processor():
    """Create a mock processor with autospec"""
    processor = create_autospec(Processor, instance=True)
    processor.name = "TestCaseRunner"
    processor.status = MagicMock()
    return processor


@pytest.fixture
def sample_test_case():
    """Create a sample test case"""
    return TestCase.model_construct(
        id=uuid4(),
        name=TestCaseEntityName(root="test_case_1"),
        fullyQualifiedName=FullyQualifiedEntityName(
            root="MySQL.default.test_db.test_table.test_case_1"
        ),
    )


@pytest.fixture
def sample_test_case_result():
    """Create a sample test case result"""
    return TestCaseResult.model_construct(
        timestamp=Timestamp(root=1234567890),
        testCaseStatus="Success",
        result="Test passed",
        testResultValue=[
            TestResultValue.model_construct(
                name="value",
                value="42",
            )
        ],
    )


@pytest.fixture
def sample_test_result_response(sample_test_case, sample_test_case_result):
    """Create a sample test case result response"""
    return TestCaseResultResponse.model_construct(
        testCaseResult=sample_test_case_result,
        testCase=sample_test_case,
    )


@pytest.fixture
def mock_record():
    """Create a mock record"""
    return MagicMock(spec=Entity)


def test_captures_single_result(
    mock_processor, sample_test_result_response, mock_record
):
    """Verify single TestCaseResult captured"""
    test_case_results = TestCaseResults.model_construct(
        test_results=[sample_test_result_response]
    )
    mock_processor._run.return_value = Either(right=test_case_results)

    capturer = ResultCapturingProcessor(mock_processor)
    result = capturer.run(mock_record)

    assert result == test_case_results
    results = capturer.get_results()
    assert len(results) == 1
    assert results[0] == sample_test_result_response


def test_captures_multiple_results(mock_processor, sample_test_case, mock_record):
    """Verify multiple results accumulated"""
    test_result_1 = TestCaseResultResponse.model_construct(
        testCaseResult=TestCaseResult.model_construct(
            timestamp=Timestamp(root=1234567890),
            testCaseStatus="Success",
        ),
        testCase=sample_test_case,
    )
    test_result_2 = TestCaseResultResponse.model_construct(
        testCaseResult=TestCaseResult.model_construct(
            timestamp=Timestamp(root=1234567891),
            testCaseStatus="Failed",
        ),
        testCase=sample_test_case,
    )
    test_result_3 = TestCaseResultResponse.model_construct(
        testCaseResult=TestCaseResult.model_construct(
            timestamp=Timestamp(root=1234567892),
            testCaseStatus="Aborted",
        ),
        testCase=sample_test_case,
    )

    test_case_results = TestCaseResults.model_construct(
        test_results=[test_result_1, test_result_2, test_result_3]
    )
    mock_processor._run.return_value = Either(right=test_case_results)

    capturer = ResultCapturingProcessor(mock_processor)
    capturer.run(mock_record)

    results = capturer.get_results()
    assert len(results) == 3
    assert results[0] == test_result_1
    assert results[1] == test_result_2
    assert results[2] == test_result_3


def test_captures_across_multiple_runs(mock_processor, sample_test_case, mock_record):
    """Verify results from multiple run() calls are accumulated"""
    test_result_1 = TestCaseResultResponse.model_construct(
        testCaseResult=TestCaseResult.model_construct(
            timestamp=Timestamp(root=1234567890),
            testCaseStatus="Success",
        ),
        testCase=sample_test_case,
    )
    test_result_2 = TestCaseResultResponse.model_construct(
        testCaseResult=TestCaseResult.model_construct(
            timestamp=Timestamp(root=1234567891),
            testCaseStatus="Failed",
        ),
        testCase=sample_test_case,
    )

    test_case_results_1 = TestCaseResults.model_construct(test_results=[test_result_1])
    test_case_results_2 = TestCaseResults.model_construct(test_results=[test_result_2])

    mock_processor._run.side_effect = [
        Either(right=test_case_results_1),
        Either(right=test_case_results_2),
    ]

    capturer = ResultCapturingProcessor(mock_processor)
    capturer.run(mock_record)
    capturer.run(mock_record)

    results = capturer.get_results()
    assert len(results) == 2
    assert results[0] == test_result_1
    assert results[1] == test_result_2


def test_delegates_attributes_to_wrapped_processor(mock_processor):
    """Verify delegation works for processor attributes"""
    mock_processor.custom_attribute = "custom_value"
    mock_processor.custom_method = MagicMock(return_value="method_result")

    capturer = ResultCapturingProcessor(mock_processor)

    assert capturer.custom_attribute == "custom_value"
    assert capturer.custom_method() == "method_result"
    mock_processor.custom_method.assert_called_once()


def test_passes_through_result_unchanged(
    mock_processor, sample_test_result_response, mock_record
):
    """Verify result not modified"""
    test_case_results = TestCaseResults.model_construct(
        test_results=[sample_test_result_response]
    )
    mock_processor._run.return_value = Either(right=test_case_results)

    capturer = ResultCapturingProcessor(mock_processor)
    result = capturer.run(mock_record)

    assert result is test_case_results
    assert result.test_results == [sample_test_result_response]


def test_handles_empty_test_results(mock_processor, mock_record):
    """Verify None/empty results handled correctly"""
    test_case_results_with_empty_list = TestCaseResults.model_construct(test_results=[])

    mock_processor._run.side_effect = [
        Either(right=test_case_results_with_empty_list),
        Either(right=None),
    ]

    capturer = ResultCapturingProcessor(mock_processor)

    result1 = capturer.run(mock_record)
    assert result1 == test_case_results_with_empty_list

    result2 = capturer.run(mock_record)
    assert result2 is None

    results = capturer.get_results()
    assert len(results) == 0


def test_handles_non_test_case_results(mock_processor, mock_record):
    """Verify other result types ignored"""
    create_test_suite_request = CreateTestSuiteRequest.model_construct(
        name=EntityName("test_suite"),
        executableEntityReference=FullyQualifiedEntityName(
            root="MySQL.default.test_db.test_table"
        ),
    )

    table = Table.model_construct(
        id=uuid4(),
        name=EntityName("test_table"),
        fullyQualifiedName=FullyQualifiedEntityName(
            root="MySQL.default.test_db.test_table"
        ),
    )

    mock_processor._run.side_effect = [
        Either(right=create_test_suite_request),
        Either(right=table),
    ]

    capturer = ResultCapturingProcessor(mock_processor)

    result1 = capturer.run(mock_record)
    assert result1 == create_test_suite_request

    result2 = capturer.run(mock_record)
    assert result2 == table

    results = capturer.get_results()
    assert len(results) == 0


def test_get_results_returns_list(mock_processor):
    """Verify get_results always returns a list"""
    capturer = ResultCapturingProcessor(mock_processor)
    results = capturer.get_results()

    assert isinstance(results, list)
    assert len(results) == 0


def test_run_calls_wrapped_processor_run(mock_processor, mock_record):
    """Verify run() delegates to wrapped processor"""
    mock_processor._run.return_value = Either(right=None)

    capturer = ResultCapturingProcessor(mock_processor)
    capturer.run(mock_record)

    mock_processor._run.assert_called_once_with(mock_record)


def test_captures_mixed_results_and_non_results(
    mock_processor, sample_test_result_response, mock_record
):
    """Verify capturer handles mix of TestCaseResults and other types"""
    test_case_results = TestCaseResults.model_construct(
        test_results=[sample_test_result_response]
    )
    table = Table.model_construct(
        id=uuid4(),
        name=EntityName("test_table"),
    )

    mock_processor._run.side_effect = [
        Either(right=test_case_results),
        Either(right=table),
        Either(right=test_case_results),
    ]

    capturer = ResultCapturingProcessor(mock_processor)
    capturer.run(mock_record)
    capturer.run(mock_record)
    capturer.run(mock_record)

    results = capturer.get_results()
    assert len(results) == 2
    assert results[0] == sample_test_result_response
    assert results[1] == sample_test_result_response
