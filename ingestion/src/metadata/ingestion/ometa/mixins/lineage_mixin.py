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
Mixin class containing Lineage specific methods

To be used by OpenMetadata class
"""
import functools
import traceback
from copy import deepcopy
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union

from pydantic import BaseModel

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.entityLineage import ColumnLineage, EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.parser import LINEAGE_PARSING_TIMEOUT
from metadata.ingestion.models.patch_request import build_patch
from metadata.ingestion.ometa.client import REST, APIError
from metadata.ingestion.ometa.utils import get_entity_type, model_str, quote
from metadata.utils.logger import ometa_logger
from metadata.utils.lru_cache import LRU_CACHE_SIZE, LRUCache

logger = ometa_logger()

T = TypeVar("T", bound=BaseModel)


search_cache = LRUCache(LRU_CACHE_SIZE)


class OMetaLineageMixin(Generic[T]):
    """
    OpenMetadata API methods related to Lineage.

    To be inherited by OpenMetadata
    """

    client: REST

    def _merge_column_lineage(
        self, original: List[Dict[str, Any]], updated: List[Dict[str, Any]]
    ):
        flat_original_result = set()
        flat_updated_result = set()
        try:
            for column in original or []:
                if column.get("toColumn") and column.get("fromColumns"):
                    flat_original_result.add(
                        (*column.get("fromColumns", []), column.get("toColumn"))
                    )
            for column in updated or []:
                if not isinstance(column, dict):
                    data = column.model_dump()
                else:
                    data = column
                if data.get("toColumn") and data.get("fromColumns"):
                    flat_updated_result.add(
                        (*data.get("fromColumns", []), data.get("toColumn"))
                    )
        except Exception as exc:
            logger.debug(f"Error while merging column lineage: {exc}")
            logger.debug(traceback.format_exc())
        union_result = flat_original_result.union(flat_updated_result)
        if flat_original_result == union_result:
            return original
        return [
            {"fromColumns": list(col_data[:-1]), "toColumn": col_data[-1]}
            for col_data in union_result
        ]

    def _update_cache(self, request: AddLineageRequest, response: Dict[str, Any]):
        try:
            for res in response.get("downstreamEdges", []):
                if str(request.edge.toEntity.id.root) == res.get("toEntity"):
                    search_cache.put(
                        (
                            request.edge.fromEntity.id.root,
                            request.edge.toEntity.id.root,
                        ),
                        {"edge": res.get("lineageDetails")},
                    )
                    return
        except Exception as e:
            logger.debug(f"Error while updating cache: {e}")

        # discard the cache if failed to update
        search_cache.put(
            (
                request.edge.fromEntity.id.root,
                request.edge.toEntity.id.root,
            ),
            None,
        )

    def add_lineage(
        self, data: AddLineageRequest, check_patch: bool = False
    ) -> Dict[str, Any]:
        """
        Add lineage relationship between two entities and returns
        the entity information of the origin node
        """
        try:
            patch_op_success = False
            if check_patch and data.edge.lineageDetails:
                from_id = data.edge.fromEntity.id.root
                to_id = data.edge.toEntity.id.root
                edge = self.get_lineage_edge(from_id, to_id)
                if edge:
                    original: AddLineageRequest = deepcopy(data)
                    original.edge.lineageDetails.columnsLineage = edge["edge"].get(
                        "columnsLineage", []
                    )
                    original.edge.lineageDetails.pipeline = (
                        EntityReference(
                            id=edge["edge"]["pipeline"]["id"],
                            type=edge["edge"]["pipeline"]["type"],
                        )
                        if edge["edge"].get("pipeline")
                        else None
                    )
                    # merge the original and new column level lineage
                    data.edge.lineageDetails.columnsLineage = (
                        self._merge_column_lineage(
                            original.edge.lineageDetails.columnsLineage,
                            data.edge.lineageDetails.columnsLineage,
                        )
                    )

                    serialized_col_details = []
                    for col_lin in data.edge.lineageDetails.columnsLineage or []:
                        serialized_col_details.append(ColumnLineage(**col_lin))
                    data.edge.lineageDetails.columnsLineage = serialized_col_details

                    serialized_col_details_og = []
                    for col_lin in original.edge.lineageDetails.columnsLineage or []:
                        serialized_col_details_og.append(ColumnLineage(**col_lin))
                    original.edge.lineageDetails.columnsLineage = (
                        serialized_col_details_og
                    )

                    # Keep the pipeline information from the original
                    # lineage if available
                    if (
                        original.edge.lineageDetails.pipeline
                        and not data.edge.lineageDetails.pipeline
                    ):
                        data.edge.lineageDetails.pipeline = (
                            original.edge.lineageDetails.pipeline
                        )
                    patch = self.patch_lineage_edge(original=original, updated=data)
                    if patch:
                        patch_op_success = True

            if patch_op_success is False:
                self.client.put(
                    self.get_suffix(AddLineageRequest), data=data.model_dump_json()
                )

        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.error(
                "Error %s trying to PUT lineage for %s: %s",
                err.status_code,
                data.model_dump_json(),
                str(err),
            )
            raise err

        from_entity_lineage = self.get_lineage_by_id(
            data.edge.fromEntity.type, str(data.edge.fromEntity.id.root)
        )

        self._update_cache(data, from_entity_lineage)
        return from_entity_lineage

    def get_lineage_edge(
        self,
        from_id: str,
        to_id: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Get the lineage edge between two entities.

        Args:
            from_id (str): The ID of the source entity.
            to_id (str): The ID of the target entity.

        Returns:
            Optional[Dict[str, Any]]: The lineage edge if found, None otherwise.
        """
        try:
            if (from_id, to_id) in search_cache:
                return search_cache.get((from_id, to_id))
            res = self.client.get(
                f"{self.get_suffix(AddLineageRequest)}/getLineageEdge/"
                f"{from_id}/{to_id}"
            )
            search_cache.put((from_id, to_id), res)
            return res
        except APIError as err:
            if err.status_code != 404:
                logger.debug(traceback.format_exc())
                logger.debug(
                    f"Error {err.status_code} trying to GET linage edge between "
                    f"{from_id} and {to_id}: {err}"
                )
            return None

    def patch_lineage_edge(
        self,
        original: AddLineageRequest,
        updated: AddLineageRequest,
    ) -> Optional[bool]:
        """
        Patches a lineage edge between two entities.

        Args:
            original (AddLineageRequest): The original lineage request.
            updated (AddLineageRequest): The updated lineage request.

        Returns:
            bool: True if the patch operation is successful, False otherwise.
        """
        try:
            allowed_fields = {"columnsLineage": True, "pipeline": True}
            patch = build_patch(
                source=original.edge.lineageDetails,
                destination=updated.edge.lineageDetails,
                allowed_fields=allowed_fields,
                remove_change_description=False,
            )
            if patch:
                self.client.patch(
                    f"{self.get_suffix(AddLineageRequest)}/{original.edge.fromEntity.type}/"
                    f"{original.edge.fromEntity.id.root}/{original.edge.toEntity.type}"
                    f"/{original.edge.toEntity.id.root}",
                    data=str(patch),
                )
            return True
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error Patching Lineage Edge {err.status_code} "
                f"for {original.edge.fromEntity.fullyQualifiedName}"
            )
        return False

    def get_lineage_by_id(
        self,
        entity: Union[Type[T], str],
        entity_id: Union[str, Uuid],
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
            entity=entity,
            path=model_str(entity_id),
            up_depth=up_depth,
            down_depth=down_depth,
        )

    def get_lineage_by_name(
        self,
        entity: Union[Type[T], str],
        fqn: Union[str, FullyQualifiedEntityName],
        up_depth: int = 1,
        down_depth: int = 1,
    ) -> Optional[Dict[str, Any]]:
        """
        Get lineage details for an entity `id`
        :param entity: Type of the entity
        :param fqn: Entity FQN
        :param up_depth: Upstream depth of lineage (default=1, min=0, max=3)"
        :param down_depth: Downstream depth of lineage (default=1, min=0, max=3)
        """
        return self._get_lineage(
            entity=entity,
            path=f"name/{quote(model_str(fqn))}",
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
        :param path: URL suffix by FQN or ID
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
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error {err.status_code} trying to GET linage for "
                + f"{entity.__name__} and {path}: {err}"
            )
            return None

    def delete_lineage_edge(self, edge: EntitiesEdge) -> None:
        """
        Remove the given Edge
        """
        try:
            self.client.delete(
                f"{self.get_suffix(AddLineageRequest)}/{edge.fromEntity.type}/{edge.fromEntity.id.root}/"
                f"{edge.toEntity.type}/{edge.toEntity.id.root}"
            )
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error {err.status_code} trying to DELETE linage for {edge}")

    @functools.lru_cache(maxsize=LRU_CACHE_SIZE)
    def delete_lineage_by_source(
        self, entity_type: str, entity_id: str, source: str
    ) -> None:
        """
        Remove the given Edge
        """
        try:
            self.client.delete(
                f"{self.get_suffix(AddLineageRequest)}/{entity_type}/{entity_id}/"
                f"type/{source}"
            )
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error {err.status_code} trying to DELETE linage for {entity_id} of type {source}"
            )

    def add_lineage_by_query(
        self,
        database_service: DatabaseService,
        sql: str,
        database_name: str = None,
        schema_name: str = None,
        timeout: int = LINEAGE_PARSING_TIMEOUT,
        check_patch: bool = False,
    ) -> None:
        """
        Method parses the query and generated the lineage
        between source and target tables
        """

        # pylint: disable=import-outside-toplevel,cyclic-import
        # importing inside the method to avoid circular import
        from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query

        if database_service:
            connection_type = database_service.serviceType.value
            add_lineage_request = get_lineage_by_query(
                metadata=self,
                service_name=database_service.name.root,
                dialect=ConnectionTypeDialectMapper.dialect_of(connection_type),
                query=sql,
                database_name=database_name,
                schema_name=schema_name,
                timeout_seconds=timeout,
            )
            for lineage_request in add_lineage_request or []:
                if lineage_request.right:
                    resp = self.add_lineage(
                        lineage_request.right, check_patch=check_patch
                    )
                    entity_name = resp.get("entity", {}).get("name")
                    for node in resp.get("nodes", []):
                        logger.info(
                            f"added lineage between table {node.get('name')} and {entity_name} "
                        )
                elif lineage_request.left:
                    logger.error(
                        f"Error while adding lineage: {lineage_request.left.error}"
                    )

    def _set_permissions(self):
        try:
            if not hasattr(self, "is_edit_table_allowed"):
                permissions = self.client.get(path="/permissions")
                for permission in permissions.get("data", []):
                    if permission.get("resource") != "table":
                        continue
                    for action in permission.get("permissions", []):
                        if (
                            action.get("operation") == "EditAll"
                            and action.get("access") == "allow"
                        ):
                            self.is_edit_table_allowed = True
                            return
                logger.warning("Please grant EditAll permission to the user")
        except Exception as exc:
            logger.debug(f"Error while setting permissions: {exc}")
            logger.debug(traceback.format_exc())
        self.is_edit_table_allowed = False

    def patch_lineage_processed_flag(
        self,
        entity: Type[T],
        fqn: str,
    ) -> None:
        """
        Patch the processed lineage flag for an entity.
        """
        self._set_permissions()
        if not self.is_edit_table_allowed:
            return

        try:
            original_entity = self.get_by_name(entity=entity, fqn=fqn)
            if not original_entity:
                return

            updated_entity = original_entity.model_copy(deep=True)
            updated_entity.processedLineage = True

            self.patch(
                entity=entity, source=original_entity, destination=updated_entity
            )
        except Exception as exc:
            logger.debug(f"Error while patching lineage processed flag: {exc}")
            logger.debug(traceback.format_exc())
