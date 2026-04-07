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
Tests for BigQuery incremental table extraction via Cloud Logging.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from google.api_core.exceptions import ResourceExhausted

from metadata.ingestion.source.database.bigquery.incremental_table_processor import (
    DATASET_BATCH_SIZE,
    BigQueryIncrementalTableProcessor,
    _batch,
    _build_dataset_filter,
)


def _make_entry(resource_name: str, metadata_keys: list, timestamp=None):
    """Helper to create a mock Cloud Logging entry."""
    entry = MagicMock()
    entry.payload = {
        "resourceName": resource_name,
        "metadata": {k: {} for k in metadata_keys},
    }
    entry.timestamp = timestamp or datetime(2024, 1, 1, tzinfo=timezone.utc)
    return entry


class TestBatchHelper:
    def test_batch_splits_evenly(self):
        assert list(_batch(["a", "b", "c", "d"], 2)) == [["a", "b"], ["c", "d"]]

    def test_batch_handles_remainder(self):
        assert list(_batch(["a", "b", "c", "d", "e"], 2)) == [
            ["a", "b"],
            ["c", "d"],
            ["e"],
        ]

    def test_batch_single_item(self):
        assert list(_batch(["a"], 50)) == [["a"]]

    def test_batch_empty_list(self):
        assert list(_batch([], 50)) == []


class TestBuildDatasetFilter:
    def test_single_dataset(self):
        result = _build_dataset_filter(["my_dataset"])
        assert result == 'AND resource.labels.dataset_id = "my_dataset"'

    def test_multiple_datasets(self):
        result = _build_dataset_filter(["ds1", "ds2", "ds3"])
        assert "AND (" in result
        assert 'resource.labels.dataset_id = "ds1"' in result
        assert 'resource.labels.dataset_id = "ds2"' in result
        assert 'resource.labels.dataset_id = "ds3"' in result
        assert " OR " in result


class TestIsTableDeleted:
    def test_deletion_detected(self):
        entry = _make_entry("projects/p/datasets/d/tables/t", ["tableDeletion"])
        assert BigQueryIncrementalTableProcessor._is_table_deleted(entry) is True

    def test_creation_not_deleted(self):
        entry = _make_entry("projects/p/datasets/d/tables/t", ["tableCreation"])
        assert BigQueryIncrementalTableProcessor._is_table_deleted(entry) is False

    def test_missing_metadata_key(self):
        entry = MagicMock()
        entry.payload = {"resourceName": "projects/p/datasets/d/tables/t"}
        assert BigQueryIncrementalTableProcessor._is_table_deleted(entry) is False

    def test_none_metadata_value(self):
        entry = MagicMock()
        entry.payload = {
            "resourceName": "projects/p/datasets/d/tables/t",
            "metadata": None,
        }
        assert BigQueryIncrementalTableProcessor._is_table_deleted(entry) is False


