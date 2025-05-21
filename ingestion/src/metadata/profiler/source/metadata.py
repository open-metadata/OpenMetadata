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
OpenMetadata source for the profiler
"""
from typing import Iterable, List, Optional, cast

from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.source.fetcher.entity_fetcher import EntityFetcher
from metadata.profiler.source.model import ProfilerSourceAndEntity
from metadata.utils.logger import profiler_logger

logger = profiler_logger()

TABLE_FIELDS = ["tableProfilerConfig", "columns", "customMetrics"]
TAGS_FIELD = ["tags"]


class OpenMetadataSource(Source):
    """
    This source lists and filters the entities that need
    to be processed by the profiler workflow.

    Note that in order to manage the following steps we need
    to test the connection against the Database Service Source.
    We do this here as well.
    """

    @property
    def name(self) -> str:
        return "OpenMetadata Service"

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
    ):
        super().__init__()

        self.config = config
        self.metadata = metadata
        self.test_connection()

        # Init and type the source config
        self.source_config: DatabaseServiceProfilerPipeline = cast(
            DatabaseServiceProfilerPipeline, self.config.source.sourceConfig.config
        )  # Used to satisfy type checked

        if not self._validate_service_name():
            raise ValueError(
                f"Service name `{self.config.source.serviceName}` does not exist. "
                "Make sure you have run the ingestion for the service specified in the profiler workflow. "
                "If so, make sure the profiler service name matches the service name specified during ingestion "
                "and that your ingestion token (settings > bots) is still valid."
            )

        logger.info(
            f"Starting profiler for service {self.config.source.serviceName}"
            f":{self.config.source.type.lower()}"
        )

    def _get_fields(self) -> List[str]:
        """Get the fields required to process the tables"""
        return (
            TABLE_FIELDS
            if not self.source_config.processPiiSensitive
            else TABLE_FIELDS + TAGS_FIELD
        )

    def _validate_service_name(self):
        """Validate service name exists in OpenMetadata"""
        return self.metadata.get_by_name(
            entity=DatabaseService, fqn=self.config.source.serviceName  # type: ignore
        )

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        """
        Our source is the ometa client. Validate the
        health check before moving forward
        """
        self.metadata.health_check()

    def _iter(self, *_, **__) -> Iterable[Either[ProfilerSourceAndEntity]]:
        global_profiler_config = self.metadata.get_profiler_config_settings()
        entity_fetcher = EntityFetcher(
            self.config, self.metadata, global_profiler_config, self.status
        )
        yield from entity_fetcher.fetch()

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "Step":
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config=config, metadata=metadata)

    def close(self) -> None:
        """Nothing to close"""
