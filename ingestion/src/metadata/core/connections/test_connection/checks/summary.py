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
"""Count phrasing shared by the check helpers."""

from __future__ import annotations


def count(number: int, noun: str, cap: int | None = None) -> str:
    """``3 tables`` / ``1 table``; ``<cap>+`` once ``number`` reaches ``cap``.

    ``cap`` is the largest number the caller could have counted; ``None`` means
    the count is complete.
    """
    plural = noun if number == 1 else noun + "s"
    shown = f"{cap}+" if cap is not None and number >= cap else str(number)
    return f"{shown} {plural}"


def more_suffix(shown: int, more: bool) -> str:
    """`` (showing first N; more exist)`` when the listing was capped, else ``""``."""
    return f" (showing first {shown}; more exist)" if more else ""
