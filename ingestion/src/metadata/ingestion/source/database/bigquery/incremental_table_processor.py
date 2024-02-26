from datetime import datetime
import google.cloud.logging
from google.cloud.logging_v2.entries import LogEntry
from metadata.ingestion.source.database.bigquery.models import BigQueryTable, BigQueryTableMap
from metadata.ingestion.source.database.bigquery.queries import BIGQUERY_GET_CHANGED_TABLES_FROM_CLOUD_LOGGING


class BigQueryIncrementalTableProcessor:
    def __init__(self, client: google.cloud.logging.Client):
        self._client = client

    @classmethod
    def from_project(cls, project: str) -> "BigQueryIncrementalTableProcessor":
        client = google.cloud.logging.Client(project=project)
        return cls(client)

    def _is_table_deleted(self, entry: LogEntry) -> bool:
        if "tableDeletion" in entry.payload.get("metadata").keys():
            return True
        return False

    def get_changed_tables(self, project: str, dataset: str, start_date: datetime) -> BigQueryTableMap:
        table_map = {}

        resource_names = [f"projects/{project}"]
        filters = BIGQUERY_GET_CHANGED_TABLES_FROM_CLOUD_LOGGING.format(project=project, dataset=dataset, start_date=start_date)

        entries = self._client.list_entries(
            resource_names=resource_names,
            filter_=filters,
            order_by=google.cloud.logging.DESCENDING
        )

        for entry in entries:
            table_name = entry.payload.get("resourceName", "").split("/")[-1]
            timestamp = entry.timestamp
            deleted = self._is_table_deleted(entry)

            if not table_name in table_map:
                table_map[table_name] = BigQueryTable(
                    name=table_name,
                    timestamp=timestamp,
                    deleted=deleted
                )
        return BigQueryTableMap(table_map=table_map)
