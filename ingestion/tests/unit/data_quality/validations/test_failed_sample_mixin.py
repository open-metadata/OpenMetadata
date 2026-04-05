"""
Unit tests for the FailedSampleValidatorMixin and row sampler mixins.

Tests the orchestration logic of result_with_failed_samples():
  - Only fetches samples when computePassedFailedRowCount=True AND status=Failed
  - Handles exceptions gracefully
  - Stashes data on the result object
"""

from unittest.mock import MagicMock, patch

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.data_quality.validations.mixins.failed_row_sampler_mixin import (
    FAILED_ROW_SAMPLE_SIZE,
    PandasFailedRowSamplerMixin,
    SQARowSamplerMixin,
)
from metadata.data_quality.validations.mixins.failed_sample_validator_mixin import (
    FailedSampleValidatorMixin,
)
from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus


class ConcreteValidator(FailedSampleValidatorMixin):
    """Minimal concrete implementation for testing the mixin."""

    def __init__(self, sample_data=None, inspection_query=None, raise_on_fetch=False):
        self._sample_data = sample_data
        self._inspection_query_val = inspection_query
        self._raise_on_fetch = raise_on_fetch

    def fetch_failed_rows_sample(self):
        if self._raise_on_fetch:
            raise RuntimeError("fetch error")
        return self._sample_data

    def get_inspection_query(self):
        return self._inspection_query_val

    def filter(self):
        return {}


def _make_test_case(compute_row_count=True):
    tc = MagicMock()
    tc.computePassedFailedRowCount = compute_row_count
    return tc


def _make_test_case_result(status=TestCaseStatus.Failed):
    result = MagicMock(spec=TestCaseResult)
    result.testCaseStatus = status
    return result


def _make_response(compute_row_count=True, status=TestCaseStatus.Failed):
    response = MagicMock(spec=TestCaseResultResponse)
    response.testCase = _make_test_case(compute_row_count)
    response.testCaseResult = _make_test_case_result(status)
    response.failedRowsSample = None
    response.inspectionQuery = None
    return response


class TestFailedSampleValidatorMixin:
    def test_samples_fetched_when_failed_and_flag_set(self):
        sample = TableData(columns=["a", "b"], rows=[["1", "2"]])
        validator = ConcreteValidator(sample_data=sample, inspection_query="SELECT 1")
        response = _make_response(compute_row_count=True, status=TestCaseStatus.Failed)

        validator.result_with_failed_samples(response)

        assert response.failedRowsSample == sample
        assert response.inspectionQuery == "SELECT 1"

    def test_no_samples_when_status_is_success(self):
        sample = TableData(columns=["a"], rows=[["1"]])
        validator = ConcreteValidator(sample_data=sample)
        response = _make_response(compute_row_count=True, status=TestCaseStatus.Success)

        validator.result_with_failed_samples(response)

        assert response.failedRowsSample is None

    def test_no_samples_when_flag_is_false(self):
        sample = TableData(columns=["a"], rows=[["1"]])
        validator = ConcreteValidator(sample_data=sample)
        response = _make_response(compute_row_count=False, status=TestCaseStatus.Failed)

        validator.result_with_failed_samples(response)

        assert response.failedRowsSample is None

    def test_no_samples_when_flag_is_none(self):
        validator = ConcreteValidator(sample_data=TableData(columns=[], rows=[]))
        response = _make_response(status=TestCaseStatus.Failed)
        response.testCase.computePassedFailedRowCount = None

        validator.result_with_failed_samples(response)

        assert response.failedRowsSample is None

    def test_fetch_error_does_not_propagate(self):
        validator = ConcreteValidator(raise_on_fetch=True)
        response = _make_response(compute_row_count=True, status=TestCaseStatus.Failed)

        validator.result_with_failed_samples(response)

        assert response.failedRowsSample is None

    def test_inspection_query_none_by_default(self):
        sample = TableData(columns=["a"], rows=[["1"]])
        validator = ConcreteValidator(sample_data=sample, inspection_query=None)
        response = _make_response(compute_row_count=True, status=TestCaseStatus.Failed)

        validator.result_with_failed_samples(response)

        assert response.failedRowsSample == sample
        assert response.inspectionQuery is None


