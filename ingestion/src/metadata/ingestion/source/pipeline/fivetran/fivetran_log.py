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
Query Fivetran's fivetran_metadata.log table in the warehouse to retrieve
sync run history with per-phase (Extract/Process/Load) granularity.

Fivetran automatically creates a Platform Connector in every destination that
publishes operational metadata to fivetran_metadata.log with 90 days of history.
"""

import json
import traceback
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy import MetaData as SaMetaData
from sqlalchemy import desc, select

from metadata.generated.schema.entity.data.pipeline import StatusType, TaskStatus
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.source.connections import get_connection as get_db_connection
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

LOG_RETENTION_DAYS = 90
MAX_SYNC_RUNS = 100
# Cap raw rows fetched: MAX_SYNC_RUNS syncs * ~6 events each, with headroom
MAX_LOG_ROWS = MAX_SYNC_RUNS * 10
LOG_STREAM_PARTITION_SIZE = 500

FIVETRAN_TASK_EXTRACT = "extract"
FIVETRAN_TASK_PROCESS = "process"
FIVETRAN_TASK_LOAD = "load"

FIVETRAN_MESSAGE_EVENTS = (
    "sync_start",
    "extract_summary",
    "write_to_table_start",
    "write_to_table_end",
    "sync_end",
    "sync_stats",
)


def _try_parse_json(data_str: Optional[str]) -> Optional[dict]:
    if not data_str:
        return None
    try:
        parsed = json.loads(data_str)
        # Fivetran sometimes double-encodes JSON in message_data
        if isinstance(parsed, str):
            parsed = json.loads(parsed)
        return parsed if isinstance(parsed, dict) else None
    except (json.JSONDecodeError, TypeError):
        return None


def _ts(dt: Optional[datetime]) -> Optional[Timestamp]:
    if dt is None:
        return None
    return Timestamp(datetime_to_ts(dt))


def query_sync_logs(
    service: DatabaseService,
    log_database: str,
    connector_id: str,
) -> Optional[Dict[str, dict]]:
    """Query fivetran_metadata.log and return parsed syncs grouped by sync_id.

    Fivetran's "destination" warehouse is, from OpenMetadata's perspective,
    the *source* of pipeline-status data.  We call it ``log_database`` here
    to avoid confusion with the OM destination concept.

    Rows are streamed in partitions and folded into the per-sync dict as they
    arrive so we never materialize the full result set in memory.

    Returns None on failure so the caller can fall back to the REST API.
    """
    engine = None
    try:
        connection_config = service.connection.config
        modified_config = connection_config.model_copy(deep=True, update={"database": log_database})
        engine = get_db_connection(modified_config)

        cutoff = datetime.now(timezone.utc) - timedelta(days=LOG_RETENTION_DAYS)

        with engine.connect() as conn:
            sa_metadata = SaMetaData(schema="fivetran_metadata")
            sa_metadata.reflect(conn, only=["log"])
            log_table = sa_metadata.tables["fivetran_metadata.log"]
            col = log_table.c

            query = (
                select(col.sync_id, col.message_event, col.message_data, col.time_stamp)
                .where(col.connection_id == connector_id)
                .where(col.sync_id.isnot(None))
                .where(col.time_stamp >= cutoff)
                .where(col.message_event.in_(FIVETRAN_MESSAGE_EVENTS))
                .order_by(desc(col.time_stamp))
                .limit(MAX_LOG_ROWS)
            )

            syncs: Dict[str, dict] = {}
            result = conn.execute(query).yield_per(LOG_STREAM_PARTITION_SIZE)
            for partition in result.partitions():
                parse_sync_events(partition, syncs)
            return syncs

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(
            f"Could not query fivetran_metadata.log for connector [{connector_id}] in database [{log_database}]: {exc}"
        )
        return None
    finally:
        if engine:
            engine.dispose()


def _handle_sync_start(sync: dict, _data_str: Optional[str], ts: datetime) -> None:
    sync["sync_start_ts"] = ts


def _handle_extract_summary(sync: dict, data_str: Optional[str], ts: datetime) -> None:
    sync["extract_end_ts"] = ts
    parsed = _try_parse_json(data_str)
    if parsed:
        sync["extract_data"] = parsed


def _handle_write_start(sync: dict, _data_str: Optional[str], ts: datetime) -> None:
    sync["write_start_min"] = min(ts, sync.get("write_start_min", ts))


def _handle_write_end(sync: dict, _data_str: Optional[str], ts: datetime) -> None:
    sync["write_end_max"] = max(ts, sync.get("write_end_max", ts))


def _handle_sync_end(sync: dict, data_str: Optional[str], ts: datetime) -> None:
    sync["sync_end_ts"] = ts
    parsed = _try_parse_json(data_str)
    if parsed:
        sync["sync_end_data"] = parsed


def _handle_sync_stats(sync: dict, data_str: Optional[str], _ts: datetime) -> None:
    parsed = _try_parse_json(data_str)
    if parsed:
        sync["sync_stats"] = parsed


_EVENT_HANDLERS = {
    "sync_start": _handle_sync_start,
    "extract_summary": _handle_extract_summary,
    "write_to_table_start": _handle_write_start,
    "write_to_table_end": _handle_write_end,
    "sync_end": _handle_sync_end,
    "sync_stats": _handle_sync_stats,
}


def parse_sync_events(
    rows: Iterable[Tuple],
    syncs: Optional[Dict[str, dict]] = None,
) -> Dict[str, dict]:
    """Group log rows by sync_id into per-sync event dictionaries.

    Accepts an optional ``syncs`` accumulator so callers can fold multiple
    row partitions into the same dict without ever materializing the full
    result set in memory.
    """
    if syncs is None:
        syncs = {}
    for row in rows:
        sync_id, event, data_str, ts = row[0], row[1], row[2], row[3]
        handler = _EVENT_HANDLERS.get(event)
        if handler is not None:
            handler(syncs.setdefault(sync_id, {}), data_str, ts)
    return syncs


def _apply_stats_fallback(sync: dict) -> None:
    """Fill missing event timestamps using sync_stats durations."""
    stats = sync.get("sync_stats")
    sync_start = sync.get("sync_start_ts")
    if not stats or not sync_start:
        return

    extract_end = sync.get("extract_end_ts")
    extract_time = stats.get("extract_time_s")
    if not extract_end and extract_time is not None:
        extract_end = sync_start + timedelta(seconds=extract_time)
        sync["extract_end_ts"] = extract_end

    write_start = sync.get("write_start_min")
    process_time = stats.get("process_time_s")
    if not write_start and extract_end and process_time is not None:
        write_start = extract_end + timedelta(seconds=process_time)
        sync["write_start_min"] = write_start

    load_time = stats.get("load_time_s")
    if not sync.get("write_end_max") and write_start and load_time is not None:
        sync["write_end_max"] = write_start + timedelta(seconds=load_time)


def _determine_extract_status(sync: dict) -> StatusType:
    extract_status_str = sync.get("extract_data", {}).get("status", "")
    if extract_status_str == "SUCCESS":
        return StatusType.Successful
    if extract_status_str:
        return StatusType.Failed
    if sync.get("extract_end_ts"):
        return StatusType.Successful
    return StatusType.Failed


def _determine_load_status(sync: dict) -> StatusType:
    status_str = sync.get("sync_end_data", {}).get("status", "")
    if status_str == "SUCCESSFUL":
        return StatusType.Successful
    if status_str:
        return StatusType.Failed
    if sync.get("sync_end_ts"):
        return StatusType.Successful
    return StatusType.Failed


def build_task_statuses(sync: dict) -> List[TaskStatus]:
    """Build Extract/Process/Load TaskStatus from parsed sync events."""
    _apply_stats_fallback(sync)

    extract_status = _determine_extract_status(sync)

    if extract_status == StatusType.Failed:
        process_status = StatusType.Failed
        load_status = StatusType.Failed
    else:
        load_status = _determine_load_status(sync)
        sync_ended_ok = sync.get("sync_end_data", {}).get("status") == "SUCCESSFUL"
        process_status = StatusType.Successful if (sync.get("write_start_min") or sync_ended_ok) else StatusType.Failed

    return [
        TaskStatus(
            name=FIVETRAN_TASK_EXTRACT,
            executionStatus=extract_status,
            startTime=_ts(sync.get("sync_start_ts")),
            endTime=_ts(sync.get("extract_end_ts")),
        ),
        TaskStatus(
            name=FIVETRAN_TASK_PROCESS,
            executionStatus=process_status,
            startTime=_ts(sync.get("extract_end_ts")),
            endTime=_ts(sync.get("write_start_min")),
        ),
        TaskStatus(
            name=FIVETRAN_TASK_LOAD,
            executionStatus=load_status,
            startTime=_ts(sync.get("write_start_min")),
            endTime=_ts(sync.get("write_end_max")),
        ),
    ]


def build_fallback_task_statuses(
    status_type: StatusType,
    start_ms: int,
    end_ms: Optional[int],
) -> List[TaskStatus]:
    """Build uniform task statuses for the REST API fallback path."""
    end_time = Timestamp(end_ms) if end_ms else None
    return [
        TaskStatus(
            name=FIVETRAN_TASK_EXTRACT,
            executionStatus=status_type,
            startTime=Timestamp(start_ms),
            endTime=end_time,
        ),
        TaskStatus(
            name=FIVETRAN_TASK_PROCESS,
            executionStatus=status_type,
            startTime=Timestamp(start_ms),
            endTime=end_time,
        ),
        TaskStatus(
            name=FIVETRAN_TASK_LOAD,
            executionStatus=status_type,
            startTime=Timestamp(start_ms),
            endTime=end_time,
        ),
    ]


def _get_sortable_sync_start(sync: dict) -> datetime:
    """Return a consistently comparable naive datetime for sorting."""
    ts = sync.get("sync_start_ts")
    if ts is None:
        return datetime.min
    if ts.tzinfo is not None and ts.tzinfo.utcoffset(ts) is not None:
        return ts.astimezone(timezone.utc).replace(tzinfo=None)
    return ts


def sort_and_limit_syncs(syncs: Dict[str, dict]) -> List[dict]:
    """Sort parsed syncs by start time descending and limit to MAX_SYNC_RUNS."""
    sorted_pairs = sorted(
        syncs.items(),
        key=lambda x: _get_sortable_sync_start(x[1]),
        reverse=True,
    )[:MAX_SYNC_RUNS]
    return [sync for _sync_id, sync in sorted_pairs if sync.get("sync_start_ts")]
