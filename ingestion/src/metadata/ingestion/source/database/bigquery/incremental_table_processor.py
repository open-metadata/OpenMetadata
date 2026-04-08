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
Bigquery Incremental Table processing logic.

Uses Cloud Logging API (entries.list) to detect table changes since last run.
Optimized around the hard 60 requests/min quota per project:
- Batches datasets into groups using the indexed field resource.labels.dataset_id
- Bounded timestamp window [start_date, end_date) for deterministic results
- Retries with linear backoff on ResourceExhausted (429)

Memory-optimized:
- Processes entries page-by-page, releasing each page before fetching the next
- Stores only (table_name -> is_deleted) per schema, no Pydantic models or timestamps
"""
import time
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional

import google.cloud.logging
from google.api_core.exceptions import ResourceExhausted
from google.cloud.logging_v2.entries import LogEntry

from metadata.ingestion.source.database.bigquery.models import (
    BigQueryTableMap,
    SchemaName,
    TableName,
)
from metadata.ingestion.source.database.bigquery.queries import (
    BIGQUERY_GET_CHANGED_TABLES_FROM_CLOUD_LOGGING,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

MAX_RETRIES = 3
RETRY_BASE_WAIT = 60  # Cloud Logging quota resets per minute
PAGE_SIZE = 10000
DATASET_BATCH_SIZE = 50


def _batch(items: List[str], batch_size: int) -> Iterable[List[str]]:
    """Yield successive batches from a list."""
    for i in range(0, len(items), batch_size):
        yield items[i : i + batch_size]


def _build_dataset_filter(datasets: List[str]) -> str:
    """Build a Cloud Logging filter clause for a batch of dataset IDs.

    Uses the indexed field resource.labels.dataset_id for efficient
    server-side filtering.
    """
    if len(datasets) == 1:
        return f'AND resource.labels.dataset_id = "{datasets[0]}"'
    or_clause = " OR ".join(f'resource.labels.dataset_id = "{ds}"' for ds in datasets)
    return f"AND ({or_clause})"


class BigQueryIncrementalTableProcessor:
    def __init__(self, client: google.cloud.logging.Client):
        self._client = client
        self._changed_tables_map = BigQueryTableMap()
        self._query_failed = False

    @classmethod
    def from_project(cls, project: str) -> "BigQueryIncrementalTableProcessor":
        client = google.cloud.logging.Client(project=project)
        return cls(client)

    @staticmethod
    def _is_table_deleted(entry: LogEntry) -> bool:
        metadata = entry.payload.get("metadata") or {}
        return "tableDeletion" in metadata

    def _process_entry(self, entry: LogEntry):
        """Extract dataset/table from a single Cloud Logging entry."""
        payload = entry.payload
        if not isinstance(payload, dict):
            logger.debug("Skipping non-dict Cloud Logging entry payload: %s", payload)
            return
        resource_name = payload.get("resourceName", "")
        parts = resource_name.split("/")
        if len(parts) < 6:
            return

        self._changed_tables_map.update(
            schema_name=parts[3],
            table_name=parts[5],
            deleted=self._is_table_deleted(entry),
        )

    def _fetch_batch(
        self,
        project: str,
        start_date: datetime,
        end_date: datetime,
        dataset_filter: str,
    ):
        """Fetch Cloud Logging entries for a batch of datasets with retry logic.

        Iterates entries one-by-one from the Cloud Logging generator and
        feeds each to _process_entry. On ResourceExhausted (429), retries
        up to MAX_RETRIES times with linear backoff. On retry,
        already-processed entries are deduplicated by BigQueryTableMap.update().
        """
        resource_names = [f"projects/{project}"]
        filters = BIGQUERY_GET_CHANGED_TABLES_FROM_CLOUD_LOGGING.format(
            project=project,
            start_date=start_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
            end_date=end_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
            dataset_filter=dataset_filter,
        )

        for attempt in range(MAX_RETRIES):
            try:
                entries = self._client.list_entries(
                    resource_names=resource_names,
                    filter_=filters,
                    order_by=google.cloud.logging.DESCENDING,
                    page_size=PAGE_SIZE,
                )
                total = 0
                for entry in entries:
                    total += 1
                    self._process_entry(entry)
                    if total % 10000 == 0:
                        logger.info("Processed %d Cloud Logging entries so far", total)
                if total > 0:
                    logger.info("Finished processing %d Cloud Logging entries", total)
                return
            except ResourceExhausted:
                if attempt < MAX_RETRIES - 1:
                    wait = RETRY_BASE_WAIT * (attempt + 1)
                    logger.warning(
                        "Cloud Logging quota exceeded, retrying in %ds "
                        "(attempt %d/%d)",
                        wait,
                        attempt + 1,
                        MAX_RETRIES,
                    )
                    time.sleep(wait)
                else:
                    logger.error(
                        "Cloud Logging quota exceeded after %d retries. "
                        "Falling back to full extraction.",
                        MAX_RETRIES,
                    )
                    self._query_failed = True
            except Exception as exc:
                logger.error("Failed to query Cloud Logging: %s", exc)
                self._query_failed = True
                return

    def set_tables_map(
        self,
        project: str,
        start_date: datetime,
        datasets: Optional[List[str]] = None,
    ):
        """Fetch changed tables from Cloud Logging, batching datasets for efficiency.

        Batches datasets into groups of DATASET_BATCH_SIZE and queries each batch
        separately. This keeps the indexed field resource.labels.dataset_id in the
        filter while reducing total API calls from N to ceil(N / DATASET_BATCH_SIZE).

        Uses a bounded timestamp window [start_date, end_date) to ensure
        deterministic results and prevent data gaps between runs.

        Args:
            project: GCP project ID
            start_date: Only fetch changes after this timestamp
            datasets: List of dataset IDs to query. If None, queries all datasets
                in the project (no dataset_id filter).
        """
        end_date = datetime.now(timezone.utc)
        num_datasets = len(datasets) if datasets else 0
        num_batches = (
            (num_datasets + DATASET_BATCH_SIZE - 1) // DATASET_BATCH_SIZE
            if num_datasets
            else 1
        )

        logger.info(
            "Querying Cloud Logging for project '%s': %d datasets in %d batch(es), "
            "window [%s, %s)",
            project,
            num_datasets,
            num_batches,
            start_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
            end_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
        )

        if datasets is None:
            logger.debug("No dataset filter — querying all datasets in project")
            self._fetch_batch(project, start_date, end_date, dataset_filter="")
        elif datasets:
            for batch_idx, dataset_batch in enumerate(
                _batch(datasets, DATASET_BATCH_SIZE), start=1
            ):
                if self._query_failed:
                    logger.warning(
                        "Skipping remaining %d batch(es) due to prior failure",
                        num_batches - batch_idx + 1,
                    )
                    return
                logger.debug(
                    "Fetching batch %d/%d (%d datasets)",
                    batch_idx,
                    num_batches,
                    len(dataset_batch),
                )
                dataset_filter = _build_dataset_filter(dataset_batch)
                self._fetch_batch(project, start_date, end_date, dataset_filter)
        else:
            logger.info(
                "No datasets to query after filtering for project '%s'", project
            )

    def get_deleted(self, schema_name: SchemaName) -> List[TableName]:
        return self._changed_tables_map.get_deleted(schema_name)

    def get_not_deleted(self, schema_name: SchemaName) -> List[TableName]:
        return self._changed_tables_map.get_not_deleted(schema_name)

    def get_all_deleted(self) -> Dict[SchemaName, List[TableName]]:
        return self._changed_tables_map.get_all_deleted()

    @property
    def query_failed(self) -> bool:
        return self._query_failed
