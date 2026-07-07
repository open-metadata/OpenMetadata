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

from metadata.utils.progress_registry import ProgressRegistry


class ProgressTrackingMixin:
    @property
    def progress(self) -> ProgressRegistry:
        """Per-Source progress registry. First access is single-threaded
        (in _iter, before worker threads spawn), so lazy init is safe."""
        registry = self.__dict__.get("_progress_registry")
        if registry is None:
            registry = ProgressRegistry()
            self.__dict__["_progress_registry"] = registry
        return registry