class TestPandasFailedRowSamplerMixin:
    def test_respects_sample_size_limit(self):
        import pandas as pd

        large_df = pd.DataFrame(
            {"col1": range(100), "col2": [f"val_{i}" for i in range(100)]}
        )

        class TestValidator(PandasFailedRowSamplerMixin):
            def runner(self_inner):
                def gen():
                    yield large_df

                return gen()

            def filter(self_inner):
                return "col1 >= 0"

        validator = TestValidator()
        cols, rows = validator._get_failed_rows_sample()

        assert len(rows) <= FAILED_ROW_SAMPLE_SIZE
        assert cols == ["col1", "col2"]

    def test_empty_result(self):
        import pandas as pd

        df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})

        class TestValidator(PandasFailedRowSamplerMixin):
            def runner(self_inner):
                def gen():
                    yield df

                return gen()

            def filter(self_inner):
                return "col1 > 100"

        validator = TestValidator()
        cols, rows = validator._get_failed_rows_sample()

        assert cols == ["col1", "col2"]
        assert len(rows) == 0

    def test_multiple_chunks(self):
        import pandas as pd

        chunk1 = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})
        chunk2 = pd.DataFrame({"a": [3, 4], "b": ["z", "w"]})

        class TestValidator(PandasFailedRowSamplerMixin):
            def runner(self_inner):
                def gen():
                    yield chunk1
                    yield chunk2

                return gen()

            def filter(self_inner):
                return "a >= 1"

        validator = TestValidator()
        cols, rows = validator._get_failed_rows_sample()

        assert cols == ["a", "b"]
        assert len(rows) == 4


class TestSQARowSamplerMixin:
    def test_dict_filter_uses_select_from_sample(self):
        mock_runner = MagicMock()
        mock_col = MagicMock()
        mock_col.name = "test_col"
        mock_inspect = MagicMock()
        mock_inspect.c = [mock_col]

        mock_query = MagicMock()
        mock_runner._select_from_sample.return_value = mock_query
        mock_query.limit.return_value.all.return_value = [
            (1, "a"),
            (2, "b"),
        ]
        mock_query.statement.compile.return_value = "SELECT ..."

        class TestValidator(SQARowSamplerMixin):
            pass

        validator = TestValidator()
        validator.runner = mock_runner

        with patch(
            "metadata.data_quality.validations.mixins.failed_row_sampler_mixin.inspect",
            return_value=mock_inspect,
        ):
            validator.filter = lambda: {"filters": [], "or_filter": False}
            cols, rows = validator._get_failed_rows_sample()

        assert cols == ["test_col"]
        assert len(rows) == 2
        mock_runner._select_from_sample.assert_called_once()

    def test_non_dict_filter_uses_query_filter(self):
        mock_runner = MagicMock()
        mock_col = MagicMock()
        mock_col.name = "test_col"
        mock_inspect = MagicMock()
        mock_inspect.c = [mock_col]

        mock_query = MagicMock()
        mock_runner._select_from_sample.return_value = mock_query
        filtered_query = MagicMock()
        mock_query.filter.return_value = filtered_query
        filtered_query.limit.return_value.all.return_value = [(1,)]
        filtered_query.statement.compile.return_value = "SELECT ..."

        class TestValidator(SQARowSamplerMixin):
            pass

        validator = TestValidator()
        validator.runner = mock_runner

        sqa_filter = MagicMock()
        with patch(
            "metadata.data_quality.validations.mixins.failed_row_sampler_mixin.inspect",
            return_value=mock_inspect,
        ):
            validator.filter = lambda: sqa_filter
            cols, rows = validator._get_failed_rows_sample()

        mock_query.filter.assert_called_once_with(sqa_filter)
        assert cols == ["test_col"]

    def test_captures_inspection_query(self):
        mock_runner = MagicMock()
        mock_col = MagicMock()
        mock_col.name = "id"
        mock_inspect = MagicMock()
        mock_inspect.c = [mock_col]

        mock_query = MagicMock()
        mock_runner._select_from_sample.return_value = mock_query
        mock_query.limit.return_value.all.return_value = []
        mock_query.statement.compile.return_value = "SELECT id FROM table WHERE ..."

        class TestValidator(SQARowSamplerMixin):
            pass

        validator = TestValidator()
        validator.runner = mock_runner

        with patch(
            "metadata.data_quality.validations.mixins.failed_row_sampler_mixin.inspect",
            return_value=mock_inspect,
        ):
            validator.filter = lambda: {"filters": [], "or_filter": False}
            validator._get_failed_rows_sample()

        assert validator._inspection_query == "SELECT id FROM table WHERE ..."
