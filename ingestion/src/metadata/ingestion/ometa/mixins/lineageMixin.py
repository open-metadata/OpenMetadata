"""
Mixin class containing Lineage specific methods

To be used by OpenMetadata class
"""
import logging
from typing import Any, Dict, Generic, Optional, Type, TypeVar, Union

from pydantic import BaseModel

from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.ingestion.ometa.client import REST, APIError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class OMetaLineageMixin(Generic[T]):
    """
    OpenMetadata API methods related to Lineage.

    To be inherited by OpenMetadata
    """

    client: REST

    def add_lineage(self, data: AddLineage) -> Dict[str, Any]:
        """
        Add lineage relationship between two entities and returns
        the entity information of the origin node
        """
        try:
            self.client.put(self.get_suffix(AddLineage), data=data.json())
        except APIError as err:
            logger.error(
                f"Error {err.status_code} trying to PUT lineage for {data.json()}"
            )
            raise err

        from_entity_lineage = self.get_lineage_by_id(
            data.edge.fromEntity.type, str(data.edge.fromEntity.id.__root__)
        )

        return from_entity_lineage

    def get_lineage_by_id(
        self,
        entity: Union[Type[T], str],
        entity_id: str,
        up_depth: int = 1,
        down_depth: int = 1,
    ) -> Optional[Dict[str, Any]]:
        """
        Get lineage details for an entity `id`
        :param entity: Type of the entity
        :param entity_id: Entity ID
        :param up_depth: Upstream depth of lineage (default=1, min=0, max=3)"
        :param down_depth: Downstream depth of lineage (default=1, min=0, max=3)
        """
        return self._get_lineage(
            entity=entity, path=entity_id, up_depth=up_depth, down_depth=down_depth
        )

    def get_lineage_by_name(
        self,
        entity: Union[Type[T], str],
        fqdn: str,
        up_depth: int = 1,
        down_depth: int = 1,
    ) -> Optional[Dict[str, Any]]:
        """
        Get lineage details for an entity `id`
        :param entity: Type of the entity
        :param fqdn: Entity FQDN
        :param up_depth: Upstream depth of lineage (default=1, min=0, max=3)"
        :param down_depth: Downstream depth of lineage (default=1, min=0, max=3)
        """
        return self._get_lineage(
            entity=entity,
            path=f"name/{fqdn}",
            up_depth=up_depth,
            down_depth=down_depth,
        )

    def _get_lineage(
        self,
        entity: Union[Type[T], str],
        path: str,
        up_depth: int = 1,
        down_depth: int = 1,
    ) -> Optional[Dict[str, Any]]:
        """
        Generic function to get entity data.
        :param entity: Type of the entity
        :param path: URL suffix by FQDN or ID
        :param up_depth: Upstream depth of lineage (default=1, min=0, max=3)"
        :param down_depth: Downstream depth of lineage (default=1, min=0, max=3)
        """
        entity_name = self.get_entity_type(entity)
        search = (
            f"?upstreamDepth={min(up_depth, 3)}&downstreamDepth={min(down_depth, 3)}"
        )

        try:
            res = self.client.get(
                f"{self.get_suffix(AddLineage)}/{entity_name}/{path}{search}"
            )
            return res
        except APIError as err:
            logger.error(
                f"Error {err.status_code} trying to GET linage for {entity.__class__.__name__} and {path}"
            )
            return None
