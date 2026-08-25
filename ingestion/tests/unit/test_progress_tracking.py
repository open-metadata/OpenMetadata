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
"""Unit tests for the composed ProgressTracking and its attach helper."""

from metadata.ingestion.progress.modes import ProgressMode
from metadata.ingestion.progress.registry import ProgressRegistry
from metadata.ingestion.progress.tracking import ProgressTracking, attach_progress_tracking


class _Owner:
    progress_mode = ProgressMode.AUTO


class TestAttachProgressTracking:
    def test_lazily_creates_one_tracking(self):
        owner = _Owner()
        tracking = attach_progress_tracking(owner)
        assert isinstance(tracking, ProgressTracking)
        assert isinstance(tracking.registry, ProgressRegistry)
        assert attach_progress_tracking(owner) is tracking

    def test_caches_under_the_scanned_attribute(self):
        owner = _Owner()
        tracking = attach_progress_tracking(owner)
        assert owner.__dict__.get("_progress_tracking") is tracking

    def test_defaults_to_auto_when_owner_declares_no_mode(self):
        class _NoMode:
            pass

        tracking = attach_progress_tracking(_NoMode())
        assert tracking.mode is ProgressMode.AUTO
