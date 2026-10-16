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
"""Unit tests for the diagnostics Reporter keystone (emit_report)."""

import logging
from unittest.mock import patch

from metadata.ingestion.diagnostics.reporting.summary import emit_report


class _FakeReporter:
    def __init__(self, line: str | None) -> None:
        self._line = line

    def render_summary(self) -> str | None:
        return self._line


def test_emit_report_skips_reporters_with_no_data():
    with patch("metadata.ingestion.diagnostics.reporting.summary.emit_log") as spy:
        emit_report([_FakeReporter(None)])
    spy.assert_not_called()


def test_emit_report_emits_a_non_empty_line():
    with patch("metadata.ingestion.diagnostics.reporting.summary.emit_log") as spy:
        emit_report([_FakeReporter("diag.time_budget elapsed=1.0s")])
    spy.assert_called_once_with(logging.INFO, "diag.time_budget elapsed=1.0s")


def test_emit_report_emits_only_reporters_that_have_data():
    reporters = [_FakeReporter(None), _FakeReporter("a"), _FakeReporter(""), _FakeReporter("b")]
    with patch("metadata.ingestion.diagnostics.reporting.summary.emit_log") as spy:
        emit_report(reporters)
    emitted = [call.args for call in spy.call_args_list]
    assert emitted == [(logging.INFO, "a"), (logging.INFO, "b")]
