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
Tests for metadata.ingestion.api.status.Status
"""
from unittest import TestCase

from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.ingestion.api.status import (
    MAX_STACK_TRACE_LENGTH,
    MAX_STATUS_DISPLAY_ITEMS,
    Status,
    TruncatedStackTraceError,
)


class TestStatus(TestCase):
    """Tests for the Status model."""

    def setUp(self):
        self.status = Status()

    # ── as_string ────────────────────────────────────────────────────

    def test_as_string_small_list_renders_all_items(self):
        """Lists within the limit should appear in full."""
        items = [f"record_{i}" for i in range(10)]
        self.status.records = items

        output = self.status.as_string()
        for item in items:
            self.assertIn(item, output)
        self.assertNotIn("total items", output)

    def test_as_string_large_list_is_truncated(self):
        """Lists exceeding MAX_STATUS_DISPLAY_ITEMS should be truncated."""
        total = MAX_STATUS_DISPLAY_ITEMS + 500
        self.status.records = [f"record_{i}" for i in range(total)]

        output = self.status.as_string()
        self.assertIn(f"{total} total items", output)
        self.assertIn(f"showing first {MAX_STATUS_DISPLAY_ITEMS}", output)
        self.assertIn("record_0", output)
        self.assertNotIn(f"record_{total - 1}", output)

    def test_as_string_at_limit_not_truncated(self):
        """A list with exactly MAX_STATUS_DISPLAY_ITEMS should NOT be truncated."""
        self.status.records = [f"record_{i}" for i in range(MAX_STATUS_DISPLAY_ITEMS)]

        output = self.status.as_string()
        self.assertNotIn("total items", output)
        self.assertIn("record_0", output)
        self.assertIn(f"record_{MAX_STATUS_DISPLAY_ITEMS - 1}", output)

    def test_as_string_multiple_large_lists_each_truncated(self):
        """Each list field should be truncated independently."""
        total = MAX_STATUS_DISPLAY_ITEMS + 100
        self.status.records = [f"record_{i}" for i in range(total)]
        self.status.warnings = [{f"warn_{i}": "reason"} for i in range(total)]

        output = self.status.as_string()
        self.assertEqual(output.count("total items"), 2)

    def test_as_string_non_list_fields_unchanged(self):
        """Non-list fields like record_count should render normally."""
        self.status.record_count = 42

        output = self.status.as_string()
        self.assertIn("42", output)

    def test_as_string_no_escaped_newlines(self):
        """Truncated output should not contain escaped newline characters."""
        self.status.records = [
            f"record_{i}" for i in range(MAX_STATUS_DISPLAY_ITEMS + 10)
        ]

        output = self.status.as_string()
        self.assertNotIn("\\n", output)

    # ── failed / fail_all ────────────────────────────────────────────

    def test_failed_appends_to_failures(self):
        error = StackTraceError(
            name="test", error="something broke", stackTrace="traceback..."
        )
        self.status.failed(error)

        self.assertEqual(len(self.status.failures), 1)
        self.assertEqual(self.status.failures[0].error, "something broke")

    def test_fail_all_extends_failures(self):
        errors = [
            StackTraceError(name=f"e{i}", error=f"err_{i}", stackTrace="tb")
            for i in range(3)
        ]
        self.status.fail_all(errors)

        self.assertEqual(len(self.status.failures), 3)

    # ── calculate_success ────────────────────────────────────────────

    def test_calculate_success_no_failures(self):
        self.status.records = ["a", "b", "c"]
        self.assertEqual(self.status.calculate_success(), 100.0)

    def test_calculate_success_with_failures(self):
        self.status.records = ["a", "b", "c"]
        self.status.failures = [TruncatedStackTraceError(name="x", error="err")]
        # 3 records, 1 failure → 3 / (3+1) = 75.0
        self.assertEqual(self.status.calculate_success(), 75.0)

    def test_calculate_success_empty_status(self):
        """Empty status should not raise ZeroDivisionError."""
        result = self.status.calculate_success()
        self.assertEqual(result, 100.0)

    def test_calculate_success_uses_record_count_when_set(self):
        self.status.record_count = 10
        self.status.records = ["a"]  # should be ignored
        self.status.failures = [TruncatedStackTraceError(name="x", error="err")]
        # 10 / (10+1) ≈ 90.91
        self.assertEqual(self.status.calculate_success(), 90.91)

    # ── warning / filter ─────────────────────────────────────────────

    def test_warning_appends_dict(self):
        self.status.warning("entity_name", "some reason")
        self.assertEqual(self.status.warnings, [{"entity_name": "some reason"}])

    def test_filter_appends_dict(self):
        self.status.filter("entity_name", "filtered out")
        self.assertEqual(self.status.filtered, [{"entity_name": "filtered out"}])

    # ── truncation of stack traces ───────────────────────────────────

    def test_truncated_stack_trace_error_limits_length(self):
        long_error = "x" * (MAX_STACK_TRACE_LENGTH + 1000)
        truncated = TruncatedStackTraceError(name="t", error=long_error)
        self.assertEqual(len(truncated.error), MAX_STACK_TRACE_LENGTH)
