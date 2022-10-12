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
Mixin class containing entity versioning specific methods

To be used by OpenMetadata
"""

from typing import Generic, List, Optional, Type, TypeVar, Union

from pydantic import BaseModel
from requests.models import Response

from metadata.generated.schema.type import basic
from metadata.generated.schema.type.entityHistory import EntityVersionHistory
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import model_str, ometa_logger

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
    ) -> Union[Response, EntityVersionHistory]:
        """
        Retrieve the list of versions for a specific entity

        Parameters
        ----------
        entity: T
            the entity type
        entity_id: Union[str, basic.Uuid]
            the ID for a specific entity

        Returns
        -------
        List
            lists of available versions for a specific entity
        """
        path = f"{model_str(entity_id)}/versions"

        resp = self.client.get(f"{self.get_suffix(entity)}/{path}")

        if self._use_raw_data:
            return resp

        return EntityVersionHistory(**resp)
