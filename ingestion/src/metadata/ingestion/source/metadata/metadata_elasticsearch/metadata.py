#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Metadata ES source module"""

import traceback
from time import sleep
from typing import Optional

from metadata.generated.schema.api.createEventPublisherJob import (
    CreateEventPublisherJob,
)
from metadata.generated.schema.entity.services.connections.metadata.metadataESConnection import (
    MetadataESConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.system.eventPublisherJob import (
    EventPublisherResult,
    PublisherType,
    RunMode,
    Status,
)
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MetadataElasticsearchSource(Source):
    """
    Metadata Elasticsearch Source
    Used for metadata to ES pipeline

    This job should eventually become an automation workflow
    triggered externally rather than a connector.
    """

    config: WorkflowSource

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection: MetadataESConnection = (
            config.serviceConnection.__root__.config
        )
        self.source_config = self.config.sourceConfig.config
        self.reindex_job: Optional[EventPublisherResult] = None

    def prepare(self):
        """Nothing to prepare"""

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: MetadataESConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, MetadataESConnection):
            raise InvalidSourceException(
                f"Expected MetadataESConnection, but got {connection}"
            )
        return cls(config, metadata)

    def create_reindex_job(self, job_config: CreateEventPublisherJob):
        """Patch table constraints"""
        try:
            self.reindex_job = self.metadata.reindex_es(config=job_config)
            logger.debug("Successfully created the elasticsearch reindex job")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Unexpected error while triggering elasticsearch reindex job: {exc}"
            )

    def _iter(self, *_, **__):
        job_config = CreateEventPublisherJob(
            name=self.config.serviceName,
            publisherType=PublisherType.elasticSearch,
            runMode=RunMode.batch,
            batchSize=self.source_config.batchSize,
            searchIndexMappingLanguage=self.source_config.searchIndexMappingLanguage,
            entities=self.service_connection.entities,
            recreateIndex=self.source_config.recreateIndex,
        )

        self.create_reindex_job(job_config)

        if self.reindex_job:
            self.log_reindex_status()

        yield from []  # nothing to yield

    def log_reindex_status(self) -> None:
        """
        Method to log re-indexing job status.
        """
        status = None
        total_retries_count = 3
        current_try = 1

        while status not in {Status.completed, Status.failed, Status.stopped}:
            sleep(5)
            job = self.metadata.get_reindex_job_status(model_str(self.reindex_job.id))
            if job and job.stats and job.stats.jobStats:
                logger.info(
                    f"Processed {job.stats.jobStats.processedRecords} records,"
                    f"{job.stats.jobStats.successRecords} succeeded"
                    f"and {job.stats.jobStats.failedRecords} failed."
                )
                status = job.status
                current_try = 1
            else:
                logger.warning("Failed to fetch job stats")
                current_try += 1

            if current_try >= total_retries_count:
                logger.error(
                    f"Failed to fetch job stats after {total_retries_count} retries"
                )
                break

        if job.failure and job.failure.jobError:
            logger.warning(f"Failure Context: {job.failure.jobError.context}")
            logger.warning(f"Last Error: {job.failure.jobError.lastFailedReason}")

    def close(self):
        self.metadata.close()

    def test_connection(self) -> None:
        pass
