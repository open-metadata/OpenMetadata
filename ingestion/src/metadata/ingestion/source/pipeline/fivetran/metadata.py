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
Fivetran source to extract metadata
"""

import json
import traceback
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Optional, cast

from sqlalchemy import MetaData as SaMetaData, asc, select

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineState,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.pipeline.fivetranConnection import (
    FivetranConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SourceUrl,
    Timestamp,
)
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection as get_db_connection
from metadata.ingestion.source.pipeline.fivetran.client import FivetranClient
from metadata.ingestion.source.pipeline.fivetran.models import FivetranPipelineDetails
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

MESSAGING_CONNECTOR_TYPES = {"confluent_cloud", "kafka"}
MAX_SYNC_RUNS = 100

FIVETRAN_TASK_EXTRACT = "extract"
FIVETRAN_TASK_PROCESS = "process"
FIVETRAN_TASK_LOAD = "load"

LOG_RETENTION_DAYS = 90

FIVETRAN_MESSAGE_EVENTS = [
    "sync_start",
    "extract_summary",
    "write_to_table_start",
    "write_to_table_end",
    "sync_end",
    "sync_stats",
]

FIVETRAN_STATUS_MAP = {
    "COMPLETED": StatusType.Successful,
    "FAILURE_WITH_TASK": StatusType.Failed,
    "CANCELED": StatusType.Failed,
}

HISTORICAL_SYNC_FIELDS = [
    ("succeeded_at", StatusType.Successful),
    ("failed_at", StatusType.Failed),
]


class FivetranSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Fivetran's REST API
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: FivetranConnection = config.serviceConnection.root.config
        if not isinstance(connection, FivetranConnection):
            raise InvalidSourceException(
                f"Expected FivetranConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_connections_jobs(
        self,
        pipeline_details: FivetranPipelineDetails,
    ) -> List[Task]:
        """Returns the three ELT phase tasks for a Fivetran connector."""
        return [
            Task(
                name=FIVETRAN_TASK_EXTRACT,
                displayName="Extract",
                taskType="Extract",
                downstreamTasks=[FIVETRAN_TASK_PROCESS],
            ),  # type: ignore
            Task(
                name=FIVETRAN_TASK_PROCESS,
                displayName="Process",
                taskType="Process",
                downstreamTasks=[FIVETRAN_TASK_LOAD],
            ),  # type: ignore
            Task(
                name=FIVETRAN_TASK_LOAD,
                displayName="Load",
                taskType="Load",
                downstreamTasks=[],
            ),  # type: ignore
        ]

    def yield_pipeline(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Convert a Connection into a Pipeline Entity
        :param pipeline_details: pipeline_details object from fivetran
        :return: Create Pipeline request with tasks
        """
        source_url = self.get_source_url(
            connector_id=pipeline_details.source.get("id"),
            group_id=pipeline_details.group.get("id"),
            source_name=pipeline_details.source.get("service"),
        )
        pipeline_request = CreatePipelineRequest(
            name=EntityName(pipeline_details.pipeline_name),
            displayName=pipeline_details.pipeline_display_name,
            tasks=self.get_connections_jobs(pipeline_details=pipeline_details),
            service=FullyQualifiedEntityName(self.context.get().pipeline_service),
            sourceUrl=source_url,
            scheduleInterval=self._get_schedule_interval(pipeline_details),
            state=self.get_pipeline_state(pipeline_details),
        )  # type: ignore
        yield Either(left=None, right=pipeline_request)
        self.register_record(pipeline_request=pipeline_request)

    def _get_schedule_interval(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Optional[str]:
        sync_freq = pipeline_details.source.get("sync_frequency")
        if not sync_freq:
            return None
        minutes = int(sync_freq)
        if minutes < 60:
            return f"*/{minutes} * * * *"
        if minutes % 60 != 0:
            return f"*/{minutes} * * * *"
        hours = minutes // 60
        if hours >= 24:
            return "0 0 * * *"
        return f"0 */{hours} * * *"

    def get_pipeline_state(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Optional[PipelineState]:
        if pipeline_details.source.get("paused"):
            return PipelineState.Inactive
        return PipelineState.Active

    def _resolve_destination_service(
        self, dest_service_type: str = ""
    ) -> Optional[DatabaseService]:
        """Resolve the destination warehouse DatabaseService from the service registry."""
        for service_name in self.get_db_service_names() or []:
            try:
                service = self.metadata.get_by_name(
                    entity=DatabaseService,
                    fqn=service_name,
                    fields=["connection"],
                )
                if service and service.connection and service.connection.config:
                    if (
                        dest_service_type
                        and service.serviceType.value.lower()
                        != dest_service_type.lower()
                    ):
                        continue
                    return service
            except Exception as exc:
                logger.debug(f"Could not resolve service [{service_name}]: {exc}")
        return None

    @staticmethod
    def _try_parse_json(data_str: Optional[str]) -> Optional[dict]:
        if not data_str:
            return None
        try:
            return json.loads(data_str)
        except (json.JSONDecodeError, TypeError):
            return None

    @staticmethod
    def _parse_sync_events(rows) -> dict:
        """Group LOG rows by sync_id into per-sync event dictionaries."""
        syncs: dict = {}
        for row in rows:
            sync_id, event, data_str, ts = row[0], row[1], row[2], row[3]
            sync = syncs.setdefault(sync_id, {})

            if event == "sync_start":
                sync["sync_start_ts"] = ts
            elif event == "extract_summary":
                sync["extract_end_ts"] = ts
                parsed = FivetranSource._try_parse_json(data_str)
                if parsed:
                    sync["extract_data"] = parsed
            elif event == "write_to_table_start":
                if "write_start_min" not in sync or ts < sync["write_start_min"]:
                    sync["write_start_min"] = ts
            elif event == "write_to_table_end":
                if "write_end_max" not in sync or ts > sync["write_end_max"]:
                    sync["write_end_max"] = ts
            elif event == "sync_end":
                sync["sync_end_ts"] = ts
                parsed = FivetranSource._try_parse_json(data_str)
                if parsed:
                    sync["sync_end_data"] = parsed
            elif event == "sync_stats":
                parsed = FivetranSource._try_parse_json(data_str)
                if parsed:
                    sync["sync_stats"] = parsed

        return syncs

    @staticmethod
    def _build_task_statuses_for_sync(sync: dict) -> List[TaskStatus]:
        """Build Extract/Process/Load TaskStatus entries from parsed sync events."""
        sync_start = sync.get("sync_start_ts")
        extract_end = sync.get("extract_end_ts")
        write_start_min = sync.get("write_start_min")
        write_end_max = sync.get("write_end_max")
        sync_end = sync.get("sync_end_ts")
        extract_data = sync.get("extract_data", {})
        sync_end_data = sync.get("sync_end_data", {})
        stats = sync.get("sync_stats")

        # Apply sync_stats durations as fallback when event timestamps are missing
        if stats and sync_start:
            extract_time = stats.get("extract_time_s")
            process_time = stats.get("process_time_s")
            load_time = stats.get("load_time_s")

            if not extract_end and extract_time is not None:
                extract_end = sync_start + timedelta(seconds=extract_time)
            if not write_start_min and extract_end and process_time is not None:
                write_start_min = extract_end + timedelta(seconds=process_time)
            if not write_end_max and write_start_min and load_time is not None:
                write_end_max = write_start_min + timedelta(seconds=load_time)

        # Determine per-phase status
        extract_status_str = extract_data.get("status", "")
        extract_status = (
            StatusType.Successful
            if extract_status_str == "SUCCESS"
            else (
                StatusType.Failed
                if extract_status_str
                else StatusType.Successful
                if extract_end
                else StatusType.Failed
            )
        )

        if extract_status == StatusType.Failed:
            process_status = StatusType.Failed
            load_status = StatusType.Failed
        else:
            sync_end_status_str = sync_end_data.get("status", "")
            sync_ended_successfully = sync_end_status_str == "SUCCESSFUL"
            process_status = (
                StatusType.Successful
                if (write_start_min or sync_ended_successfully)
                else StatusType.Failed
            )
            load_status = (
                StatusType.Successful
                if sync_end_status_str == "SUCCESSFUL"
                else (
                    StatusType.Failed
                    if sync_end_status_str
                    else StatusType.Successful
                    if sync_end
                    else StatusType.Failed
                )
            )

        def _ts(dt) -> Optional[Timestamp]:
            if dt is None:
                return None
            return Timestamp(datetime_to_ts(dt))

        return [
            TaskStatus(
                name=FIVETRAN_TASK_LOAD,
                executionStatus=load_status,
                startTime=_ts(write_start_min),
                endTime=_ts(write_end_max),
            ),
            TaskStatus(
                name=FIVETRAN_TASK_PROCESS,
                executionStatus=process_status,
                startTime=_ts(extract_end),
                endTime=_ts(write_start_min),
            ),
            TaskStatus(
                name=FIVETRAN_TASK_EXTRACT,
                executionStatus=extract_status,
                startTime=_ts(sync_start),
                endTime=_ts(extract_end),
            ),
        ]

    def _get_pipeline_status_from_db(
        self,
        pipeline_details: FivetranPipelineDetails,
        pipeline_fqn: str,
    ) -> Optional[List[OMetaPipelineStatus]]:
        """Query fivetran_metadata.log in the destination warehouse for sync run history."""
        dest_database = (pipeline_details.destination.get("config") or {}).get(
            "database"
        )
        if not dest_database:
            return None

        dest_service_type = pipeline_details.destination.get("service", "")
        service = self._resolve_destination_service(dest_service_type)
        if not service:
            return None

        engine = None
        try:
            connection_config = service.connection.config
            modified_config = connection_config.model_copy(
                deep=True, update={"database": dest_database}
            )
            engine = get_db_connection(modified_config)

            cutoff = datetime.now(timezone.utc) - timedelta(days=LOG_RETENTION_DAYS)

            with engine.connect() as conn:
                sa_metadata = SaMetaData(schema="fivetran_metadata")
                sa_metadata.reflect(conn, only=["log"])
                log_table = sa_metadata.tables["fivetran_metadata.log"]
                c = log_table.c

                query = (
                    select(c.sync_id, c.message_event, c.message_data, c.time_stamp)
                    .where(c.connection_id == pipeline_details.connector_id)
                    .where(c.sync_id.isnot(None))
                    .where(c.time_stamp >= cutoff)
                    .where(c.message_event.in_(FIVETRAN_MESSAGE_EVENTS))
                    .order_by(asc(c.time_stamp))
                )

                rows = conn.execute(query).yield_per(100)
                syncs = self._parse_sync_events(rows)

            # Sort by sync_start descending and limit. Sorting must happen in
            # Python because DB rows are individual events that get grouped by
            # sync_id in _parse_sync_events before we can sort by sync.
            sorted_syncs = sorted(
                syncs.items(),
                key=lambda x: x[1].get(
                    "sync_start_ts", datetime.min.replace(tzinfo=timezone.utc)
                ),
                reverse=True,
            )[:MAX_SYNC_RUNS]

            statuses = []
            for _sync_id, sync in sorted_syncs:
                sync_start = sync.get("sync_start_ts")
                if not sync_start:
                    continue

                start_ms = datetime_to_ts(sync_start)
                task_statuses = self._build_task_statuses_for_sync(sync)

                overall_failed = any(
                    ts.executionStatus == StatusType.Failed for ts in task_statuses
                )
                overall_status = (
                    StatusType.Failed if overall_failed else StatusType.Successful
                )

                statuses.append(
                    OMetaPipelineStatus(
                        pipeline_fqn=pipeline_fqn,
                        pipeline_status=PipelineStatus(
                            executionStatus=overall_status,
                            taskStatus=task_statuses,
                            timestamp=Timestamp(start_ms),
                        ),
                    )
                )
            return statuses

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Could not fetch sync logs from destination DB for pipeline"
                f" [{self.get_pipeline_name(pipeline_details)}]: {exc}"
                f" — falling back to REST API"
            )
            return None
        finally:
            if engine:
                engine.dispose()

    def yield_pipeline_status(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """Method to get task & pipeline status.

        Tries the destination DB fivetran_metadata.log table first.
        Falls back to REST API sync-history + historical fields.
        """
        self.client = cast(FivetranClient, self.client)
        pipeline_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Pipeline,
            service_name=self.context.get().pipeline_service,
            pipeline_name=self.context.get().pipeline,
        )

        db_statuses = self._get_pipeline_status_from_db(pipeline_details, pipeline_fqn)
        if db_statuses is not None:
            for status in db_statuses:
                yield Either(right=status)
            return

        seen_timestamps: set = set()
        for sync in self.client.get_connector_sync_history(
            pipeline_details.connector_id
        ):
            try:
                start_dt = datetime.fromisoformat(sync["start"].replace("Z", "+00:00"))
                start_ms = datetime_to_ts(start_dt)
                seen_timestamps.add(start_ms)
                end_ms = None
                if sync.get("end"):
                    end_dt = datetime.fromisoformat(sync["end"].replace("Z", "+00:00"))
                    end_ms = datetime_to_ts(end_dt)

                status_type = FIVETRAN_STATUS_MAP.get(
                    sync.get("status", ""), StatusType.Pending
                )
                task_status = self._build_fallback_task_statuses(
                    status_type, start_ms, end_ms
                )
                pipeline_status = PipelineStatus(
                    executionStatus=status_type,
                    taskStatus=task_status,
                    timestamp=Timestamp(start_ms),
                )
                yield Either(
                    right=OMetaPipelineStatus(
                        pipeline_fqn=pipeline_fqn,
                        pipeline_status=pipeline_status,
                    )
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error parsing sync history for pipeline"
                    f" [{self.get_pipeline_name(pipeline_details)}]: {exc}"
                )

        for field_name, status_type in HISTORICAL_SYNC_FIELDS:
            try:
                timestamp_str = pipeline_details.source.get(field_name)
                if not timestamp_str:
                    continue
                dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                ts_ms = datetime_to_ts(dt)
                if ts_ms in seen_timestamps:
                    continue
                task_status = self._build_fallback_task_statuses(
                    status_type, ts_ms, None
                )
                pipeline_status = PipelineStatus(
                    executionStatus=status_type,
                    taskStatus=task_status,
                    timestamp=Timestamp(ts_ms),
                )
                yield Either(
                    right=OMetaPipelineStatus(
                        pipeline_fqn=pipeline_fqn,
                        pipeline_status=pipeline_status,
                    )
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error parsing historical sync field [{field_name}] for pipeline"
                    f" [{self.get_pipeline_name(pipeline_details)}]: {exc}"
                )

    @staticmethod
    def _build_fallback_task_statuses(
        status_type: StatusType,
        start_ms: int,
        end_ms: Optional[int],
    ) -> List[TaskStatus]:
        """Build extract/process/load TaskStatus entries for the REST API fallback path."""
        return [
            TaskStatus(
                name=FIVETRAN_TASK_LOAD,
                executionStatus=status_type,
                startTime=Timestamp(start_ms),
                endTime=Timestamp(end_ms) if end_ms else None,
            ),
            TaskStatus(
                name=FIVETRAN_TASK_PROCESS,
                executionStatus=status_type,
                startTime=Timestamp(start_ms),
                endTime=Timestamp(end_ms) if end_ms else None,
            ),
            TaskStatus(
                name=FIVETRAN_TASK_EXTRACT,
                executionStatus=status_type,
                startTime=Timestamp(start_ms),
                endTime=Timestamp(end_ms) if end_ms else None,
            ),
        ]

    def fetch_column_lineage(
        self,
        pipeline_details: FivetranPipelineDetails,
        schema_name: str,
        schema_data: dict,
        table_name: str,
        from_table_entity: Table,
        to_table_entity: Table,
    ) -> List[Optional[ColumnLineage]]:
        """
        Fetch column-level lineage between source and destination tables in a Fivetran connector.

        This method retrieves column mappings from Fivetran and creates ColumnLineage objects
        for each enabled column transformation, mapping source columns to their corresponding
        destination columns.

        :param pipeline_details: FivetranPipelineDetails containing connector information
        :param schema_name: Name of the source schema
        :param schema_data: Dictionary containing schema configuration data
        :param table_name: Name of the source table
        :param from_table_entity: Source Table entity from OpenMetadata
        :param to_table_entity: Destination Table entity from OpenMetadata
        :return: List of ColumnLineage objects representing column-to-column mappings, empty list if none found
        """
        pipeline_name = self.get_pipeline_name(pipeline_details)

        col_lineage_arr = []
        for column_name, column_data in self.client.get_connector_column_lineage(
            pipeline_details.connector_id,
            schema_name=schema_name,
            table_name=table_name,
        ).items():
            if not column_data.get("enabled"):
                logger.debug(
                    f"Skipping column [{schema_name}.{table_name}.{column_name}] for pipeline"
                    f" [{pipeline_name}] lineage - column is disabled"
                )
                continue

            dest_column_name = column_data.get("name_in_destination")
            if not column_name or not dest_column_name:
                logger.debug(
                    f"Skipping column mapping for pipeline [{pipeline_name}] lineage"
                    f" - source column [{column_name}] or destination column"
                    f" [{dest_column_name}] name is None"
                )
                continue

            from_col = get_column_fqn(
                table_entity=from_table_entity, column=column_name
            )
            to_col = get_column_fqn(
                table_entity=to_table_entity,
                column=dest_column_name,
            )
            if not from_col or not to_col:
                logger.debug(
                    f"Skipping column [{column_name}] -> [{dest_column_name}] for pipeline"
                    f" [{pipeline_name}] lineage - column FQN could not be resolved"
                )
                continue

            col_lineage_arr.append(
                ColumnLineage(
                    fromColumns=[from_col],
                    toColumn=to_col,
                    function=None,
                )
            )

        return col_lineage_arr if col_lineage_arr else []

    def yield_pipeline_lineage_details(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Parse all the stream available in the connection and create a lineage between them
        :param pipeline_details: pipeline_details object from fivetran
        :return: Lineage from inlets and outlets
        """
        self.client = cast(FivetranClient, self.client)
        pipeline_name = self.get_pipeline_name(pipeline_details)

        source_connector_type = pipeline_details.source.get("service")
        is_messaging_source = source_connector_type in MESSAGING_CONNECTOR_TYPES

        source_database_name = (pipeline_details.source.get("config") or {}).get(
            "database"
        )
        destination_database_name = (
            pipeline_details.destination.get("config") or {}
        ).get("database")

        pipeline_entity = None

        for schema_name, schema_data in self.client.get_connector_schema_details(
            connector_id=pipeline_details.source.get("id")
        ).items():
            if not schema_data.get("enabled"):
                logger.debug(
                    f"Skipping schema [{schema_name}] for pipeline [{pipeline_name}] lineage"
                    " - schema is disabled"
                )
                continue

            source_schema_name = schema_name
            destination_schema_name = schema_data.get("name_in_destination")

            for table_name, table_data in schema_data.get("tables", {}).items():
                if not table_data.get("enabled"):
                    logger.debug(
                        f"Skipping table [{schema_name}].[{table_name}] for pipeline [{pipeline_name}]"
                        " lineage - table is disabled"
                    )
                    continue

                source_table_name = table_name
                destination_table_name = table_data.get("name_in_destination")

                from_fqn = None
                from_entity = None
                if is_messaging_source:
                    for svc_name in self.get_messaging_service_names() or []:
                        from_fqn = fqn.build(
                            metadata=self.metadata,
                            entity_type=Topic,
                            service_name=svc_name,
                            topic_name=source_table_name,
                        )
                        from_entity = self.metadata.get_by_name(
                            entity=Topic, fqn=from_fqn
                        )
                        if from_entity:
                            break
                else:
                    for db_service_name in self.get_db_service_names() or []:
                        from_fqn = fqn.build(
                            metadata=self.metadata,
                            entity_type=Table,
                            table_name=source_table_name,
                            database_name=source_database_name,
                            schema_name=source_schema_name,
                            service_name=db_service_name,
                        )
                        from_entity = self.metadata.get_by_name(
                            entity=Table, fqn=from_fqn
                        )
                        if from_entity:
                            break

                if not from_entity:
                    logger.debug(
                        f"Lineage skipped for pipeline [{pipeline_name}]"
                        f" since source entity [{from_fqn}] not found."
                    )
                    continue

                to_fqn = None
                to_entity = None
                for db_service_name in self.get_db_service_names() or []:
                    to_fqn = fqn.build(
                        self.metadata,
                        Table,
                        table_name=destination_table_name,
                        database_name=destination_database_name,
                        schema_name=destination_schema_name,
                        service_name=db_service_name,
                    )
                    to_entity = self.metadata.get_by_name(entity=Table, fqn=to_fqn)
                    if to_entity:
                        break

                if not to_entity:
                    logger.debug(
                        f"Lineage skipped for pipeline [{pipeline_name}]"
                        f" since destination table [{to_fqn}] not found."
                    )
                    continue

                # Prevent self-lineage loops (entity -> same entity)
                if from_entity.id == to_entity.id:
                    logger.debug(
                        f"Lineage skipped for pipeline [{pipeline_name}]"
                        f" - source and destination are the same entity [{from_fqn}]."
                        f" Self-referencing lineage is not allowed."
                    )
                    continue

                col_lineage_arr = []
                if not is_messaging_source:
                    col_lineage_arr = self.fetch_column_lineage(
                        pipeline_details=pipeline_details,
                        schema_name=schema_name,
                        schema_data=schema_data,
                        table_name=table_name,
                        from_table_entity=from_entity,
                        to_table_entity=to_entity,
                    )

                if pipeline_entity is None:
                    pipeline_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=Pipeline,
                        service_name=self.context.get().pipeline_service,
                        pipeline_name=self.context.get().pipeline,
                    )
                    pipeline_entity = self.metadata.get_by_name(
                        entity=Pipeline, fqn=pipeline_fqn
                    )
                    if not pipeline_entity:
                        logger.warning(
                            f"Pipeline entity [{pipeline_fqn}] not found, skipping lineage."
                        )
                        return

                lineage_details = LineageDetails(
                    pipeline=EntityReference(
                        id=pipeline_entity.id.root, type="pipeline"
                    ),  # type: ignore
                    source=LineageSource.PipelineLineage,
                    columnsLineage=col_lineage_arr if col_lineage_arr else None,
                    sqlQuery=None,
                    description=None,
                )

                from_entity_type = "topic" if is_messaging_source else "table"
                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(id=from_entity.id, type=from_entity_type),  # type: ignore
                            toEntity=EntityReference(id=to_entity.id, type="table"),  # type: ignore
                            lineageDetails=lineage_details,
                        )
                    )
                )  # type: ignore

    def get_pipelines_list(self) -> Iterable[FivetranPipelineDetails]:
        """Get List of all pipelines"""
        for group in self.client.list_groups():
            destination_id: str = group.get("id", "")
            destination = self.client.get_destination_details(
                destination_id=destination_id
            )
            for connector in self.client.list_group_connectors(group_id=destination_id):
                connector_id: str = connector.get("id", "")
                yield FivetranPipelineDetails(
                    destination=destination,
                    source=self.client.get_connector_details(connector_id=connector_id),
                    group=group,
                    connector_id=connector_id,
                )

    def get_pipeline_name(self, pipeline_details: FivetranPipelineDetails) -> str:
        return pipeline_details.pipeline_display_name or pipeline_details.pipeline_name

    def get_source_url(
        self,
        connector_id: Optional[str],
        group_id: Optional[str],
        source_name: Optional[str],
    ) -> Optional[SourceUrl]:
        try:
            if connector_id and group_id and source_name:
                return SourceUrl(
                    f"https://fivetran.com/dashboard/connectors/{connector_id}/status"
                    f"?groupId={group_id}&service={source_name}"
                )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get source url: {exc}")
        return None
