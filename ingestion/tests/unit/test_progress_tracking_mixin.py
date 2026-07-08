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
"""Unit tests for the shared ProgressTrackingMixin."""

from metadata.utils.progress_registry import ProgressRegistry
from metadata.utils.progress_tracking import ProgressTrackingMixin


class _Owner(ProgressTrackingMixin):
    pass


class TestProgressTrackingMixin:
    def test_lazily_creates_one_registry(self):
        owner = _Owner()
        registry = owner.progress
        assert isinstance(registry, ProgressRegistry)
        assert owner.progress is registry

    def test_exposes_the_scanned_attribute(self):
        owner = _Owner()
        _ = owner.progress
        assert owner.__dict__.get("_progress_registry") is owner.progress
