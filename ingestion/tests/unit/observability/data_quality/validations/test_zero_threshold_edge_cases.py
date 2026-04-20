"""
Unit tests for edge cases with zero or negative thresholds
"""

import unittest


def calculate_less_than_failure_fixed(
    threshold: int, len_rows: int, row_count: int
) -> tuple[int, int]:
    """
    Fixed implementation of _calculate_less_than_failure
    """
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

    return max(0, passed_rows), max(0, failed_rows)


def calculate_less_than_failure_old(
    threshold: int, len_rows: int, row_count: int
) -> tuple[int, int]:
    """
    Original buggy implementation for comparison
    """
    failed_rows = max(0, len_rows - threshold)
    passed_rows = (row_count - failed_rows) if row_count else threshold
    return max(0, passed_rows), max(0, failed_rows)


class TestZeroThresholdEdgeCases(unittest.TestCase):
    """Test cases for zero and negative threshold edge cases"""

    def test_bug_case_less_than_zero_threshold(self):
        """Test the reported bug case: < 0 threshold"""

        len_rows = 0
        threshold = 0
        row_count = 1

        old_passed, old_failed = calculate_less_than_failure_old(
            threshold, len_rows, row_count
        )

        new_passed, new_failed = calculate_less_than_failure_fixed(
            threshold, len_rows, row_count
        )

        print(
            f"Bug case - len_rows={len_rows}, threshold={threshold}, row_count={row_count}"
        )
        print(f"Old: passed={old_passed}, failed={old_failed}")
        print(f"New: passed={new_passed}, failed={new_failed}")

        self.assertEqual(old_passed, 1)
        self.assertEqual(old_failed, 0)

        self.assertEqual(new_passed, 0)
        self.assertEqual(new_failed, 1)

    def test_less_than_negative_threshold(self):
        """Test < -1 threshold (impossible expectation)"""
        len_rows = 5
        threshold = -1
        row_count = 100

        old_passed, old_failed = calculate_less_than_failure_old(
            threshold, len_rows, row_count
        )
        new_passed, new_failed = calculate_less_than_failure_fixed(
            threshold, len_rows, row_count
        )

        print(
            f"Negative threshold - len_rows={len_rows}, threshold={threshold}, row_count={row_count}"
        )
        print(f"Old: passed={old_passed}, failed={old_failed}")
        print(f"New: passed={new_passed}, failed={new_failed}")

        self.assertEqual(old_passed, 94)
        self.assertEqual(old_failed, 6)

        self.assertEqual(new_passed, 0)
        self.assertEqual(new_failed, 100)

    def test_less_than_zero_no_results(self):
        """Test < 0 threshold with no query results"""
        len_rows = 0
        threshold = 0
        row_count = 50

        old_passed, old_failed = calculate_less_than_failure_old(
            threshold, len_rows, row_count
        )
        new_passed, new_failed = calculate_less_than_failure_fixed(
            threshold, len_rows, row_count
        )

        print(
            f"Zero threshold, no results - len_rows={len_rows}, threshold={threshold}, row_count={row_count}"
        )
        print(f"Old: passed={old_passed}, failed={old_failed}")
        print(f"New: passed={new_passed}, failed={new_failed}")

        self.assertEqual(old_passed, 50)
        self.assertEqual(old_failed, 0)

        self.assertEqual(new_passed, 0)
        self.assertEqual(new_failed, 50)

    def test_normal_case_still_works(self):
        """Test that normal cases (threshold > 0) still work correctly"""
        len_rows = 15
        threshold = 10
        row_count = 100

        old_passed, old_failed = calculate_less_than_failure_old(
            threshold, len_rows, row_count
        )
        new_passed, new_failed = calculate_less_than_failure_fixed(
            threshold, len_rows, row_count
        )

        print(
            f"Normal case - len_rows={len_rows}, threshold={threshold}, row_count={row_count}"
        )
        print(f"Old: passed={old_passed}, failed={old_failed}")
        print(f"New: passed={new_passed}, failed={new_failed}")

        self.assertEqual(old_passed, new_passed)
        self.assertEqual(old_failed, new_failed)

        self.assertEqual(new_passed, 95)
        self.assertEqual(new_failed, 5)

    def test_edge_case_no_row_count(self):
        """Test zero threshold with no total row count available"""
        len_rows = 0
        threshold = 0
        row_count = None

        new_passed, new_failed = calculate_less_than_failure_fixed(
            threshold, len_rows, row_count
        )

        print(
            f"No row count - len_rows={len_rows}, threshold={threshold}, row_count={row_count}"
        )
        print(f"New: passed={new_passed}, failed={new_failed}")

        self.assertEqual(new_passed, 0)
        self.assertEqual(new_failed, 1)

    def test_less_than_equal_zero_with_results(self):
        """Test <= 0 threshold with some query results"""
        len_rows = 3
        threshold = 0
        row_count = 20

        old_passed, old_failed = calculate_less_than_failure_old(
            threshold, len_rows, row_count
        )
        new_passed, new_failed = calculate_less_than_failure_fixed(
            threshold, len_rows, row_count
        )

        print(
            f"<= 0 with results - len_rows={len_rows}, threshold={threshold}, row_count={row_count}"
        )
        print(f"Old: passed={old_passed}, failed={old_failed}")
        print(f"New: passed={new_passed}, failed={new_failed}")

        self.assertEqual(old_passed, 17)
        self.assertEqual(old_failed, 3)

        self.assertEqual(new_passed, 0)
        self.assertEqual(new_failed, 20)


if __name__ == "__main__":
    unittest.main()
