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
"""End-of-run summary reporting.

`emit_report` drives every `HasSummary` participant at shutdown and emits the
non-empty lines. Adding a new summary (memory, time budget, …) is
implement-`render_summary`-and-include-in-aspects — the shutdown path never
changes.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from metadata.ingestion.diagnostics.kernel import emit_log

if TYPE_CHECKING:
    from collections.abc import Iterable

    from metadata.ingestion.diagnostics.protocols import HasSummary


def emit_report(summary_lines: Iterable[HasSummary]) -> None:
    """Fan out `render_summary()` over the participants; emit the non-empty lines."""
    for participant in summary_lines:
        line = participant.render_summary()
        if line:
            emit_log(logging.INFO, line)
