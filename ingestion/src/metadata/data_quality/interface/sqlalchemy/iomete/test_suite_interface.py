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

from typing import Any, cast

from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import SQATestSuiteInterface
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.iometeConnection import IometeConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.iomete_table_context import copy_connection_for_table


class IometeTestSuiteInterface(SQATestSuiteInterface):
    """Keep data-quality sessions in the attached table's catalog."""

    def __init__(
        self,
        service_connection_config: IometeConnection,
        ometa_client: OpenMetadata,
        sampler: SamplerInterface,
        table_entity: Table | None = None,
        **kwargs: Any,
    ):
        # The parent consumes the unwrapped connector config despite its wrapper annotation.
        super().__init__(
            service_connection_config=copy_connection_for_table(service_connection_config, table_entity, ometa_client),  # pyright: ignore[reportArgumentType]
            ometa_client=ometa_client,
            sampler=sampler,
            table_entity=cast("Table", table_entity),
            **kwargs,
        )
