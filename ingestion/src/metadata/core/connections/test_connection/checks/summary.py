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
Phrasing for what a check found.

Every check reports a count of something it enumerated, and every listing probe
is bounded, so the count is a sample rather than a total. These helpers render
both facts the same way whatever the client is - SQL, boto3, or REST - so the
summaries read consistently across connectors.
"""

from __future__ import annotations


def count(number: int, noun: str, cap: int | None = None) -> str:
    """``3 tables`` / ``1 table`` - pluralize the noun to match the count.

    When ``cap`` is given and the count meets or exceeds it, the figure is
    rendered ``<cap>+`` so a capped sample is not read as an exact total. The
    caller caps ``number`` at ``cap`` first, so this only ever renders ``<cap>+``
    at the boundary, never a larger bare number.
    """
    plural = noun if number == 1 else noun + "s"
    shown = f"{cap}+" if cap is not None and number >= cap else str(number)
    return f"{shown} {plural}"


def more_suffix(shown: int, more: bool) -> str:
    """Mark a summary as capped when the listing has more assets beyond ``shown``."""
    return f" (showing first {shown}; more exist)" if more else ""
