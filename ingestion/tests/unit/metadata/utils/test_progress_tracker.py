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

"""Tests for the ProgressTrackerState singleton"""

import threading

import pytest

from metadata.utils.progress_tracker import EntityProgress, ProgressTrackerState
from metadata.utils.singleton import Singleton


class TestEntityProgress:
    """Tests for EntityProgress model"""

    def test_estimate_remaining_seconds_returns_none_when_no_times(self) -> None:
        progress = EntityProgress(total=100, processed=10)
        assert progress.estimate_remaining_seconds() is None

    def test_estimate_remaining_seconds_returns_none_when_complete(self) -> None:
        progress = EntityProgress(
            total=100, processed=100, processing_times=[0.1, 0.2, 0.15]
        )
        assert progress.estimate_remaining_seconds() is None

    def test_estimate_remaining_seconds_calculates_correctly(self) -> None:
        progress = EntityProgress(
            total=100, processed=50, processing_times=[1.0, 1.0, 1.0]
        )
        remaining = progress.estimate_remaining_seconds()
        assert remaining == 50  # 50 remaining * 1.0 avg time

    def test_estimate_remaining_uses_rolling_window(self) -> None:
        times = [10.0] * 50 + [1.0] * 100
        progress = EntityProgress(total=200, processed=100, processing_times=times)
        remaining = progress.estimate_remaining_seconds()
        assert remaining == 100  # Uses last 100 times (avg 1.0) * 100 remaining

    def test_get_processing_rate_returns_none_when_no_times(self) -> None:
        progress = EntityProgress(total=100, processed=10)
        assert progress.get_processing_rate() is None

    def test_get_processing_rate_calculates_correctly(self) -> None:
        progress = EntityProgress(
            total=100, processed=50, processing_times=[0.5, 0.5, 0.5]
        )
        rate = progress.get_processing_rate()
        assert rate == 2.0  # 1 / 0.5 = 2 entities per second

    def test_to_dict_format(self) -> None:
        progress = EntityProgress(
            total=100, processed=25, processing_times=[2.0, 2.0, 2.0]
        )
        result = progress.to_dict()
        assert result["total"] == 100
        assert result["processed"] == 25
        assert result["estimatedRemainingSeconds"] == 150  # 75 remaining * 2.0 avg


