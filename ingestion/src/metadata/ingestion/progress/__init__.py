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
"""Ingestion progress capturing — the single home for all progress code.

Ownership contract:

* The **connector** knows how to query the source and how to calculate totals
  (denominators). It never counts processed items.
* The **topology runner** counts processed entities for every connector by
  default.
* The **ProgressRegistry** stores the state, calculates the ETA, and reports
  it (CLI tree + SSE payload).
"""

from metadata.ingestion.progress._render import (
    format_eta,
    render_progress_tree,
    snapshot_to_progress_payload,
)
from metadata.ingestion.progress.modes import (
    ManualProgress,
    ProgressMode,
    ProgressModeError,
    TotalsDeclarer,
)
from metadata.ingestion.progress.registry import (
    DEFAULT_ACTIVE_LEAF_CAP,
    GlobalCounter,
    ProgressNode,
    ProgressNodeSnapshot,
    ProgressRegistry,
)
from metadata.ingestion.progress.tracking import ProgressTrackingMixin

__all__ = [
    "DEFAULT_ACTIVE_LEAF_CAP",
    "GlobalCounter",
    "ManualProgress",
    "ProgressMode",
    "ProgressModeError",
    "ProgressNode",
    "ProgressNodeSnapshot",
    "ProgressRegistry",
    "ProgressTrackingMixin",
    "TotalsDeclarer",
    "format_eta",
    "render_progress_tree",
    "snapshot_to_progress_payload",
]
