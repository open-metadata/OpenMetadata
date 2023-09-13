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
"""
Mixin class containing Size specific methods

To be used by OpenMetadata class
"""
import traceback
from typing import Optional

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.size import Size
from metadata.ingestion.api.models import Entity
from metadata.ingestion.ometa.client import REST
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class SizeMixin:
    """
    OpenMetadata API methods related to Tables.

    To be inherited by OpenMetadata
    """

    client: REST

    def ingest_size_data(self, entity: Entity, size: Size) -> Optional[Entity]:
        """
        PUT size data for a entity

        :param entity: Entity to update the size for
        :param size: Size data to add
        """
        resp = None
        try:
            entity_type = entity.__class__
            resp = self.client.put(
                f"{self.get_suffix(entity_type)}/{entity.fullyQualifiedName.__root__}/size",
                data=size.json(),
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to PUT size data for {entity.fullyQualifiedName.__root__}: {exc}"
            )

        if resp:
            try:
                return Entity(**resp)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error trying to parse size data results from {entity.fullyQualifiedName.__root__}: {exc}"
                )

        return None
