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
"""Progress modes and the two connector-facing facades.

``TotalsDeclarer`` is denominator-only: an AUTO connector's
``declare_progress_totals`` hook receives it and structurally cannot increment
processed counts. ``ManualProgress`` is the MANUAL-mode escape hatch: the
runner makes zero progress calls and the connector drives counting itself —
auto XOR manual, never both.
"""

from enum import Enum
from typing import TYPE_CHECKING, Dict, Optional  # noqa: UP035

if TYPE_CHECKING:
    from metadata.ingestion.progress.registry import ProgressRegistry


class ProgressMode(Enum):
    AUTO = "auto"
    MANUAL = "manual"
    OFF = "off"


class ProgressModeError(RuntimeError):
    """A source used a progress API its declared ``progress_mode`` forbids."""


class TotalsDeclarer:
    """Denominator-only view of the registry, handed to
    ``declare_progress_totals``. Declarations feed % and ETA; they never
    increment ``processed``."""

    def __init__(self, registry: "ProgressRegistry") -> None:
        self._registry = registry

    def set_total(self, entity_type: str, total: Optional[int]) -> None:  # noqa: UP045
        self._registry.set_total(entity_type, total)

    def seed_scope_total(self, entity_type: str, scope: str, n: int) -> None:
        self._registry.seed_scope_total(entity_type, scope, n)

    def mark_reconcilable(self, entity_type: str) -> None:
        """Declare that the connector cannot pre-count ``entity_type``; the
        runner will build the total from observed scope counts instead."""
        self._registry.set_reconcilable(entity_type)


class ManualProgress:
    """Counting facade for ``ProgressMode.MANUAL`` sources — connectors whose
    enumeration the topology runner cannot count (grouped dashboard walks,
    custom ``_iter`` query sources)."""

    def __init__(self, registry: "ProgressRegistry") -> None:
        self._registry = registry
        self._group_label: Optional[str] = None  # noqa: UP045

    def set_total(self, entity_type: str, total: Optional[int]) -> None:  # noqa: UP045
        self._registry.set_total(entity_type, total)

    def track(self, entity_type: Optional[str], n: int = 1) -> None:  # noqa: UP045
        self._registry.track(entity_type, n)

    def seed_scope_total(self, entity_type: str, scope: str, n: int) -> None:
        self._registry.seed_scope_total(entity_type, scope, n)

    def reconcile_scope_total(self, entity_type: Optional[str], scope: str, observed: int) -> None:  # noqa: UP045
        self._registry.reconcile_scope_total(entity_type, scope, observed)

    def declare_groups(self, label: str, total: Optional[int]) -> None:  # noqa: UP045
        """Declare the grouping axis (e.g. workspaces) as a global counter and
        remember its label so ``close_group`` can count completions on it."""
        self._group_label = label
        self._registry.set_total(label, total)
        self._registry.open([], label, total)

    def open_group(self, group: str, expected_by_type: Dict[str, Optional[int]]) -> None:  # noqa: UP006,UP045
        """Open one child node per asset type under ``group``; ``expected`` may
        be None for lazy (running) counts."""
        for asset_type, expected in expected_by_type.items():
            self._registry.open([group, asset_type], asset_type, expected)

    def advance(self, group: str, asset_type: str) -> None:
        self._registry.advance([group, asset_type], asset_type)

    def close_group(self, group: str) -> None:
        """Count the finished group on its global counter and prune its subtree."""
        if self._group_label is not None:
            self._registry.track(self._group_label)
        self._registry.close([group])