class TestProgressTrackerState:
    """Tests for ProgressTrackerState singleton"""

    @pytest.fixture(autouse=True)
    def reset_singleton(self):
        """Reset singleton state before each test"""
        Singleton.clear_all()
        yield
        Singleton.clear_all()

    def test_singleton_returns_same_instance(self) -> None:
        tracker1 = ProgressTrackerState()
        tracker2 = ProgressTrackerState()
        assert tracker1 is tracker2

    def test_set_total_initializes_progress(self) -> None:
        tracker = ProgressTrackerState()
        tracker.set_total("Table", 100)

        progress = tracker.get_progress("Table")
        assert progress is not None
        assert progress.total == 100
        assert progress.processed == 0
        assert progress.start_time is not None

    def test_set_total_resets_existing_progress(self) -> None:
        tracker = ProgressTrackerState()
        tracker.set_total("Table", 50)
        tracker.increment_processed("Table", 0.1)

        tracker.set_total("Table", 100)
        progress = tracker.get_progress("Table")
        assert progress.total == 100
        assert progress.processed == 0
        assert len(progress.processing_times) == 0

    def test_add_to_total_increments_total(self) -> None:
        tracker = ProgressTrackerState()
        tracker.add_to_total("Table", 50)
        tracker.add_to_total("Table", 30)

        progress = tracker.get_progress("Table")
        assert progress.total == 80

    def test_increment_processed_updates_count(self) -> None:
        tracker = ProgressTrackerState()
        tracker.set_total("Table", 100)

        tracker.increment_processed("Table", 0.1)
        tracker.increment_processed("Table", 0.2)

        progress = tracker.get_progress("Table")
        assert progress.processed == 2
        assert len(progress.processing_times) == 2

    def test_increment_processed_creates_entry_if_not_exists(self) -> None:
        tracker = ProgressTrackerState()
        tracker.increment_processed("Table", 0.1)

        progress = tracker.get_progress("Table")
        assert progress is not None
        assert progress.processed == 1

    def test_increment_processed_without_time(self) -> None:
        tracker = ProgressTrackerState()
        tracker.set_total("Table", 100)
        tracker.increment_processed("Table")

        progress = tracker.get_progress("Table")
        assert progress.processed == 1
        assert len(progress.processing_times) == 0

    def test_rolling_window_limits_processing_times(self) -> None:
        tracker = ProgressTrackerState()
        tracker.set_total("Table", 200)

        for i in range(150):
            tracker.increment_processed("Table", float(i))

        progress = tracker.get_progress("Table")
        assert progress.processed == 150
        assert len(progress.processing_times) == 100

    def test_get_progress_returns_none_for_unknown_entity(self) -> None:
        tracker = ProgressTrackerState()
        assert tracker.get_progress("Unknown") is None

    def test_get_progress_returns_copy(self) -> None:
        tracker = ProgressTrackerState()
        tracker.set_total("Table", 100)

        progress1 = tracker.get_progress("Table")
        progress1.processed = 999  # Modify the copy

        progress2 = tracker.get_progress("Table")
        assert progress2.processed == 0  # Original unchanged

    def test_get_all_progress_returns_all_entities(self) -> None:
        tracker = ProgressTrackerState()
        tracker.set_total("Table", 100)
        tracker.set_total("Database", 10)
        tracker.set_total("Schema", 50)

        all_progress = tracker.get_all_progress()
        assert len(all_progress) == 3
        assert "Table" in all_progress
        assert "Database" in all_progress
        assert "Schema" in all_progress

    def test_get_progress_as_dict_format(self) -> None:
        tracker = ProgressTrackerState()
        tracker.set_total("Table", 100)
        tracker.increment_processed("Table", 1.0)

        result = tracker.get_progress_as_dict()
        assert "Table" in result
        assert result["Table"]["total"] == 100
        assert result["Table"]["processed"] == 1
        assert "estimatedRemainingSeconds" in result["Table"]

    def test_reset_clears_all_progress(self) -> None:
        tracker = ProgressTrackerState()
        tracker.set_total("Table", 100)
        tracker.set_total("Database", 10)

        tracker.reset()

        assert tracker.get_progress("Table") is None
        assert tracker.get_progress("Database") is None
        assert len(tracker.get_all_progress()) == 0

    def test_reset_entity_clears_specific_entity(self) -> None:
        tracker = ProgressTrackerState()
        tracker.set_total("Table", 100)
        tracker.set_total("Database", 10)

        tracker.reset_entity("Table")

        assert tracker.get_progress("Table") is None
        assert tracker.get_progress("Database") is not None

    def test_reset_entity_does_not_raise_for_unknown_entity(self) -> None:
        tracker = ProgressTrackerState()
        tracker.reset_entity("Unknown")  # Should not raise

    def test_thread_safety(self) -> None:
        tracker = ProgressTrackerState()
        tracker.set_total("Table", 1000)
        errors = []

        def increment_many():
            try:
                for _ in range(100):
                    tracker.increment_processed("Table", 0.001)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=increment_many) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        progress = tracker.get_progress("Table")
        assert progress.processed == 1000

    def test_multiple_entity_types(self) -> None:
        tracker = ProgressTrackerState()
        tracker.set_total("Database", 5)
        tracker.set_total("Schema", 20)
        tracker.set_total("Table", 100)

        tracker.increment_processed("Database", 0.5)
        tracker.increment_processed("Schema", 0.2)
        tracker.increment_processed("Table", 0.1)

        assert tracker.get_progress("Database").processed == 1
        assert tracker.get_progress("Schema").processed == 1
        assert tracker.get_progress("Table").processed == 1
