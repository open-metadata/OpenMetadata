"""
Mixin class containing Lineage specific methods

To be used by OpenMetadata class
"""
import logging
import traceback
from logging.config import DictConfigurator
from typing import Any, Dict, Generic, Optional, Type, TypeVar, Union

from pydantic import BaseModel

from metadata.config.common import FQDN_SEPARATOR
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import REST, APIError
from metadata.ingestion.ometa.utils import _get_formmated_table_name, get_entity_type

logger = logging.getLogger(__name__)

# Prevent sqllineage from modifying the logger config
def configure(self):
    pass


DictConfigurator.configure = configure

T = TypeVar("T", bound=BaseModel)  # pylint: disable=invalid-name


class OMetaLineageMixin(Generic[T]):
    """
    OpenMetadata API methods related to Lineage.

    To be inherited by OpenMetadata
    """

    client: REST

    def add_lineage(self, data: AddLineageRequest) -> Dict[str, Any]:
        """
        Add lineage relationship between two entities and returns
        the entity information of the origin node
        """
        try:
            self.client.put(self.get_suffix(AddLineageRequest), data=data.json())
        except APIError as err:
            logger.error(
                "Error %s trying to PUT lineage for %s", err.status_code, data.json()
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
        entity_name = get_entity_type(entity)
        search = (
            f"?upstreamDepth={min(up_depth, 3)}&downstreamDepth={min(down_depth, 3)}"
        )

        try:
            res = self.client.get(
                f"{self.get_suffix(AddLineageRequest)}/{entity_name}/{path}{search}"
            )
            return res
        except APIError as err:
            logger.error(
                f"Error {err.status_code} trying to GET linage for "
                + f"{entity.__name__} and {path}"
            )
            return None

    def _create_lineage_by_table_name(
        self, from_table: str, to_table: str, service_name: str, database: str
    ):
        """
        This method is to create a lineage between two tables
        """
        try:
            from_fqdn = f"{service_name}{FQDN_SEPARATOR}{database}{FQDN_SEPARATOR}{_get_formmated_table_name(str(from_table))}"
            from_entity: Table = self.get_by_name(entity=Table, fqdn=from_fqdn)

            to_fqdn = f"{service_name}{FQDN_SEPARATOR}{database}{FQDN_SEPARATOR}{_get_formmated_table_name(str(to_table))}"
            to_entity: Table = self.get_by_name(entity=Table, fqdn=to_fqdn)
            if not from_entity or not to_entity:
                return None

            lineage = AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(
                        id=from_entity.id.__root__,
                        type="table",
                    ),
                    toEntity=EntityReference(
                        id=to_entity.id.__root__,
                        type="table",
                    ),
                )
            )
            created_lineage = self.add_lineage(lineage)
            logger.info(f"Successfully added Lineage {created_lineage}")

        except Exception as err:
            logger.debug(traceback.print_exc())
            logger.error(err)

    def ingest_lineage_by_query(self, query: str, database: str, service_name: str):
        """
        This method parses the query to get source, target and intermediate table names to create lineage
        """
        from sqllineage.runner import LineageRunner

        try:
            result = LineageRunner(query)
            for intermediate_table in result.intermediate_tables:
                for source_table in result.source_tables:
                    self._create_lineage_by_table_name(
                        source_table, intermediate_table, service_name, database
                    )
                for target_table in result.target_tables:
                    self._create_lineage_by_table_name(
                        intermediate_table, target_table, service_name, database
                    )
            if not result.intermediate_tables:
                for target_table in result.target_tables:
                    for source_table in result.source_tables:
                        self._create_lineage_by_table_name(
                            source_table, target_table, service_name, database
                        )
        except Exception as err:
            logger.error(str(err))
