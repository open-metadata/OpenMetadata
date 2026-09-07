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
Salesforce Data 360 pipeline metadata ingestion source
"""

import traceback
from collections.abc import Iterable
from datetime import datetime
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import (
    Task,
)
from metadata.generated.schema.entity.services.connections.pipeline.data360PipelineConnection import (
    Data360PipelineConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Timestamp,
)
from metadata.generated.schema.type.lifeCycle import AccessDetails, LifeCycle
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.data360.client import (
    get_calculated_insights,
    get_datastreams,
    get_datatransforms,
)
from metadata.ingestion.source.database.data360.constant import (
    Constant as Data360Constant,
)
from metadata.ingestion.source.pipeline.data360pipeline.constant import (
    DEFAULT_PAGINATION_LIMIT,
    MetadataTypesConstant,
    ResponseConstant,
)
from metadata.ingestion.source.pipeline.data360pipeline.models import (
    CalculatedInsightDetails,
    DataCloudPipelineDetails,
    DataStreamDetails,
    DataTransformDetails,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

PipelineDetailsT = TypeVar("PipelineDetailsT", bound=BaseModel)


class Data360PipelineSource(PipelineServiceSource):
    """
    Extracts pipeline metadata from Salesforce Data 360:
    DataStreams, Calculated Insights, and DataTransforms as pipeline entities.
    """

    service_connection: Data360PipelineConnection

    @property
    def pagination_limit(self) -> int:
        """Page size for every Data 360 listing call."""
        return self.service_connection.paginationLimit or DEFAULT_PAGINATION_LIMIT

    @classmethod
    def create(
        cls,
        config_dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "Data360PipelineSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config if config.serviceConnection else None
        if not isinstance(connection, Data360PipelineConnection):
            raise InvalidSourceException(f"Expected Data360PipelineConnection, but got {connection}")
        return cls(config, metadata)

    def _filter_inactive_pipeline(self, name: str | None, status: str | None, pipeline_type: str) -> bool:
        if status != "ACTIVE":
            logger.debug("Filtering %s %s. Status: %s", pipeline_type, name, status)
            self.status.filter(str(name), "Pipeline Filtered Out")
            return True
        return False

    def _parse_pipeline(self, model: type[PipelineDetailsT], item: dict) -> PipelineDetailsT | None:
        """Validates one raw Data 360 object. A record the API returned without a
        name cannot become a pipeline — every FQN downstream is built from it — so
        it is reported and skipped instead of aborting the whole listing."""
        try:
            return model(**item)
        except ValidationError as exc:
            self.log_warning(f"Skipping malformed Data 360 {model.__name__}: {exc}")
            return None

    def _get_datastreams(self) -> Iterable[DataStreamDetails]:
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
            details = self._parse_pipeline(DataStreamDetails, item)
            if details:
                yield details

    def _get_calculated_insights(self) -> Iterable[CalculatedInsightDetails]:
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
            details = self._parse_pipeline(CalculatedInsightDetails, item)
            if details:
                yield details

    def _get_datatransforms(self) -> Iterable[DataTransformDetails]:
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
            details = self._parse_pipeline(DataTransformDetails, item)
            if details:
                yield details

    def get_pipelines_list(self) -> Iterable[DataCloudPipelineDetails]:  # pyright: ignore[reportIncompatibleMethodOverride]
        """Yields all Data 360 pipeline objects."""
        yield from self._get_datastreams()
        yield from self._get_calculated_insights()
        yield from self._get_datatransforms()

    def get_pipeline_name(self, pipeline_details: DataCloudPipelineDetails) -> str:
        return pipeline_details.get_name()

    def _get_life_cycle(self, created_date: str | None, updated_date: str | None) -> LifeCycle | None:
        created_at = self.get_timestamp(created_date)
        updated_at = self.get_timestamp(updated_date)
        if created_at is None or updated_at is None:
            return None
        return LifeCycle(
            updated=AccessDetails(timestamp=Timestamp(root=updated_at)),
            created=AccessDetails(timestamp=Timestamp(root=created_at)),
        )

    def _get_create_pipeline_request(self, pipeline_details: DataCloudPipelineDetails) -> CreatePipelineRequest:
        common_args: dict[str, Any] = {
            "name": EntityName(pipeline_details.get_name()),
            "displayName": pipeline_details.get_display_name(),
            "service": FullyQualifiedEntityName(self.context.get().pipeline_service),  # pyright: ignore[reportAttributeAccessIssue]
            "tags": get_tag_labels(
                self.metadata,
                pipeline_details.get_tags(),
                Data360Constant.TAG_CLASSIFICATION_NAME,
                bool(self.source_config.includeTags),
            ),
            "tasks": [
                Task(
                    name=pipeline_details.get_name(),
                    displayName=pipeline_details.get_display_name(),
                    taskType=pipeline_details.get_metadata_type(),
                )
            ],
            "description": pipeline_details.get_description(),
        }
        if isinstance(pipeline_details, DataStreamDetails):
            common_args["sourceUrl"] = self.get_source_url(
                self.service_connection.salesforceDomain,
                pipeline_details.recordId,
            )
        elif isinstance(pipeline_details, DataTransformDetails):
            common_args["lifeCycle"] = self._get_life_cycle(
                created_date=pipeline_details.createdDate,
                updated_date=pipeline_details.lastModifiedDate,
            )
        return CreatePipelineRequest(**common_args)

    def yield_pipeline(self, pipeline_details: DataCloudPipelineDetails) -> Iterable[Either[CreatePipelineRequest]]:
        """Converts a Data 360 object into a Pipeline entity."""
        try:
            pipeline_request = self._get_create_pipeline_request(pipeline_details)
            yield Either(right=pipeline_request)  # pyright: ignore[reportCallIssue]
            self.register_record(pipeline_request=pipeline_request)
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=f"{pipeline_details.get_name()} Pipeline",
                    error=f"Unexpected error while yielding Pipeline [{pipeline_details.get_name()}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_status(
        self, pipeline_details: DataCloudPipelineDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """Implemented in the operational ingestion source."""
        return iter([])

    def yield_pipeline_lineage_details(
        self, pipeline_details: DataCloudPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """Implemented in the lineage ingestion source."""
        return iter([])

    def yield_tag(
        self, pipeline_details: DataCloudPipelineDetails, **__
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Yields tags associated with the pipeline."""
        try:
            tags = pipeline_details.get_tags()
            yield from get_ometa_tag_and_classification(
                tags=tags,
                classification_name=Data360Constant.TAG_CLASSIFICATION_NAME,
                tag_description="Data360 Tags",
                classification_description="Tags associated with Salesforce Data 360",
                include_tags=bool(self.source_config.includeTags),
            )
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=f"{pipeline_details.get_name()} Pipeline Tag",
                    error=f"Unexpected error while yielding tags for {pipeline_details.get_name()}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_source_url(self, host: str | None, datastream_id: str | None) -> str | None:
        """Builds the Salesforce UI deep-link URL for a DataStream."""
        try:
            if host and datastream_id:
                base = host[:-3] if host.endswith(".my") else host
                return f"https://{base}.lightning.force.com/lightning/r/DataLakeObjectInstance/{datastream_id}/view"
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error("Unable to get source url: %s", exc)
            self.status.failed(
                error=StackTraceError(
                    name="Source Url",
                    error=f"Unable to get source url: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
        return None

    def get_timestamp(self, date_time: str | None) -> int | None:
        """Converts a Data 360 ISO-8601 timestamp to epoch milliseconds. Absent or
        literal-"null" values yield None, which callers must treat as "no run
        recorded" rather than as time zero."""
        if date_time and str(date_time).lower() != "null":
            return int(datetime.fromisoformat(str(date_time).replace("Z", "+00:00")).timestamp()) * 1000
        return None

    def log_warning(self, msg: str) -> None:
        logger.warning(msg)
        self.status.warning(msg, reason=msg)
