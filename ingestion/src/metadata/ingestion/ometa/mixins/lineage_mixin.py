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
Mixin class containing Lineage specific methods

To be used by OpenMetadata class
"""

import functools
import json
import traceback
from copy import deepcopy
from typing import Any, Dict, Generic, Optional, Sequence, Type, TypeVar, Union, cast  # noqa: UP035

from pydantic import BaseModel

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.parser import LINEAGE_PARSING_TIMEOUT
from metadata.ingestion.models.ometa_lineage import OMetaFQNLineageRequest
from metadata.ingestion.models.patch_request import build_patch
from metadata.ingestion.ometa.client import REST, APIError
from metadata.ingestion.ometa.utils import get_entity_type, model_str, quote
from metadata.utils.logger import ometa_logger
from metadata.utils.lru_cache import LRU_CACHE_SIZE, LRUCache

logger = ometa_logger()

T = TypeVar("T", bound=BaseModel)


search_cache = LRUCache(LRU_CACHE_SIZE)
LINEAGE_ROUTE = "/lineage"


class OMetaLineageMixin(Generic[T]):
    """
    OpenMetadata API methods related to Lineage.

    To be inherited by OpenMetadata
    """

    client: REST

    @staticmethod
    def _lineage_reference_cache_key(entity_reference: EntityReference) -> str:
        return f"{entity_reference.type}:id:{model_str(entity_reference.id)}"

    @classmethod
    def _lineage_edge_cache_key(cls, from_entity: EntityReference, to_entity: EntityReference) -> str:
        return f"{cls._lineage_reference_cache_key(from_entity)}->{cls._lineage_reference_cache_key(to_entity)}"

    @staticmethod
    def _lineage_edge_path(from_entity: EntityReference, to_entity: EntityReference) -> str:
        return f"{from_entity.type}/{model_str(from_entity.id)}/{to_entity.type}/{model_str(to_entity.id)}"

    @staticmethod
    def _lineage_edge_lookup_path(from_entity: EntityReference, to_entity: EntityReference) -> str:
        return f"getLineageEdge/{model_str(from_entity.id)}/{model_str(to_entity.id)}"

    @staticmethod
    def _lineage_reference_name_cache_key(entity_type: str, entity_fqn: str) -> str:
        return f"{entity_type}:name:{model_str(entity_fqn)}"

    @classmethod
    def _lineage_edge_name_cache_key(
        cls,
        from_entity_type: str,
        from_entity_fqn: str,
        to_entity_type: str,
        to_entity_fqn: str,
    ) -> str:
        return (
            f"{cls._lineage_reference_name_cache_key(from_entity_type, from_entity_fqn)}->"
            f"{cls._lineage_reference_name_cache_key(to_entity_type, to_entity_fqn)}"
        )

    @staticmethod
    def _lineage_edge_path_by_name(
        from_entity_type: str,
        from_entity_fqn: str,
        to_entity_type: str,
        to_entity_fqn: str,
    ) -> str:
        return (
            f"{from_entity_type}/name/{quote(model_str(from_entity_fqn))}/"
            f"{to_entity_type}/name/{quote(model_str(to_entity_fqn))}"
        )

    @classmethod
    def _lineage_edge_lookup_path_by_name(
        cls,
        from_entity_type: str,
        from_entity_fqn: str,
        to_entity_type: str,
        to_entity_fqn: str,
    ) -> str:
        return "getLineageEdge/" + cls._lineage_edge_path_by_name(
            from_entity_type,
            from_entity_fqn,
            to_entity_type,
            to_entity_fqn,
        )

    def _get_lineage_edge_for_references(
        self,
        from_entity: EntityReference,
        to_entity: EntityReference,
    ) -> Optional[Dict[str, Any]]:  # noqa: UP006, UP045
        try:
            cache_key = self._lineage_edge_cache_key(from_entity, to_entity)
            if cache_key in search_cache:
                return search_cache.get(cache_key)
            res = cast(
                "dict[str, Any]",
                self.client.get(f"{LINEAGE_ROUTE}/{self._lineage_edge_lookup_path(from_entity, to_entity)}"),
            )
            search_cache.put(cache_key, res)
            return res  # noqa: TRY300
        except ValueError as err:
            logger.debug(str(err))
            return None
        except APIError as err:
            if err.status_code != 404:
                logger.debug(traceback.format_exc())
                logger.debug(
                    f"Error {err.status_code} trying to GET lineage edge between {from_entity} and {to_entity}: {err}"
                )
            return None

    def get_lineage_edge_by_name(
        self,
        from_entity_type: str,
        from_entity_fqn: str,
        to_entity_type: str,
        to_entity_fqn: str,
    ) -> Optional[Dict[str, Any]]:  # noqa: UP006, UP045
        try:
            cache_key = self._lineage_edge_name_cache_key(
                from_entity_type,
                from_entity_fqn,
                to_entity_type,
                to_entity_fqn,
            )
            if cache_key in search_cache:
                return search_cache.get(cache_key)
            res = cast(
                "dict[str, Any]",
                self.client.get(
                    f"{LINEAGE_ROUTE}/"
                    f"{self._lineage_edge_lookup_path_by_name(from_entity_type, from_entity_fqn, to_entity_type, to_entity_fqn)}"
                ),
            )
            search_cache.put(cache_key, res)
            return res  # noqa: TRY300
        except APIError as err:
            if err.status_code != 404:
                logger.debug(traceback.format_exc())
                logger.debug(
                    f"Error {err.status_code} trying to GET lineage edge between "
                    f"{from_entity_type}:{from_entity_fqn} and {to_entity_type}:{to_entity_fqn}: {err}"
                )
            return None

    def _merge_column_lineage(
        self,
        original: Sequence[Dict[str, Any] | ColumnLineage] | None,  # noqa: UP006
        updated: Sequence[Dict[str, Any] | ColumnLineage] | None,  # noqa: UP006
    ) -> list[dict[str, Any]]:
        flat_original_result = set()
        flat_updated_result = set()
        original_data: list[dict[str, Any]] = [
            column.model_dump() if isinstance(column, ColumnLineage) else column for column in original or []
        ]
        try:
            for column in original_data:
                if column.get("toColumn") and column.get("fromColumns"):
                    flat_original_result.add((*column.get("fromColumns", []), column.get("toColumn")))
            for column in updated or []:
                data = column.model_dump() if isinstance(column, ColumnLineage) else column
                if data.get("toColumn") and data.get("fromColumns"):
                    flat_updated_result.add((*data.get("fromColumns", []), data.get("toColumn")))
        except Exception as exc:
            logger.debug(f"Error while merging column lineage: {exc}")
            logger.debug(traceback.format_exc())
        union_result = flat_original_result.union(flat_updated_result)
        if flat_original_result == union_result:
            return original_data
        return [{"fromColumns": list(col_data[:-1]), "toColumn": col_data[-1]} for col_data in union_result]

    def _update_cache(self, request: AddLineageRequest, response: Dict[str, Any]):  # noqa: UP006
        try:
            cache_key = self._lineage_edge_cache_key(request.edge.fromEntity, request.edge.toEntity)
            for res in response.get("downstreamEdges", []):
                if self._is_matching_lineage_target(request.edge.toEntity, res.get("toEntity"), response):
                    search_cache.put(
                        cache_key,
                        {"edge": res.get("lineageDetails")},
                    )
                    return
        except Exception as e:
            logger.debug(f"Error while updating cache: {e}")

        search_cache.put(self._lineage_edge_cache_key(request.edge.fromEntity, request.edge.toEntity), None)

    @staticmethod
    def _is_matching_lineage_target(
        to_entity: EntityReference,
        downstream_edge_to_id: Optional[str],  # noqa: UP045
        response: Dict[str, Any],  # noqa: UP006
    ) -> bool:
        return model_str(to_entity.id) == downstream_edge_to_id

    def add_lineage(self, data: AddLineageRequest, check_patch: bool = False) -> Dict[str, Any]:  # noqa: UP006
        """
        Add lineage relationship between two entities and returns
        the entity information of the origin node
        """
        data = deepcopy(data)
        try:
            patch_op_success = False
            if check_patch and data.edge.lineageDetails:
                edge = self._get_lineage_edge_for_references(data.edge.fromEntity, data.edge.toEntity)
                if edge:
                    original: AddLineageRequest = deepcopy(data)
                    original.edge.lineageDetails.columnsLineage = edge["edge"].get("columnsLineage", [])
                    original.edge.lineageDetails.pipeline = (
                        EntityReference(
                            id=edge["edge"]["pipeline"]["id"],
                            type=edge["edge"]["pipeline"]["type"],
                        )
                        if edge["edge"].get("pipeline")
                        else None
                    )
                    # `original` mirrors `data`, so build_patch would see no sqlQuery diff. Null it so
                    # the incoming query is added/updated, while a missing one keeps the stored value.
                    original.edge.lineageDetails.sqlQuery = None
                    # merge the original and new column level lineage
                    data.edge.lineageDetails.columnsLineage = self._merge_column_lineage(
                        original.edge.lineageDetails.columnsLineage,
                        data.edge.lineageDetails.columnsLineage,
                    )

                    serialized_col_details = []
                    for col_lin in data.edge.lineageDetails.columnsLineage or []:
                        serialized_col_details.append(ColumnLineage(**col_lin))  # noqa: PERF401
                    data.edge.lineageDetails.columnsLineage = serialized_col_details

                    serialized_col_details_og = []
                    for col_lin in original.edge.lineageDetails.columnsLineage or []:
                        serialized_col_details_og.append(ColumnLineage(**col_lin))  # noqa: PERF401
                    original.edge.lineageDetails.columnsLineage = serialized_col_details_og

                    # Keep the pipeline information from the original
                    # lineage if available
                    if original.edge.lineageDetails.pipeline and not data.edge.lineageDetails.pipeline:
                        data.edge.lineageDetails.pipeline = original.edge.lineageDetails.pipeline
                    patch = self.patch_lineage_edge(original=original, updated=data)
                    if patch:
                        patch_op_success = True

            if patch_op_success is False:
                self.client.put(self.get_suffix(AddLineageRequest), data=data.model_dump_json())

        except APIError as err:
            logger.debug(traceback.format_exc())
            error = f"Error {err.status_code} trying to PUT lineage for {data.model_dump_json()}: {str(err)}"  # noqa: RUF010
            logger.error(error)
            return {"error": error}

        from_entity_lineage = self.get_lineage_by_id(data.edge.fromEntity.type, model_str(data.edge.fromEntity.id))

        if from_entity_lineage:
            self._update_cache(data, from_entity_lineage)
        return from_entity_lineage

    def add_lineage_by_name(
        self,
        from_entity_fqn: str,
        from_entity_type: str,
        to_entity_fqn: str,
        to_entity_type: str,
        lineage_details: Optional[LineageDetails] = None,  # noqa: UP045
        check_patch: bool = False,
    ) -> Dict[str, Any]:  # noqa: UP006
        lineage_details = deepcopy(lineage_details) if lineage_details else LineageDetails.model_validate({})
        try:
            patch_op_success = False
            if check_patch and lineage_details:
                edge = self.get_lineage_edge_by_name(
                    from_entity_type,
                    from_entity_fqn,
                    to_entity_type,
                    to_entity_fqn,
                )
                if edge:
                    original_columns = cast("list[dict[str, Any]]", edge["edge"].get("columnsLineage") or [])
                    original_pipeline = (
                        EntityReference.model_validate(edge["edge"]["pipeline"])
                        if edge["edge"].get("pipeline")
                        else None
                    )
                    original = LineageDetails.model_validate(
                        {
                            "columnsLineage": [
                                ColumnLineage.model_validate(column_lineage) for column_lineage in original_columns
                            ],
                            "pipeline": original_pipeline,
                        }
                    )
                    updated_columns = [
                        column_lineage.model_dump() for column_lineage in lineage_details.columnsLineage or []
                    ]
                    lineage_details.columnsLineage = [
                        ColumnLineage.model_validate(column_lineage)
                        for column_lineage in self._merge_column_lineage(
                            original_columns,
                            updated_columns,
                        )
                    ]

                    if original.pipeline and not lineage_details.pipeline:
                        lineage_details.pipeline = original.pipeline
                    patch = self.patch_lineage_edge_by_name(
                        from_entity_fqn=from_entity_fqn,
                        from_entity_type=from_entity_type,
                        to_entity_fqn=to_entity_fqn,
                        to_entity_type=to_entity_type,
                        original=original,
                        updated=lineage_details,
                    )
                    if patch:
                        patch_op_success = True

            if patch_op_success is False:
                self.client.put(
                    f"{LINEAGE_ROUTE}/"
                    f"{self._lineage_edge_path_by_name(from_entity_type, from_entity_fqn, to_entity_type, to_entity_fqn)}",
                    data=lineage_details.model_dump_json(),
                )

        except APIError as err:
            logger.debug(traceback.format_exc())
            error = (
                f"Error {err.status_code} trying to PUT lineage for "
                f"{from_entity_type}:{from_entity_fqn} -> {to_entity_type}:{to_entity_fqn}: {err!s}"
            )
            logger.error(error)
            return {"error": error}

        return self.get_lineage_by_name(from_entity_type, from_entity_fqn) or {
            "entity": {"fullyQualifiedName": from_entity_fqn}
        }

    def get_lineage_edge(
        self,
        from_id: str,
        to_id: str,
    ) -> Optional[Dict[str, Any]]:  # noqa: UP006, UP045
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
            res = self.client.get(f"{self.get_suffix(AddLineageRequest)}/getLineageEdge/{from_id}/{to_id}")
            search_cache.put((from_id, to_id), res)
            return res  # noqa: TRY300
        except APIError as err:
            if err.status_code != 404:
                logger.debug(traceback.format_exc())
                logger.debug(f"Error {err.status_code} trying to GET linage edge between {from_id} and {to_id}: {err}")
            return None

    def patch_lineage_edge(
        self,
        original: AddLineageRequest,
        updated: AddLineageRequest,
    ) -> Optional[bool]:  # noqa: UP045
        """
        Patches a lineage edge between two entities.

        Args:
            original (AddLineageRequest): The original lineage request.
            updated (AddLineageRequest): The updated lineage request.

        Returns:
            bool: True if the patch operation is successful, False otherwise.
        """
        try:
            allowed_fields = {"columnsLineage": True, "pipeline": True, "sqlQuery": True}
            patch = build_patch(
                source=original.edge.lineageDetails,
                destination=updated.edge.lineageDetails,
                allowed_fields=allowed_fields,
                remove_change_description=False,
            )
            if patch:
                self.client.patch(
                    f"{self.get_suffix(AddLineageRequest)}/"
                    f"{self._lineage_edge_path(original.edge.fromEntity, original.edge.toEntity)}",
                    data=str(patch),
                )
            return True  # noqa: TRY300
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error Patching Lineage Edge {err.status_code} for {original.edge.fromEntity.fullyQualifiedName}"
            )
        except ValueError as err:
            logger.debug(str(err))
        return False

    def patch_lineage_edge_by_name(
        self,
        from_entity_fqn: str,
        from_entity_type: str,
        to_entity_fqn: str,
        to_entity_type: str,
        original: LineageDetails,
        updated: LineageDetails,
    ) -> Optional[bool]:  # noqa: UP045
        try:
            allowed_fields = {"columnsLineage": True, "pipeline": True, "sqlQuery": True}
            patch = build_patch(
                source=original,
                destination=updated,
                allowed_fields=allowed_fields,
                remove_change_description=False,
            )
            if patch:
                self.client.patch(
                    f"{LINEAGE_ROUTE}/"
                    f"{self._lineage_edge_path_by_name(from_entity_type, from_entity_fqn, to_entity_type, to_entity_fqn)}",
                    data=str(patch),
                )
            return True  # noqa: TRY300
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error Patching Lineage Edge {err.status_code} for "
                f"{from_entity_type}:{from_entity_fqn} -> {to_entity_type}:{to_entity_fqn}"
            )
        return False

    def get_lineage_by_id(
        self,
        entity: Union[Type[T], str],  # noqa: UP006, UP007
        entity_id: Union[str, Uuid],  # noqa: UP007
        up_depth: int = 1,
        down_depth: int = 1,
    ) -> Optional[Dict[str, Any]]:  # noqa: UP006, UP045
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
        entity: Union[Type[T], str],  # noqa: UP006, UP007
        fqn: Union[str, FullyQualifiedEntityName],  # noqa: UP007
        up_depth: int = 1,
        down_depth: int = 1,
    ) -> Optional[Dict[str, Any]]:  # noqa: UP006, UP045
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
        entity: Union[Type[T], str],  # noqa: UP006, UP007
        path: str,
        up_depth: int = 1,
        down_depth: int = 1,
    ) -> Optional[Dict[str, Any]]:  # noqa: UP006, UP045
        """
        Generic function to get entity data.
        :param entity: Type of the entity
        :param path: URL suffix by FQN or ID
        :param up_depth: Upstream depth of lineage (default=1, min=0, max=3)"
        :param down_depth: Downstream depth of lineage (default=1, min=0, max=3)
        """
        entity_name = get_entity_type(entity)
        search = f"?upstreamDepth={min(up_depth, 3)}&downstreamDepth={min(down_depth, 3)}"

        try:
            res = self.client.get(f"{self.get_suffix(AddLineageRequest)}/{entity_name}/{path}{search}")
            return res  # noqa: RET504, TRY300
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error {err.status_code} trying to GET linage for " + f"{entity_name} and {path}: {err}")
            return None

    def delete_lineage_edge(self, edge: EntitiesEdge) -> None:
        """
        Remove the given Edge
        """
        try:
            self.client.delete(
                f"{self.get_suffix(AddLineageRequest)}/{self._lineage_edge_path(edge.fromEntity, edge.toEntity)}"
            )
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error {err.status_code} trying to DELETE linage for {edge}")

    def delete_lineage_by_name(
        self,
        from_entity_fqn: str,
        from_entity_type: str,
        to_entity_fqn: str,
        to_entity_type: str,
    ) -> None:
        try:
            self.client.delete(
                f"{LINEAGE_ROUTE}/"
                f"{self._lineage_edge_path_by_name(from_entity_type, from_entity_fqn, to_entity_type, to_entity_fqn)}"
            )
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error {err.status_code} trying to DELETE lineage for "
                f"{from_entity_type}:{from_entity_fqn} -> {to_entity_type}:{to_entity_fqn}"
            )

    @functools.lru_cache(maxsize=LRU_CACHE_SIZE)  # noqa: B019
    def delete_lineage_by_source(self, entity_type: str, entity_id: str, source: str) -> None:
        """
        Remove the given Edge
        """
        try:
            self.client.delete(f"{self.get_suffix(AddLineageRequest)}/{entity_type}/{entity_id}/type/{source}")
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error {err.status_code} trying to DELETE linage for {entity_id} of type {source}")

    @functools.lru_cache(maxsize=LRU_CACHE_SIZE)  # noqa: B019
    def delete_lineage_by_source_by_name(self, entity_type: str, entity_fqn: str, source: str) -> None:
        """
        Remove lineage edges by source for the entity identified by FQN.
        """
        try:
            self.client.delete(f"{LINEAGE_ROUTE}/source/name/{entity_type}/{quote(entity_fqn)}/type/{source}")
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error {err.status_code} trying to DELETE linage for {entity_fqn} of type {source}")

    def add_lineage_by_query(
        self,
        database_service: DatabaseService,
        sql: str,
        database_name: str = None,  # noqa: RUF013
        schema_name: str = None,  # noqa: RUF013
        timeout: int = LINEAGE_PARSING_TIMEOUT,
        check_patch: bool = False,
    ) -> None:
        """
        Method parses the query and generated the lineage
        between source and target tables
        """

        # pylint: disable=import-outside-toplevel,cyclic-import
        # importing inside the method to avoid circular import
        from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query  # noqa: PLC0415

        if database_service:
            connection_type = database_service.serviceType.value
            add_lineage_request = get_lineage_by_query(
                metadata=self,
                service_names=database_service.name.root,
                dialect=ConnectionTypeDialectMapper.dialect_of(connection_type),
                query=sql,
                database_name=database_name,
                schema_name=schema_name,
                timeout_seconds=timeout,
            )
            for lineage_request in add_lineage_request or []:
                if lineage_request.right:
                    if isinstance(lineage_request.right, OMetaFQNLineageRequest):
                        resp = self.add_lineage_by_name(
                            from_entity_fqn=lineage_request.right.from_entity_fqn,
                            from_entity_type=lineage_request.right.from_entity_type,
                            to_entity_fqn=lineage_request.right.to_entity_fqn,
                            to_entity_type=lineage_request.right.to_entity_type,
                            lineage_details=lineage_request.right.lineage_details,
                            check_patch=check_patch,
                        )
                    else:
                        resp = self.add_lineage(lineage_request.right, check_patch=check_patch)
                    if resp.get("error"):
                        logger.error(resp["error"])
                        continue

                    entity_name = resp.get("entity", {}).get("name")
                    for node in resp.get("nodes", []):
                        logger.info(f"added lineage between table {node.get('name')} and {entity_name} ")
                elif lineage_request.left:
                    logger.error(f"Error while adding lineage: {lineage_request.left.error}")

    @functools.lru_cache(maxsize=LRU_CACHE_SIZE)  # noqa: B019
    def patch_lineage_processed_flag(
        self,
        entity: Type[T],  # noqa: UP006
        fqn: str,
    ) -> None:
        """
        Patch the processed lineage flag for an entity
        """
        try:
            patch = [
                {
                    "op": "add",
                    "path": "/processedLineage",
                    "value": True,
                }
            ]
            self.client.patch(
                path=f"{self.get_suffix(entity)}/name/{fqn}",
                data=json.dumps(patch),
            )
        except Exception as exc:
            logger.debug(f"Error while patching lineage processed flag: {exc}")
            logger.debug(traceback.format_exc())
