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
Entity Fetcher
"""

from typing import Iterator, Optional

from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.settings.settings import Settings
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.status import Status
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.source.fetcher.fetcher_strategy import (
    DatabaseFetcherStrategy,
    FetcherStrategy,
    StorageFetcherStrategy,
)
from metadata.profiler.source.model import ProfilerSourceAndEntity
from metadata.utils.entity_utils import service_class


class EntityFetcher:
    """Entity fetcher context class"""

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
        global_profiler_config: Optional[Settings],
        status: Status,
    ):
        self.config = config
        self.metadata = metadata
        self.global_profiler_config = global_profiler_config
        self.status = status
        self.strategy = self._get_strategy()

    def _get_strategy(self) -> FetcherStrategy:
        """Get strategy for entity fetcher"""
        service_type = service_class(self.config.source.type)

        if service_type is DatabaseService:
            return DatabaseFetcherStrategy(
                self.config, self.metadata, self.global_profiler_config, self.status
            )

        if service_type is StorageService:
            return StorageFetcherStrategy(
                self.config, self.metadata, self.global_profiler_config, self.status
            )

        raise NotImplementedError(
            f"Fetcher strategy not implemented for service type {service_type}"
        )

    def fetch(self) -> Iterator[Either[ProfilerSourceAndEntity]]:
        """Fetch entities"""
        yield from self.strategy.fetch()
