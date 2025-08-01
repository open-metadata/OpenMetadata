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
OMeta client create helpers
"""
import traceback
from typing import List

from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.ometa.ometa_api import C, OpenMetadata, T
from metadata.utils import fqn
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


def create_ometa_client(
    metadata_config: OpenMetadataConnection,
) -> OpenMetadata[T, C]:  # pyright: ignore[reportInvalidTypeVarUse]
    """Create an OpenMetadata client

    Args:
        metadata_config (OpenMetadataConnection): OM connection config

    Returns:
        OpenMetadata: an OM client
    """
    try:
        metadata = OpenMetadata[T, C](metadata_config)
        metadata.health_check()
        return metadata
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Wild error initialising the OMeta Client {exc}")
        raise ValueError(exc)


def get_chart_entities_from_id(
    chart_ids: List[str], metadata: OpenMetadata, service_name: str
) -> List[FullyQualifiedEntityName]:
    """
    Method to get the chart entity using get_by_name api
    """

    entities = []
    for chart_id in chart_ids:
        chart: Chart = metadata.get_by_name(
            entity=Chart,
            fqn=fqn.build(
                metadata, Chart, chart_name=str(chart_id), service_name=service_name
            ),
        )
        if chart:
            entities.append(chart.fullyQualifiedName)
    return entities
