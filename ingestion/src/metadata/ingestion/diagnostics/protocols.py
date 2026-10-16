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
Per-occasion rendering contracts: one Protocol per reporting occasion. An
aspect implements only the protocols it has data for.
"""

from typing import Protocol, TextIO, runtime_checkable


@runtime_checkable
class HasInstant(Protocol):
    """Aspect contributes a field to the periodic heartbeat line."""

    def render_instant(self) -> str:
        """Terse heartbeat field; the leading space is included in the return."""
        ...


@runtime_checkable
class HasDump(Protocol):
    """Aspect contributes a section to an on-demand dump."""

    def render_dump(self, out: TextIO) -> None:
        """Write a snapshot fragment to `out`."""
        ...


@runtime_checkable
class HasSummary(Protocol):
    """Aspect contributes a line to the end-of-run summary."""

    def render_summary(self) -> str | None:
        """One end-of-run summary line, or None to skip this run."""
        ...
