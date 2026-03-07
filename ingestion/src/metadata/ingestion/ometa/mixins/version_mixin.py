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
Mixin class containing entity versioning specific methods

To be used by OpenMetadata
"""

from typing import Generic, List, Optional, Type, TypeVar, Union

from pydantic import BaseModel
from requests.models import Response

from metadata.generated.schema.type import basic
from metadata.generated.schema.type.entityHistory import EntityVersionHistory
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.logger import ometa_logger

T = TypeVar("T", bound=BaseModel)
logger = ometa_logger()


class OMetaVersionMixin(Generic[T]):
    """
    OpenMetadata API methods related to entity versioning.

    To be inherited by OpenMetadata
    """

    client: REST

    @staticmethod
    def version_to_str(version: Union[str, float]):
        """convert float version to str

        Parameters
        ----------
        version : Union[str, float]
            the version number of the entity

        Returns
        -------
        str
            the string representation of the version
        """
        if isinstance(version, float):
            return str(version)

        return version

    def get_entity_version(
        self,
        entity: Type[T],
        entity_id: Union[str, basic.Uuid],
        version: Union[str, float],
        fields: Optional[List[str]] = None,
    ) -> Optional[T]:
        """
        Get an entity at a specific version

        Parameters
        ----------
        entity: T
            the entity type
        entity_id: Union[str, basic.Uuid]
            the ID for a specific entity
        version: Union[str, float]
            the specific version of the entity
        fields: List
            List of fields to return
        """
        entity_id = model_str(entity_id)
        version = self.version_to_str(version)

        path = f"{entity_id}/versions/{version}"

        return self._get(entity=entity, path=path, fields=fields)

    def get_list_entity_versions(
        self,
        entity_id: Union[str, basic.Uuid],
        entity: Type[T],
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        field_changed: Optional[str] = None,
    ) -> Union[Response, EntityVersionHistory]:
        """
        Retrieve the list of versions for a specific entity

        Parameters
        ----------
        entity: T
            the entity type
        entity_id: Union[str, basic.Uuid]
            the ID for a specific entity
        limit: Optional[int]
            maximum number of versions to return
        offset: Optional[int]
            offset for pagination
        field_changed: Optional[str]
            filter versions by field name that was changed

        Returns
        -------
        List
            lists of available versions for a specific entity
        """
        path = f"{model_str(entity_id)}/versions"

        params = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        if field_changed is not None:
            params["fieldChanged"] = field_changed

        resp = self.client.get(
            f"{self.get_suffix(entity)}/{path}", data=params if params else None
        )

        if self._use_raw_data:
            return resp

        return EntityVersionHistory(**resp)

    def get_entity_history_by_timeline(
        self,
        entity: Type[T],
        start_ts: int,
        end_ts: int,
        limit: int = 10,
        before: Optional[str] = None,
        after: Optional[str] = None,
    ) -> dict:
        """
        Retrieve entity versions within a time range

        Parameters
        ----------
        entity: T
            the entity type
        start_ts: int
            start timestamp in milliseconds since epoch
        end_ts: int
            end timestamp in milliseconds since epoch
        limit: int
            maximum number of results to return
        before: Optional[str]
            cursor for backward pagination
        after: Optional[str]
            cursor for forward pagination

        Returns
        -------
        dict
            paginated list of entity versions within the time range
        """
        params = {
            "startTs": start_ts,
            "endTs": end_ts,
            "limit": limit,
        }
        if before is not None:
            params["before"] = before
        if after is not None:
            params["after"] = after

        return self.client.get(f"{self.get_suffix(entity)}/history", data=params)
