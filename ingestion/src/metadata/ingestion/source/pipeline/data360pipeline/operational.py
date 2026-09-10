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
Salesforce Data 360 pipeline operational (run status) ingestion
"""

import re
import traceback
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
from typing import Any

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    TaskStatus,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.delete_entity import DeleteEntity
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.database.data360.client import (
    get_data_transform_run_history,
)
from metadata.ingestion.source.pipeline.data360pipeline.constant import (
    ResponseConstant,
)
from metadata.ingestion.source.pipeline.data360pipeline.exceptions import (
    ResourceNotFoundException,
)
from metadata.ingestion.source.pipeline.data360pipeline.metadata import (
    Data360PipelineSource,
)
from metadata.ingestion.source.pipeline.data360pipeline.models import (
    CalculatedInsightDetails,
    DataCloudPipelineDetails,
    DataStreamDetails,
    DataTransformDetails,
    DataTransformRun,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineUsage
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class Data360PipelineOperationalSource(Data360PipelineSource):
    """
    Extracts run/status data from Salesforce Data 360 pipeline objects.
    """

    def get_pipelines_list(self) -> Iterable[DataCloudPipelineDetails]:  # pyright: ignore[reportIncompatibleMethodOverride]
        """Yields all active pipeline objects with minimal fields for status ingestion."""
        self.existing_pipelines_set: set[str] = set()
        for pipeline in self.metadata.list_all_entities(
            entity=Pipeline, params={"service": str(self.config.serviceName)}
        ):
            self.existing_pipelines_set.add(pipeline.name.root)
        yield from self._get_datastreams()
        yield from self._get_calculated_insights()
        yield from self._get_datatransforms()

    def _get_pipeline_status_type(self, status: str) -> StatusType:
        """Maps a Data 360 run status onto a StatusType.

        Data 360 reports statuses in several shapes for the same outcome
        ("SUCCESS", "COMPLETED SUCCESSFULLY", "REFRESH_FAILED", "SKIPPED_NO_CHANGES"),
        so the keyword is searched for anywhere in the string rather than anchored
        at the start. Failure is checked before success so a status that mentions
        both is never reported as a success.
        """
        status_patterns = (
            (r"fail(ed|ure)?\b", StatusType.Failed),
            (r"success(ful(ly)?)?\b", StatusType.Successful),
            (r"skipped(_no_changes)?\b", StatusType.Skipped),
        )
        status_lower = status.lower()
        for pattern, status_type in status_patterns:
            if re.search(pattern, status_lower):
                return status_type
        return StatusType.Pending

    def _create_pipeline_status_request(
        self,
        pipeline_name: str,
        status: StatusType,
        start_time: int | None,
        end_time: int | None,
    ) -> Either[OMetaPipelineStatus] | None:
        """Builds one pipeline status record, or None when Data 360 gave us no usable
        run window. A dropped record is reported: silently returning None here is
        how a pipeline ends up with no status at all and no explanation."""
        if start_time is None or end_time is None:
            self.log_warning(
                f"Skipping {pipeline_name} run status: Data 360 returned no "
                f"start/end timestamp (start={start_time}, end={end_time})"
            )
            return None
        task_status = TaskStatus(
            name=pipeline_name,
            executionStatus=status,
            startTime=Timestamp(root=start_time),
            endTime=Timestamp(root=end_time),
        )
        pipeline_status = PipelineStatus(
            timestamp=Timestamp(root=start_time),
            executionStatus=status,
            taskStatus=[task_status],
        )
        return Either(  # pyright: ignore[reportCallIssue]
            right=OMetaPipelineStatus(
                pipeline_fqn=f"{self.config.serviceName}.{pipeline_name}",
                pipeline_status=pipeline_status,
            )
        )

    def _status_cutoff_timestamp(self) -> int:
        """Epoch-ms floor for run statuses, from the standard `statusLookbackDays`."""
        lookback_days = self.source_config.statusLookbackDays or 1
        return int((datetime.now(timezone.utc) - timedelta(days=lookback_days)).timestamp()) * 1000

    def yield_data_transform_status(
        self, pipeline_details: DataTransformDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        run_histories = get_data_transform_run_history(
            client=self.client,
            name=pipeline_details.get_name(),
            limit=self.pagination_limit,
            log_warning=self.log_warning,
        )
        cutoff_timestamp = self._status_cutoff_timestamp()
        for run in (run_histories or {}).get(ResponseConstant.HISTORIES, []):
            data_transform_run = DataTransformRun(**run)
            start_time = self.get_timestamp(data_transform_run.startTime)
            if start_time is not None and start_time < cutoff_timestamp:
                continue
            result = self._create_pipeline_status_request(
                pipeline_name=pipeline_details.get_name(),
                start_time=start_time,
                end_time=self.get_timestamp(data_transform_run.endTime),
                status=self._get_pipeline_status_type(data_transform_run.status or ""),
            )
            if result:
                yield result

    def yield_ci_status(self, pipeline_details: CalculatedInsightDetails) -> Iterable[Either[OMetaPipelineStatus]]:
        result = self._create_pipeline_status_request(
            pipeline_name=pipeline_details.get_name(),
            start_time=self.get_timestamp(pipeline_details.lastRunDateTime),
            end_time=self.get_timestamp(pipeline_details.lastRunStatusDateTime),
            status=self._get_pipeline_status_type(pipeline_details.lastRunStatus or ""),
        )
        if result:
            yield result

    def yield_datastream_status(self, pipeline_details: DataStreamDetails) -> Iterable[Either[OMetaPipelineStatus]]:
        refreshed_at = self.get_timestamp(pipeline_details.lastRefreshDate)
        result = self._create_pipeline_status_request(
            pipeline_name=pipeline_details.get_name(),
            start_time=refreshed_at,
            end_time=refreshed_at,
            status=self._get_pipeline_status_type(pipeline_details.lastRunStatus or ""),
        )
        if result:
            yield result

    def yield_pipeline_status(
        self, pipeline_details: DataCloudPipelineDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """Yields pipeline run status records for all Data 360 pipeline types."""
        try:
            if pipeline_details.get_name() not in self.existing_pipelines_set:
                raise ResourceNotFoundException(  # noqa: TRY301
                    f"Could not find {pipeline_details.get_metadata_type()} pipeline for {pipeline_details.get_name()}"
                )
            if isinstance(pipeline_details, DataTransformDetails):
                yield from self.yield_data_transform_status(pipeline_details)
            elif isinstance(pipeline_details, CalculatedInsightDetails):
                yield from self.yield_ci_status(pipeline_details)
            elif isinstance(pipeline_details, DataStreamDetails):
                yield from self.yield_datastream_status(pipeline_details)
            else:
                raise ResourceNotFoundException(  # noqa: TRY301
                    f"Unknown pipeline type {pipeline_details.get_metadata_type()} for {pipeline_details.get_name()}"
                )
        except ResourceNotFoundException as exc:
            self.log_warning(str(exc))
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=f"{pipeline_details.get_name()} Pipeline Status",
                    error=f"Unexpected error while yielding status for {pipeline_details.get_name()}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_lineage_details(
        self, pipeline_details: DataCloudPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """Implemented in lineage ingestion."""
        return iter([])

    def yield_pipeline(self, pipeline_details: DataCloudPipelineDetails) -> Iterable[Either[CreatePipelineRequest]]:
        """Implemented in metadata ingestion."""
        return iter([])

    def yield_tag(
        self, pipeline_details: DataCloudPipelineDetails, **__
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Implemented in metadata ingestion."""
        return iter([])

    def yield_pipeline_usage(self, pipeline_details: Any) -> Iterable[Either[PipelineUsage]]:
        """Not implemented."""
        return iter([])

    def mark_pipelines_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """Handled by metadata ingestion."""
        return iter([])

    def process_pipeline_bulk_lineage(self) -> Iterable[AddLineageRequest]:
        """Handled by lineage ingestion."""
        return iter([])
