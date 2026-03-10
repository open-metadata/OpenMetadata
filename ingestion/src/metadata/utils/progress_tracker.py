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
Progress Tracker Module

Provides singleton-based progress tracking for ingestion pipelines with
ETA estimation based on processing rates.
"""

import threading
from time import time
from typing import Dict, Optional

from pydantic import BaseModel, Field

from metadata.utils.singleton import Singleton


class EntityProgress(BaseModel):
    """Progress tracking for a specific entity type"""

    total: int = Field(default=0, description="Total entities to process")
    processed: int = Field(default=0, description="Entities processed so far")
    start_time: Optional[float] = Field(
        default=None, description="When processing started"
    )
    processing_times: list = Field(
        default_factory=list, description="Rolling window of processing times"
    )

    class Config:
        arbitrary_types_allowed = True

    def estimate_remaining_seconds(self) -> Optional[int]:
        """
        Calculate estimated remaining time based on average processing time.
        Uses a rolling window of the last 100 processing times for accuracy.
        """
        if not self.processing_times or self.processed >= self.total:
            return None

        window = self.processing_times[-100:]
        avg_time = sum(window) / len(window)
        remaining = self.total - self.processed
        return int(avg_time * remaining)

    def get_processing_rate(self) -> Optional[float]:
        """Get current processing rate (entities per second)"""
        if not self.processing_times:
            return None
        window = self.processing_times[-100:]
        avg_time = sum(window) / len(window)
        return 1.0 / avg_time if avg_time > 0 else None

    def to_dict(self) -> Dict:
        """Convert to dictionary for API response"""
        return {
            "total": self.total,
            "processed": self.processed,
            "estimatedRemainingSeconds": self.estimate_remaining_seconds(),
        }


class ProgressTrackerState(metaclass=Singleton):
    """
    Thread-safe singleton for tracking progress across entity types.

    Tracks total counts, processed counts, and processing times to
    calculate ETA for each entity type (Database, Schema, Table, etc.).
    """

    def __init__(self):
        self._progress: Dict[str, EntityProgress] = {}
        self._lock = threading.Lock()
        self._rolling_window_size = 100

    def set_total(self, entity_type: str, total: int) -> None:
        """
        Set the total count for an entity type.
        Called when entity count is discovered before processing.

        Args:
            entity_type: Entity type name (e.g., "Database", "Table")
            total: Total number of entities to process
        """
        with self._lock:
            if entity_type not in self._progress:
                self._progress[entity_type] = EntityProgress()
            self._progress[entity_type].total = total
            self._progress[entity_type].start_time = time()
            self._progress[entity_type].processed = 0
            self._progress[entity_type].processing_times = []

    def add_to_total(self, entity_type: str, count: int) -> None:
        """
        Add to the total count for an entity type.
        Used when totals are discovered incrementally.

        Args:
            entity_type: Entity type name
            count: Additional count to add
        """
        with self._lock:
            if entity_type not in self._progress:
                self._progress[entity_type] = EntityProgress()
                self._progress[entity_type].start_time = time()
            self._progress[entity_type].total += count

    def increment_processed(
        self, entity_type: str, processing_time: Optional[float] = None
    ) -> None:
        """
        Increment processed count and optionally record processing time.

        Args:
            entity_type: Entity type name
            processing_time: Time taken to process this entity (in seconds)
        """
        with self._lock:
            if entity_type not in self._progress:
                self._progress[entity_type] = EntityProgress()

            self._progress[entity_type].processed += 1

            if processing_time is not None:
                times = self._progress[entity_type].processing_times
                times.append(processing_time)
                if len(times) > self._rolling_window_size:
                    self._progress[entity_type].processing_times = times[
                        -self._rolling_window_size :
                    ]

    def get_progress(self, entity_type: str) -> Optional[EntityProgress]:
        """Get progress for a specific entity type"""
        with self._lock:
            return (
                self._progress[entity_type].model_copy()
                if entity_type in self._progress
                else None
            )

    def get_all_progress(self) -> Dict[str, EntityProgress]:
        """Get progress snapshot for all entity types"""
        with self._lock:
            return {k: v.model_copy() for k, v in self._progress.items()}

    def get_progress_as_dict(self) -> Dict[str, Dict]:
        """Get progress as dictionary for API response"""
        with self._lock:
            return {k: v.to_dict() for k, v in self._progress.items()}

    def reset(self) -> None:
        """Reset all progress tracking"""
        with self._lock:
            self._progress.clear()

    def reset_entity(self, entity_type: str) -> None:
        """Reset progress for a specific entity type"""
        with self._lock:
            if entity_type in self._progress:
                del self._progress[entity_type]
