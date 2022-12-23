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
Mixin class containing entity tag specific methods

To be used be OpenMetadata
"""
import traceback
from typing import List, Optional, Type, TypeVar

from pydantic import BaseModel

from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.utils import ometa_logger

T = TypeVar("T", bound=BaseModel)
logger = ometa_logger()


class OMetaTagMixin:
    """
    OpenMetadata API methods related to entity tag.

    To be inherited by OpenMetadata
    """

    def list_classifications(
        self, entity: Type[T], fields: Optional[List[str]] = None
    ) -> Optional[List[T]]:
        """Get list of Classification pydantic model

        Args:
            entity: entity class model
            fields (List): list of fields to pass with the request
        """

        fields_str = "?fields=" + ",".join(fields) if fields else ""
        try:
            resp = self.client.get(f"{self.get_suffix(entity)}/{fields_str}")
            return [entity(**tag_cat) for tag_cat in resp.get("data")]
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"GET {entity.__name__}. Error {err.status_code}: {err}")
            return None

    def create_classification(self, classification_body: CreateClassificationRequest):
        """Method to create new classification
        Args:
            classification_body (Classification): body of the request
        """
        path = "/classifications"
        resp = self.client.post(path=path, data=classification_body.json())
        logger.info(f"Created a classification: {resp}")

    def get_classification(
        self, entity: Type[T], classification_name: str, fields: Optional[List[str]] = None
    ) -> Optional[T]:
        """Get classifications

        Args:
            entity: entity class model
            classification_name (str): classification name to get info on
            fields (List): list of fields to pass with the request
        """
        path = f"{classification_name}"
        return self._get(entity=entity, path=path, fields=fields)

    def create_or_update_classification(
        self, classification_body: CreateClassificationRequest
    ) -> None:
        """Method to update a classification
        Args:
            classification_body (Classification): body of the request
        """
        path = f"/classifications"
        resp = self.client.put(path=path, data=classification_body.json())
        logger.info(f"Updated classification: {resp}")

    def create_tag(
        self, tag_body: CreateTagRequest
    ) -> None:
        """Method to create a tag within a classification
        Args:
            tag_body (Tag): body of the Tag for the request
        """
        path = f"/tags"
        resp = self.client.post(path=path, data=tag_body.json())
        logger.info(f"Created tag : {resp}")

    def get_tag(
        self,
        entity: Type[T],
        tag_fqn: str,
        fields: Optional[List[str]] = None,
    ) -> Optional[T]:
        """Get tag information

        Args:
            entity: entity class model
            tag_fqn (str): fully qualified name of the tag
            fields (List): list of fields to pass with the request
        """
        path = f"{tag_fqn}"
        return self._get(entity=entity, path=path, fields=fields)

    def create_or_update_tag(
        self,
        tag_body: CreateTagRequest,
    ) -> None:
        """Update tag info

        Args:
            entity: entity class model
            tag_body (Tag): body of the Tag for the request
        """
        path = f"/tags"
        resp = self.client.put(path=path, data=tag_body.json())
        logger.info(f"Updated tag: {resp}")

    def update_secondary_tag(
        self,
        secondary_tag_body: CreateTagRequest,
    ) -> None:
        """Update secondary tag information

        Args:
            entity: entity class model
            secondary_tag_body (Tag): body of the Tag for the request
        """
        path = f"/tags"
        resp = self.client.put(path=path, data=secondary_tag_body.json())
        logger.info(f"Updated secondary tag: {resp}")
