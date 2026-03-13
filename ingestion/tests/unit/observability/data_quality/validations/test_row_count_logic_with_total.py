"""
Unit tests for passed/failed row count calculation with total row count
"""

import unittest


def calculate_passed_failed_rows_with_total(
    test_passed: bool,
    operator: str,
    threshold: int,
    actual_rows: int,
    total_rows: int = None,
):
    """
    Calculate passed and failed rows considering total row count.

    This replicates the fixed logic from BaseTableCustomSQLQueryValidator.
    """
    row_count = total_rows
    len_rows = actual_rows

    if test_passed:

        if operator in (">", ">=", "=="):

            passed_rows = len_rows
            failed_rows = (row_count - len_rows) if row_count else 0
        elif operator in ("<", "<="):

            passed_rows = row_count if row_count else len_rows
            failed_rows = 0
        else:

            passed_rows = len_rows
            failed_rows = 0
    else:

        if operator in (">", ">="):

            passed_rows = len_rows
            failed_rows = (row_count - len_rows) if row_count else 0
        elif operator in ("<", "<="):

            if threshold <= 0:

                if row_count:
                    failed_rows = row_count
                    passed_rows = 0
                else:

                    failed_rows = max(len_rows, 1)
                    passed_rows = 0
            else:

                failed_rows = max(0, len_rows - threshold)
                passed_rows = (row_count - failed_rows) if row_count else threshold
        elif operator == "==":

            if row_count:

                if len_rows > threshold:

                    failed_rows = len_rows - threshold
                    passed_rows = row_count - failed_rows
                else:

                    failed_rows = row_count - len_rows
                    passed_rows = len_rows
            else:

                failed_rows = abs(len_rows - threshold)
                passed_rows = 0
        else:

            failed_rows = row_count if row_count else len_rows
            passed_rows = 0

    passed_rows = max(0, passed_rows)
    failed_rows = max(0, failed_rows)

    return passed_rows, failed_rows


class TestPassedFailedRowCalculationWithTotal(unittest.TestCase):
    """Test cases for the fixed row count calculation logic with total row count"""

    def test_greater_than_operator_bug_case(self):
        """Test the bug case: >= with threshold 0, 0 rows returned, 1 total row"""

        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=False,
            operator=">=",
            threshold=1,
            actual_rows=0,
            total_rows=1,
        )

        self.assertEqual(passed_rows, 0)
        self.assertEqual(failed_rows, 1)

    def test_greater_than_with_total_rows_success(self):
        """Test > operator success with total row count"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=True,
            operator=">",
            threshold=5,
            actual_rows=10,
            total_rows=100,
        )
        self.assertEqual(passed_rows, 10)
        self.assertEqual(failed_rows, 90)

    def test_greater_than_with_total_rows_failure(self):
        """Test > operator failure with total row count"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=False,
            operator=">",
            threshold=50,
            actual_rows=10,
            total_rows=100,
        )

        self.assertEqual(passed_rows, 10)
        self.assertEqual(failed_rows, 90)

    def test_less_than_with_total_rows_success(self):
        """Test < operator success with total row count"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=True,
            operator="<",
            threshold=10,
            actual_rows=5,
            total_rows=100,
        )

        self.assertEqual(passed_rows, 100)
        self.assertEqual(failed_rows, 0)

    def test_less_than_with_total_rows_failure(self):
        """Test < operator failure with total row count"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=False,
            operator="<",
            threshold=10,
            actual_rows=20,
            total_rows=100,
        )

        self.assertEqual(failed_rows, 10)
        self.assertEqual(passed_rows, 90)

    def test_less_than_equal_with_total_rows_success(self):
        """Test <= operator success with total row count"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=True,
            operator="<=",
            threshold=10,
            actual_rows=10,
            total_rows=100,
        )
        self.assertEqual(passed_rows, 100)
        self.assertEqual(failed_rows, 0)

    def test_less_than_equal_with_total_rows_failure(self):
        """Test <= operator failure with total row count"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=False,
            operator="<=",
            threshold=5,
            actual_rows=15,
            total_rows=100,
        )

        self.assertEqual(failed_rows, 10)
        self.assertEqual(passed_rows, 90)

    def test_equal_with_total_rows_success(self):
        """Test == operator success with total row count"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=True,
            operator="==",
            threshold=10,
            actual_rows=10,
            total_rows=100,
        )
        self.assertEqual(passed_rows, 10)
        self.assertEqual(failed_rows, 90)

    def test_equal_with_total_rows_failure_too_many(self):
        """Test == operator failure with too many rows"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=False,
            operator="==",
            threshold=10,
            actual_rows=15,
            total_rows=100,
        )

        self.assertEqual(failed_rows, 5)
        self.assertEqual(passed_rows, 95)

    def test_equal_with_total_rows_failure_too_few(self):
        """Test == operator failure with too few rows"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=False,
            operator="==",
            threshold=10,
            actual_rows=3,
            total_rows=100,
        )

        self.assertEqual(failed_rows, 97)
        self.assertEqual(passed_rows, 3)

    def test_edge_case_zero_total_rows(self):
        """Test edge case with zero total rows"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=False, operator=">", threshold=5, actual_rows=0, total_rows=0
        )
        self.assertEqual(passed_rows, 0)
        self.assertEqual(failed_rows, 0)

    def test_edge_case_no_total_row_count(self):
        """Test when total row count is not available (None)"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=False,
            operator=">",
            threshold=10,
            actual_rows=5,
            total_rows=None,
        )

        self.assertEqual(passed_rows, 5)
        self.assertEqual(failed_rows, 0)

    def test_greater_equal_zero_threshold_zero_result(self):
        """Test >= 0 with 0 results but rows in table"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=True,
            operator=">=",
            threshold=0,
            actual_rows=0,
            total_rows=100,
        )
        self.assertEqual(passed_rows, 0)
        self.assertEqual(failed_rows, 100)

    def test_all_rows_match_greater_than(self):
        """Test when all rows in table match the condition for >"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=True,
            operator=">",
            threshold=5,
            actual_rows=100,
            total_rows=100,
        )
        self.assertEqual(passed_rows, 100)
        self.assertEqual(failed_rows, 0)

    def test_no_rows_match_less_than(self):
        """Test when no rows match the condition for <"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=True,
            operator="<",
            threshold=10,
            actual_rows=0,
            total_rows=100,
        )
        self.assertEqual(passed_rows, 100)
        self.assertEqual(failed_rows, 0)

    def test_less_than_zero_threshold_failure_bug_case(self):
        """Test the reported bug case: < 0 threshold with failure"""

        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=False,
            operator="<",
            threshold=0,
            actual_rows=0,
            total_rows=1,
        )

        self.assertEqual(passed_rows, 0)
        self.assertEqual(failed_rows, 1)

    def test_less_than_negative_threshold_failure(self):
        """Test < -1 threshold failure (impossible expectation)"""
        passed_rows, failed_rows = calculate_passed_failed_rows_with_total(
            test_passed=False,
            operator="<",
            threshold=-1,
            actual_rows=5,
            total_rows=100,
        )

        self.assertEqual(passed_rows, 0)
        self.assertEqual(failed_rows, 100)


if __name__ == "__main__":
    unittest.main()
