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

from typing import Any

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.iometeConnection import IometeConnection
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import DatabaseServiceProfilerPipeline
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.iomete.utils import copy_connection_for_table
from metadata.profiler.interface.sqlalchemy.profiler_interface import SQAProfilerInterface
from metadata.sampler.sampler_interface import SamplerInterface


class IometeProfilerInterface(SQAProfilerInterface):
    """Keep profiling and its shared sampler in the same target catalog."""

    def __init__(
        self,
        service_connection_config: IometeConnection,
        ometa_client: OpenMetadata,
        entity: Table,
        source_config: DatabaseServiceProfilerPipeline,
        sampler: SamplerInterface,
        thread_count: int | None,
        timeout_seconds: int = 43200,
        **kwargs: Any,
    ):
        # The parent consumes the unwrapped connector config despite its wrapper annotation.
        super().__init__(
            service_connection_config=copy_connection_for_table(service_connection_config, entity, ometa_client),  # pyright: ignore[reportArgumentType]
            ometa_client=ometa_client,
            entity=entity,
            source_config=source_config,
            sampler=sampler,
            thread_count=thread_count,
            timeout_seconds=timeout_seconds,
            **kwargs,
        )
