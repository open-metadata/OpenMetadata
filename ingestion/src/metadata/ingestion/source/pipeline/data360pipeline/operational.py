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
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.database.data360.client import (
    get_calculated_insights,
    get_data_transform_run_history,
    get_datastreams,
    get_datatransforms,
)
from metadata.ingestion.source.pipeline.data360pipeline.constant import (
    MetadataTypesConstant,
    ResponseConstant,
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
from metadata.ingestion.source.pipeline.informatica.exceptions import (
    ResourceNotFoundException,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class Data360PipelineOperationalSource(Data360PipelineSource):
    """
    Extracts run/status data from Salesforce Data 360 pipeline objects.
    """

    def _get_datastreams(self):
        for item in get_datastreams(
            self.client,
            pagination_limit=self.pagination_limit,
            log_warning=self.log_warning,
        ):
            if self._filter_inactive_pipeline(
                name=item.get(ResponseConstant.NAME),
                status=item.get(ResponseConstant.STATUS),
                pipeline_type=MetadataTypesConstant.DATASTREAM,
            ):
                continue
            yield DataStreamDetails(
                name=item.get(ResponseConstant.NAME),
                lastRefreshDate=item.get(ResponseConstant.LAST_REFRESH_DATE),
                lastRunStatus=item.get(ResponseConstant.LAST_RUN_STATUS),
            )

    def _get_calculated_insights(self):
        for item in get_calculated_insights(
            self.client,
            pagination_limit=self.pagination_limit,
            log_warning=self.log_warning,
        ):
            if self._filter_inactive_pipeline(
                name=item.get(ResponseConstant.API_NAME),
                status=item.get(ResponseConstant.CALCULATED_INSIGHT_STATUS),
                pipeline_type=MetadataTypesConstant.CALCULATED_INSIGHT,
            ):
                continue
            yield CalculatedInsightDetails(
                apiName=item.get(ResponseConstant.API_NAME),
                lastRunDateTime=item.get(ResponseConstant.LAST_RUN_DATE_TIME),
                lastRunStatusDateTime=item.get(ResponseConstant.LAST_RUN_STATUS_DATE_TIME),
                lastRunStatus=item.get(ResponseConstant.LAST_RUN_STATUS),
            )

    def _get_datatransforms(self):
        for item in get_datatransforms(
            client=self.client,
            pagination_limit=self.pagination_limit,
            log_warning=self.log_warning,
        ):
            if self._filter_inactive_pipeline(
                name=item.get(ResponseConstant.NAME),
                status=item.get(ResponseConstant.STATUS),
                pipeline_type=MetadataTypesConstant.DATATRANSFORM,
            ):
                continue
            yield DataTransformDetails(name=item.get(ResponseConstant.NAME))

    def get_pipelines_list(self) -> Iterable[DataCloudPipelineDetails]:
        """Yields all active pipeline objects with minimal fields for status ingestion."""
        self.pagination_limit = self.config.serviceConnection.root.config.paginationLimit
        self.existing_pipelines_set: set = set()
        for pipeline in self.metadata.list_all_entities(
            entity=Pipeline, params={"service": self.config.serviceName}
        ):
            self.existing_pipelines_set.add(pipeline.name.root)
        yield from self._get_datastreams()
        yield from self._get_calculated_insights()
        yield from self._get_datatransforms()

    def _get_pipeline_status_type(self, status: str) -> StatusType:
        status_map = {
            r"\bsuccess\b": StatusType.Successful,
            r"\bfail(ed|ure)?\b": StatusType.Failed,
            r"\bskipped(_no_changes)?\b": StatusType.Skipped,
        }
        status_lower = status.lower()
        for pattern, status_type in status_map.items():
            if re.match(pattern, status_lower):
                return status_type
        return StatusType.Pending

    def _create_pipeline_status_request(
        self, pipeline_name: str, status: StatusType, start_time, end_time
    ):
        if start_time and end_time:
            pipeline_fqn = f"{self.config.serviceName}.{pipeline_name}"
            task_status = TaskStatus(
                name=pipeline_name,
                executionStatus=status,
                startTime=start_time,
                endTime=end_time,
            )
            pipeline_status = PipelineStatus(
                timestamp=start_time, executionStatus=status, taskStatus=[task_status]
            )
            return Either(
                right=OMetaPipelineStatus(
                    pipeline_fqn=pipeline_fqn, pipeline_status=pipeline_status
                )
            )
        return None

    def yield_data_transform_status(self, pipeline_details: DataTransformDetails):
        run_histories = get_data_transform_run_history(
            client=self.client,
            name=pipeline_details.get_name(),
            limit=self.source_config.lastRunsLimit,
            log_warning=self.log_warning,
        )
        for run in (run_histories or {}).get(ResponseConstant.HISTORIES, []):
            data_transform_run = DataTransformRun(**run)
            result = self._create_pipeline_status_request(
                pipeline_name=pipeline_details.get_name(),
                start_time=self.get_timestamp(data_transform_run.startTime or 0),
                end_time=self.get_timestamp(data_transform_run.endTime or 0),
                status=self._get_pipeline_status_type(data_transform_run.status or ""),
            )
            if result:
                yield result

    def yield_ci_status(self, pipeline_details: CalculatedInsightDetails):
        result = self._create_pipeline_status_request(
            pipeline_name=pipeline_details.get_name(),
            start_time=self.get_timestamp(pipeline_details.lastRunDateTime or 0),
            end_time=self.get_timestamp(pipeline_details.lastRunStatusDateTime or 0),
            status=self._get_pipeline_status_type(pipeline_details.lastRunStatus or ""),
        )
        if result:
            yield result

    def yield_datastream_status(self, pipeline_details: DataStreamDetails):
        result = self._create_pipeline_status_request(
            pipeline_name=pipeline_details.get_name(),
            start_time=self.get_timestamp(pipeline_details.lastRefreshDate or 0),
            end_time=self.get_timestamp(pipeline_details.lastRefreshDate or 0),
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
                raise ResourceNotFoundException(
                    f"Could not find {pipeline_details.get_metadata_type()} pipeline for {pipeline_details.get_name()}"
                )
            if isinstance(pipeline_details, DataTransformDetails):
                yield from self.yield_data_transform_status(pipeline_details)
            elif isinstance(pipeline_details, CalculatedInsightDetails):
                yield from self.yield_ci_status(pipeline_details)
            elif isinstance(pipeline_details, DataStreamDetails):
                yield from self.yield_datastream_status(pipeline_details)
            else:
                raise ResourceNotFoundException(
                    f"Unknown pipeline type {pipeline_details.get_metadata_type()} for {pipeline_details.get_name()}"
                )
        except ResourceNotFoundException as exc:
            self.log_warning(exc)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{pipeline_details.get_name()} Pipeline Status",
                    error=f"Unexpected error while yielding status for {pipeline_details.get_name()}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_lineage_details(self, _: DataCloudPipelineDetails) -> Iterable[Either[AddLineageRequest]]:
        """Implemented in lineage ingestion."""
        return iter([])

    def yield_pipeline(self, _: Any) -> Iterable[Either[CreatePipelineRequest]]:
        """Implemented in metadata ingestion."""
        return iter([])

    def yield_tag(self, _: DataCloudPipelineDetails, **__) -> Iterable[Either[OMetaTagAndClassification]]:
        """Implemented in metadata ingestion."""
        return iter([])

    def yield_pipeline_usage(self, _: Any):
        """Not implemented."""

    def mark_pipelines_as_deleted(self):
        """Handled by metadata ingestion."""

    def process_pipeline_bulk_lineage(self):
        """Handled by lineage ingestion."""
