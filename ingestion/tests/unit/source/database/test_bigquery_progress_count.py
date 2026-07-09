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
"""BigQuery seeds ``Database`` (filtered projects) + per-project
``DatabaseSchema`` (filtered datasets) progress totals, reconciling when dataset
listing fails."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from metadata.ingestion.progress.modes import ProgressMode, TotalsDeclarer
from metadata.ingestion.progress.tracking import ProgressTracking
from metadata.ingestion.source.database.bigquery import metadata as bigquery_metadata

BigquerySource = bigquery_metadata.BigquerySource


@pytest.fixture
def bigquery_source():
    source = object.__new__(BigquerySource)
    source.source_config = SimpleNamespace(
        useFqnForFiltering=False,
        databaseFilterPattern=None,
        schemaFilterPattern=None,
    )
    source.metadata = MagicMock()
    source.status = MagicMock()
    source.context = MagicMock()
    source.context.get.return_value = SimpleNamespace(database_service="svc")
    source.__dict__["_progress_tracking"] = ProgressTracking(ProgressMode.AUTO, "Test")
    return source


def _counters(source):
    return {t: (done, total) for t, done, total in source.progress_tracking.registry.global_counters()}


def test_declare_progress_totals_seeds_projects_and_datasets(bigquery_source):
    bigquery_source.project_ids = ["p1", "p2"]
    bigquery_source._is_database_filtered = lambda p: False
    bigquery_source._raw_dataset_names = lambda p: {"p1": ["d1", "d2"], "p2": ["d3"]}[p]
    bigquery_source._is_schema_filtered = lambda p, s: False
    bigquery_source.declare_progress_totals(TotalsDeclarer(bigquery_source.progress_tracking.registry))
    counters = _counters(bigquery_source)
    assert counters["Database"] == (0, 2)
    assert counters["DatabaseSchema"] == (0, 3)


def test_declare_progress_totals_applies_filters(bigquery_source):
    bigquery_source.project_ids = ["keep", "drop"]
    bigquery_source._is_database_filtered = lambda p: p == "drop"
    bigquery_source._raw_dataset_names = lambda p: ["d1", "skip"]
    bigquery_source._is_schema_filtered = lambda p, s: s == "skip"
    bigquery_source.declare_progress_totals(TotalsDeclarer(bigquery_source.progress_tracking.registry))
    counters = _counters(bigquery_source)
    assert counters["Database"] == (0, 1)
    assert counters["DatabaseSchema"] == (0, 1)


def test_declare_progress_totals_reconciles_when_listing_fails(bigquery_source):
    bigquery_source.project_ids = ["p1"]
    bigquery_source._is_database_filtered = lambda p: False

    def _boom(_project_id):
        raise RuntimeError("list_datasets denied")

    bigquery_source._raw_dataset_names = _boom
    bigquery_source._is_schema_filtered = lambda p, s: False
    bigquery_source.declare_progress_totals(TotalsDeclarer(bigquery_source.progress_tracking.registry))
    registry = bigquery_source.progress_tracking.registry
    assert registry.is_reconcilable("DatabaseSchema") is True
    counters = _counters(bigquery_source)
    assert counters["Database"] == (0, 1)
    assert counters["DatabaseSchema"] == (0, None)


def test_raw_dataset_names_prefers_configured_schema(bigquery_source):
    bigquery_source.service_connection = SimpleNamespace(databaseSchema="only_ds")
    bigquery_source.client = MagicMock()
    assert list(bigquery_source._raw_dataset_names("p1")) == ["only_ds"]
    bigquery_source.client.list_datasets.assert_not_called()


def test_raw_dataset_names_lists_from_client(bigquery_source):
    bigquery_source.service_connection = SimpleNamespace()
    bigquery_source.client = MagicMock()
    bigquery_source.client.list_datasets.return_value = [
        SimpleNamespace(dataset_id="d1"),
        SimpleNamespace(dataset_id="d2"),
    ]
    assert list(bigquery_source._raw_dataset_names("p1")) == ["d1", "d2"]
    bigquery_source.client.list_datasets.assert_called_once_with("p1")
