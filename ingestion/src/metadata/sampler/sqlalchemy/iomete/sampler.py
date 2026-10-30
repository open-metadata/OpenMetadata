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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.iomete.utils import copy_connection_for_table
from metadata.sampler.sampler_config import SamplerConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler


class IometeSampler(SQASampler):
    """Keep sampling in the attached table's catalog."""

    def __init__(
        self,
        service_connection_config: IometeConnection,
        ometa_client: OpenMetadata,
        entity: Table,
        config: SamplerConfig | None = None,
        **kwargs: Any,
    ):
        super().__init__(
            service_connection_config=copy_connection_for_table(service_connection_config, entity, ometa_client),
            ometa_client=ometa_client,
            entity=entity,
            config=config,
            **kwargs,
        )
