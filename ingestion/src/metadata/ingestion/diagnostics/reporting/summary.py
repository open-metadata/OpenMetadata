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

A `Reporter` renders one structured summary line from its own accumulated
state. `emit_report` drives every reporter at shutdown and emits the
non-empty lines, so adding a new summary (memory, stage budget, ...) is
implement-`render()`-and-register — the shutdown path never changes.
"""

from __future__ import annotations

import logging
from typing import Protocol

from metadata.ingestion.diagnostics import emit_log


class Reporter(Protocol):
    def render(self) -> str | None:
        """Return one end-of-run summary line, or None when there is nothing to report."""


def emit_report(reporters: list[Reporter]) -> None:
    for reporter in reporters:
        line = reporter.render()
        if line:
            emit_log(logging.INFO, line)