class TestBigQueryIncrementalTableProcessor:
    def test_create_table_is_detected(self):
        entries = [
            _make_entry("projects/proj/datasets/ds1/tables/my_table", ["tableCreation"])
        ]
        mock_client = MagicMock()
        mock_client.list_entries.return_value = entries

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=["ds1"]
        )

        assert "my_table" in processor.get_not_deleted("ds1")
        assert processor.get_deleted("ds1") == []
        assert not processor.query_failed

    def test_delete_table_is_detected(self):
        entries = [
            _make_entry("projects/proj/datasets/ds1/tables/my_table", ["tableDeletion"])
        ]
        mock_client = MagicMock()
        mock_client.list_entries.return_value = entries

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=["ds1"]
        )

        assert "my_table" in processor.get_deleted("ds1")
        assert processor.get_not_deleted("ds1") == []

    def test_update_table_is_detected(self):
        entries = [
            _make_entry("projects/proj/datasets/ds1/tables/my_table", ["tableChange"])
        ]
        mock_client = MagicMock()
        mock_client.list_entries.return_value = entries

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=["ds1"]
        )

        assert "my_table" in processor.get_not_deleted("ds1")
        assert processor.get_deleted("ds1") == []

    def test_multiple_datasets_grouped_correctly(self):
        entries = [
            _make_entry("projects/proj/datasets/ds1/tables/table_a", ["tableCreation"]),
            _make_entry("projects/proj/datasets/ds2/tables/table_b", ["tableCreation"]),
            _make_entry("projects/proj/datasets/ds1/tables/table_c", ["tableCreation"]),
            _make_entry("projects/proj/datasets/ds3/tables/table_d", ["tableDeletion"]),
        ]
        mock_client = MagicMock()
        mock_client.list_entries.return_value = entries

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj",
            datetime(2024, 1, 1, tzinfo=timezone.utc),
            datasets=["ds1", "ds2", "ds3"],
        )

        assert set(processor.get_not_deleted("ds1")) == {"table_a", "table_c"}
        assert processor.get_not_deleted("ds2") == ["table_b"]
        assert processor.get_deleted("ds3") == ["table_d"]
        assert processor.get_not_deleted("ds3") == []

    def test_deduplication_keeps_most_recent(self):
        """First-seen entry wins since results are ordered DESC by time."""
        entries = [
            _make_entry(
                "projects/proj/datasets/ds1/tables/my_table",
                ["tableDeletion"],
                timestamp=datetime(2024, 6, 1, tzinfo=timezone.utc),
            ),
            _make_entry(
                "projects/proj/datasets/ds1/tables/my_table",
                ["tableCreation"],
                timestamp=datetime(2024, 1, 1, tzinfo=timezone.utc),
            ),
        ]
        mock_client = MagicMock()
        mock_client.list_entries.return_value = entries

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=["ds1"]
        )

        assert "my_table" in processor.get_deleted("ds1")
        assert processor.get_not_deleted("ds1") == []

    def test_empty_results(self):
        mock_client = MagicMock()
        mock_client.list_entries.return_value = []

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=["ds1"]
        )

        assert processor.get_not_deleted("ds1") == []
        assert processor.get_deleted("ds1") == []
        assert processor.get_all_deleted() == {}
        assert not processor.query_failed

    def test_malformed_resource_name_is_skipped(self):
        entries = [
            _make_entry("projects/proj/datasets/ds1", ["tableCreation"]),
            _make_entry("", ["tableCreation"]),
            _make_entry(
                "projects/proj/datasets/ds1/tables/valid_table", ["tableCreation"]
            ),
        ]
        mock_client = MagicMock()
        mock_client.list_entries.return_value = entries

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=["ds1"]
        )

        assert processor.get_not_deleted("ds1") == ["valid_table"]

    def test_get_all_deleted_returns_all_schemas(self):
        entries = [
            _make_entry("projects/proj/datasets/ds1/tables/t1", ["tableDeletion"]),
            _make_entry("projects/proj/datasets/ds2/tables/t2", ["tableDeletion"]),
            _make_entry("projects/proj/datasets/ds3/tables/t3", ["tableCreation"]),
        ]
        mock_client = MagicMock()
        mock_client.list_entries.return_value = entries

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj",
            datetime(2024, 1, 1, tzinfo=timezone.utc),
            datasets=["ds1", "ds2", "ds3"],
        )

        all_deleted = processor.get_all_deleted()
        assert "ds1" in all_deleted
        assert "ds2" in all_deleted
        assert "ds3" not in all_deleted
        assert all_deleted["ds1"] == ["t1"]
        assert all_deleted["ds2"] == ["t2"]

    @patch(
        "metadata.ingestion.source.database.bigquery"
        ".incremental_table_processor.time"
    )
    def test_quota_exceeded_retries_and_falls_back(self, mock_time):
        mock_client = MagicMock()
        mock_client.list_entries.side_effect = ResourceExhausted("quota exceeded")

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=["ds1"]
        )

        assert processor.query_failed
        assert mock_client.list_entries.call_count == 3
        assert mock_time.sleep.call_count == 2

    @patch(
        "metadata.ingestion.source.database.bigquery"
        ".incremental_table_processor.time"
    )
    def test_quota_exceeded_recovers_on_retry(self, mock_time):
        entries = [
            _make_entry("projects/proj/datasets/ds1/tables/t1", ["tableCreation"])
        ]
        mock_client = MagicMock()
        mock_client.list_entries.side_effect = [
            ResourceExhausted("quota exceeded"),
            entries,
        ]

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=["ds1"]
        )

        assert not processor.query_failed
        assert "t1" in processor.get_not_deleted("ds1")
        assert mock_time.sleep.call_count == 1

    def test_general_exception_sets_query_failed(self):
        mock_client = MagicMock()
        mock_client.list_entries.side_effect = RuntimeError("connection error")

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=["ds1"]
        )

        assert processor.query_failed
        assert mock_client.list_entries.call_count == 1

    def test_page_size_is_set_no_max_results(self):
        mock_client = MagicMock()
        mock_client.list_entries.return_value = []

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=["ds1"]
        )

        call_kwargs = mock_client.list_entries.call_args[1]
        assert call_kwargs["page_size"] == 10000
        assert "max_results" not in call_kwargs

    def test_datasets_are_batched(self):
        datasets = [f"ds_{i}" for i in range(DATASET_BATCH_SIZE + 10)]
        mock_client = MagicMock()
        mock_client.list_entries.return_value = []

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=datasets
        )

        assert mock_client.list_entries.call_count == 2

        first_filter = mock_client.list_entries.call_args_list[0][1]["filter_"]
        assert "ds_0" in first_filter
        assert f"ds_{DATASET_BATCH_SIZE - 1}" in first_filter

        second_filter = mock_client.list_entries.call_args_list[1][1]["filter_"]
        assert f"ds_{DATASET_BATCH_SIZE}" in second_filter
        assert f"ds_{DATASET_BATCH_SIZE + 9}" in second_filter

    def test_dataset_filter_uses_indexed_field(self):
        mock_client = MagicMock()
        mock_client.list_entries.return_value = []

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj",
            datetime(2024, 1, 1, tzinfo=timezone.utc),
            datasets=["ds1", "ds2"],
        )

        filter_str = mock_client.list_entries.call_args[1]["filter_"]
        assert "resource.labels.dataset_id" in filter_str
        assert 'resource.labels.dataset_id = "ds1"' in filter_str
        assert 'resource.labels.dataset_id = "ds2"' in filter_str

    def test_no_datasets_queries_project_wide(self):
        mock_client = MagicMock()
        mock_client.list_entries.return_value = []

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=None
        )

        assert mock_client.list_entries.call_count == 1
        filter_str = mock_client.list_entries.call_args[1]["filter_"]
        assert "resource.labels.dataset_id" not in filter_str

    def test_filter_contains_end_date(self):
        mock_client = MagicMock()
        mock_client.list_entries.return_value = []

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=["ds1"]
        )

        filter_str = mock_client.list_entries.call_args[1]["filter_"]
        assert 'timestamp >= "2024-01-01T00:00:00Z"' in filter_str
        assert "timestamp <" in filter_str

    @patch(
        "metadata.ingestion.source.database.bigquery"
        ".incremental_table_processor.time"
    )
    def test_batch_failure_stops_remaining_batches(self, mock_time):
        datasets = [f"ds_{i}" for i in range(DATASET_BATCH_SIZE * 3)]
        mock_client = MagicMock()
        mock_client.list_entries.side_effect = ResourceExhausted("quota exceeded")

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj",
            datetime(2024, 1, 1, tzinfo=timezone.utc),
            datasets=datasets,
        )

        assert processor.query_failed
        assert mock_client.list_entries.call_count == 3

    def test_results_accumulate_across_batches(self):
        batch1 = [
            _make_entry("projects/proj/datasets/ds1/tables/t1", ["tableCreation"]),
        ]
        batch2 = [
            _make_entry("projects/proj/datasets/ds2/tables/t2", ["tableCreation"]),
        ]
        mock_client = MagicMock()
        mock_client.list_entries.side_effect = [
            batch1,
            batch2,
        ]

        datasets = [f"ds_{i}" for i in range(DATASET_BATCH_SIZE)] + [
            "ds1",
            "ds2",
        ]
        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=datasets
        )

        assert mock_client.list_entries.call_count == 2
        assert "t1" in processor.get_not_deleted("ds1")
        assert "t2" in processor.get_not_deleted("ds2")

    def test_many_entries_all_processed(self):
        """All entries from the generator are processed."""
        all_entries = [
            _make_entry("projects/proj/datasets/ds1/tables/t1", ["tableCreation"]),
            _make_entry("projects/proj/datasets/ds1/tables/t2", ["tableCreation"]),
        ]
        mock_client = MagicMock()
        mock_client.list_entries.return_value = all_entries

        processor = BigQueryIncrementalTableProcessor(mock_client)
        processor.set_tables_map(
            "proj", datetime(2024, 1, 1, tzinfo=timezone.utc), datasets=["ds1"]
        )

        assert set(processor.get_not_deleted("ds1")) == {"t1", "t2"}
