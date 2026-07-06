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
"""Shared mixin that lazily owns a per-source ProgressRegistry.

Any Source that mixes this in gets a ``progress`` registry discoverable by the
workflow reporter (which scans steps for the ``_progress_registry`` attribute),
without participating in the topology runner.
"""

from typing import ClassVar

from metadata.ingestion.progress.modes import (
    ManualProgress,
    ProgressMode,
    ProgressModeError,
    TotalsDeclarer,
)
from metadata.ingestion.progress.registry import ProgressRegistry


class ProgressTrackingMixin:
    progress_mode: ClassVar[ProgressMode] = ProgressMode.AUTO
    """AUTO (default): the topology runner counts processed entities.
    MANUAL: the runner makes zero progress calls; the source drives
    ``manual_progress`` itself. OFF: no progress at all."""

    @property
    def progress(self) -> ProgressRegistry:
        """Per-Source progress registry. First access is single-threaded
        (in _iter, before worker threads spawn), so lazy init is safe."""
        registry = self.__dict__.get("_progress_registry")
        if registry is None:
            registry = ProgressRegistry()
            self.__dict__["_progress_registry"] = registry
        return registry

    @property
    def manual_progress(self) -> ManualProgress:
        """MANUAL-mode counting facade. Raises for AUTO/OFF sources — the
        runner counts AUTO sources, so a manual increment would double-count."""
        if self.progress_mode is not ProgressMode.MANUAL:
            raise ProgressModeError(
                f"manual_progress requires progress_mode=MANUAL, but {type(self).__name__} "
                f"declares {self.progress_mode.name}. AUTO sources are counted by the topology "
                "runner and may only declare totals via declare_progress_totals()."
            )
        facade = self.__dict__.get("_manual_progress")
        if facade is None:
            facade = ManualProgress(self.progress)
            self.__dict__["_manual_progress"] = facade
        return facade

    def declare_progress_totals(self, totals: TotalsDeclarer) -> None:
        """Optional connector hook: declare denominators (totals) so the run
        renders % and ETA. Called exactly once by the topology runner, just
        before the first non-root node is processed. Default: no totals."""
