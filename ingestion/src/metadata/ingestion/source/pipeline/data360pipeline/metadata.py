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
from metadata.generated.schema.type.lifeCycle import AccessDetails, LifeCycle
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.parser import InvalidWorkflowException
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.data360.client import (
    get_calculated_insights,
    get_datastreams,
    get_datatransforms,
)
from metadata.ingestion.source.pipeline.data360pipeline.constant import (
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


class Data360PipelineSource(PipelineServiceSource):
    """
    Extracts pipeline metadata from Salesforce Data 360:
    DataStreams, Calculated Insights, and DataTransforms as pipeline entities.
    """

    @classmethod
    def create(
        cls,
        config_dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "Data360PipelineSource":
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: Data360PipelineConnection = config.serviceConnection.root.config
        if not isinstance(connection, Data360PipelineConnection):
            raise InvalidSourceException(
                f"Expected Data360PipelineConnection, but got {connection}"
            )
        if not connection.data360DbServiceName:
            raise InvalidWorkflowException(
                "Please provide the Data360 database service name in the service connection"
            )
        return cls(config, metadata)

    def _filter_inactive_pipeline(self, name: str, status: str, pipeline_type: str) -> bool:
        if status != "ACTIVE":
            logger.debug(f"Filtering {pipeline_type} {name}. Status: {status}")
            self.status.filter(name, "Pipeline Filtered Out")
            return True
        return False

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
            yield DataStreamDetails(**item)

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
            yield CalculatedInsightDetails(**item)

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
            yield DataTransformDetails(**item)

    def get_pipelines_list(self) -> Iterable[DataCloudPipelineDetails]:
        """Yields all Data 360 pipeline objects."""
        self.pagination_limit = self.config.serviceConnection.root.config.paginationLimit
        yield from self._get_datastreams()
        yield from self._get_calculated_insights()
        yield from self._get_datatransforms()

    def get_pipeline_name(self, pipeline_details: DataCloudPipelineDetails) -> str:
        return pipeline_details.get_name()

    def _get_life_cycle(self, createdDate, updatedDate):
        if createdDate and updatedDate:
            return LifeCycle(
                updated=AccessDetails(timestamp=self.get_timestamp(updatedDate)),
                created=AccessDetails(timestamp=self.get_timestamp(createdDate)),
            )
        return None

    def _get_create_pipeline_request(
        self, pipeline_details: DataCloudPipelineDetails
    ) -> CreatePipelineRequest:
        common_args = {
            "name": pipeline_details.get_name(),
            "displayName": pipeline_details.get_display_name(),
            "service": self.config.serviceName,
            "tags": get_tag_labels(
                self.metadata,
                pipeline_details.get_tags(),
                self.source_config.tagClassificationName,
                self.source_config.includeTags,
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
                createdDate=pipeline_details.createdDate,
                updatedDate=pipeline_details.lastModifiedDate,
            )
        return CreatePipelineRequest(**common_args)

    def yield_pipeline(
        self, pipeline_details: DataCloudPipelineDetails
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """Converts a Data 360 object into a Pipeline entity."""
        try:
            pipeline_request = self._get_create_pipeline_request(pipeline_details)
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{pipeline_details.get_name()} Pipeline",
                    error=f"Unexpected error while yielding Pipeline [{pipeline_details.get_name()}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_pipeline_status(
        self, _: DataCloudPipelineDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """Implemented in the operational ingestion source."""

    def yield_pipeline_lineage_details(
        self, _: DataCloudPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """Implemented in the lineage ingestion source."""

    def yield_tag(
        self, pipeline_details: DataCloudPipelineDetails, **__
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Yields tags associated with the pipeline."""
        try:
            tags = pipeline_details.get_tags()
            yield from get_ometa_tag_and_classification(
                tags=tags,
                classification_name=self.source_config.tagClassificationName,
                tag_description="Data360 Tags",
                classification_description="Tags associated with Salesforce Data 360",
                include_tags=self.source_config.includeTags,
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{pipeline_details.get_name()} Pipeline Tag",
                    error=f"Unexpected error while yielding tags for {pipeline_details.get_name()}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_source_url(
        self, host: str | None, datastream_id: str | None
    ) -> str | None:
        """Builds the Salesforce UI deep-link URL for a DataStream."""
        try:
            if host and datastream_id:
                if "my" in host:
                    return f"https://{host.split('my')[0]}lightning.force.com/lightning/r/DataLakeObjectInstance/{datastream_id}/view"
                return f"https://{host}.lightning.force.com/lightning/r/DataLakeObjectInstance/{datastream_id}/view"
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get source url: {exc}")
            self.status.failed(
                error=StackTraceError(
                    name="Source Url",
                    error=f"Unable to get source url: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
        return None

    def get_timestamp(self, date_time: str) -> int | None:
        if date_time and str(date_time).lower() != "null":
            return (
                int(datetime.fromisoformat(str(date_time).replace("Z", "+00:00")).timestamp())
                * 1000
            )
        return None

    def log_warning(self, msg: str) -> None:
        logger.warning(msg)
        self.status.warning(msg, reason=msg)
