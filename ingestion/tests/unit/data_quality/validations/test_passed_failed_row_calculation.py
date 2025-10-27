"""
Unit tests for passed/failed row count calculation logic
"""

import unittest


def calculate_passed_failed_rows(
    test_passed: bool,
    operator: str,
    threshold: int,
    actual_rows: int,
    total_rows: int = None,
):
    """
    Calculate passed and failed rows based on test result, operator, threshold, and actual row count.

    This function replicates the LEGACY logic for cases without total row count.
    Note: This is kept for backward compatibility but the new logic with total_rows is more accurate.
    """
    if total_rows is None:
        if test_passed:
            return actual_rows, 0
        else:
            if operator in (">", ">="):
                failed_rows = 0
                passed_rows = actual_rows
            elif operator in ("<", "<="):
                failed_rows = max(0, actual_rows - threshold)
                passed_rows = threshold
            elif operator == "==":
                failed_rows = abs(actual_rows - threshold)
                passed_rows = 0
            else:
                failed_rows = actual_rows
                passed_rows = 0

            return max(0, passed_rows), max(0, failed_rows)
    else:

        raise NotImplementedError(
            "Use test_row_count_logic_with_total.py for total row count tests"
        )


class TestPassedFailedRowCalculation(unittest.TestCase):
    """Test cases for passed/failed row count calculation logic"""

    def test_greater_than_operator_success(self):
        """Test > operator when test passes"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=True, operator=">", threshold=5, actual_rows=10
        )
        self.assertEqual(passed_rows, 10)
        self.assertEqual(failed_rows, 0)

    def test_greater_than_operator_failure(self):
        """Test > operator when test fails (got fewer rows than expected)"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=False, operator=">", threshold=10, actual_rows=5
        )
        self.assertEqual(passed_rows, 5)
        self.assertEqual(failed_rows, 0)

    def test_greater_than_equal_operator_success(self):
        """Test >= operator when test passes"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=True, operator=">=", threshold=10, actual_rows=10
        )
        self.assertEqual(passed_rows, 10)
        self.assertEqual(failed_rows, 0)

    def test_greater_than_equal_operator_failure(self):
        """Test >= operator when test fails"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=False, operator=">=", threshold=15, actual_rows=8
        )
        self.assertEqual(passed_rows, 8)
        self.assertEqual(failed_rows, 0)

    def test_less_than_operator_success(self):
        """Test < operator when test passes"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=True, operator="<", threshold=10, actual_rows=5
        )
        self.assertEqual(passed_rows, 5)
        self.assertEqual(failed_rows, 0)

    def test_less_than_operator_failure(self):
        """Test < operator when test fails (got more rows than expected)"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=False, operator="<", threshold=5, actual_rows=12
        )
        self.assertEqual(passed_rows, 5)
        self.assertEqual(failed_rows, 7)

    def test_less_than_equal_operator_success(self):
        """Test <= operator when test passes"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=True, operator="<=", threshold=10, actual_rows=10
        )
        self.assertEqual(passed_rows, 10)
        self.assertEqual(failed_rows, 0)

    def test_less_than_equal_operator_failure(self):
        """Test <= operator when test fails"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=False, operator="<=", threshold=8, actual_rows=15
        )
        self.assertEqual(passed_rows, 8)
        self.assertEqual(failed_rows, 7)

    def test_equal_operator_success(self):
        """Test == operator when test passes"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=True, operator="==", threshold=10, actual_rows=10
        )
        self.assertEqual(passed_rows, 10)
        self.assertEqual(failed_rows, 0)

    def test_equal_operator_failure_more_rows(self):
        """Test == operator when test fails with more rows than expected"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=False, operator="==", threshold=10, actual_rows=15
        )
        self.assertEqual(passed_rows, 0)
        self.assertEqual(failed_rows, 5)

    def test_equal_operator_failure_fewer_rows(self):
        """Test == operator when test fails with fewer rows than expected"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=False, operator="==", threshold=10, actual_rows=3
        )
        self.assertEqual(passed_rows, 0)
        self.assertEqual(failed_rows, 7)

    def test_edge_case_zero_threshold_greater_than(self):
        """Test edge case with zero threshold and > operator"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=True, operator=">", threshold=0, actual_rows=5
        )
        self.assertEqual(passed_rows, 5)
        self.assertEqual(failed_rows, 0)

    def test_edge_case_zero_actual_rows_less_than(self):
        """Test edge case with zero actual rows and < operator"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=True, operator="<", threshold=5, actual_rows=0
        )
        self.assertEqual(passed_rows, 0)
        self.assertEqual(failed_rows, 0)

    def test_edge_case_negative_protection_greater_than_equal(self):
        """Test protection against negative calculations for >= operator"""

        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=True, operator=">=", threshold=5, actual_rows=10
        )
        self.assertEqual(passed_rows, 10)
        self.assertEqual(failed_rows, 0)

    def test_equal_operator_with_zero_threshold(self):
        """Test == operator with zero threshold"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=False, operator="==", threshold=0, actual_rows=5
        )
        self.assertEqual(passed_rows, 0)
        self.assertEqual(failed_rows, 5)

    def test_unknown_operator_fallback(self):
        """Test fallback for unknown operators"""
        passed_rows, failed_rows = calculate_passed_failed_rows(
            test_passed=False, operator="!=", threshold=10, actual_rows=15
        )
        self.assertEqual(passed_rows, 0)
        self.assertEqual(failed_rows, 15)


if __name__ == "__main__":
    unittest.main()
