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
from typing import List, Optional, Type, TypeVar

from pydantic import BaseModel

from metadata.generated.schema.api.tags.createTag import CreateTagRequest
from metadata.generated.schema.api.tags.createTagCategory import (
    CreateTagCategoryRequest,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.utils import ometa_logger

T = TypeVar("T", bound=BaseModel)  # pylint: disable=invalid-name
logger = ometa_logger()


class OMetaTagMixin:
    """
    OpenMetadata API methods related to entity tag.

    To be inherited by OpenMetadata
    """

    def list_tag_categories(
        self, entity: Type[T], fields: Optional[List[str]] = None
    ) -> Optional[List[T]]:
        """Get list of TagCategory pydantic model

        Args:
            entity: entity class model
            fields (List): list of fields to pass with the request
        """

        fields_str = "?fields=" + ",".join(fields) if fields else ""
        try:
            resp = self.client.get(f"{self.get_suffix(entity)}/{fields_str}")
            return [entity(**tag_cat) for tag_cat in resp.get("data")]
        except APIError as err:
            logger.error(f"GET {entity.__name__}. Error {err.status_code} - {err}")
            return None

    def create_tag_category(self, tag_category_body: CreateTagCategoryRequest):
        """Method to create new tag category
        Args:
            tag_category_body (TagCategory): body of the request
        """
        path = "/tags"
        resp = self.client.post(path=path, data=tag_category_body.json())
        logger.info(f"Created tag category: {resp}")

    def get_tag_category(
        self, entity: Type[T], category_name: str, fields: Optional[List[str]] = None
    ) -> Optional[T]:
        """Get tag categories

        Args:
            entity: entity class model
            category_name (str): category name to get info on
            fields (List): list of fields to pass with the request
        """
        path = f"{category_name}"
        return self._get(entity=entity, path=path, fields=fields)

    def create_or_update_tag_category(
        self, category_name: str, tag_category_body: CreateTagCategoryRequest
    ) -> None:
        """Method to update a tag category
        Args:
            category_name (str): tag category name
            tag_category_body (TagCategory): body of the request
        """
        path = f"/tags/{category_name}"
        resp = self.client.put(path=path, data=tag_category_body.json())
        logger.info(f"Updated tag category: {resp}")

    def create_primary_tag(
        self, category_name: str, primary_tag_body: CreateTagRequest
    ) -> None:
        """Method to create a primary tag within a category
        Args:
            category_name (str): tag category name
            primary_tag_body (Tag): body of the Tag for the request
        """
        path = f"/tags/{category_name}"
        resp = self.client.post(path=path, data=primary_tag_body.json())
        logger.info(f"Create primary tag in category {category_name}: {resp}")

    def get_primary_tag(
        self,
        entity: Type[T],
        category_name: str,
        primary_tag_fqn: str,
        fields: Optional[List[str]] = None,
    ) -> Optional[T]:
        """Get primary tag information

        Args:
            entity: entity class model
            category_name (str): category name to get info on
            primary_tag_fqn (str): fully qualified name of the primary tag
            fields (List): list of fields to pass with the request
        """
        path = f"{category_name}/{primary_tag_fqn}"
        return self._get(entity=entity, path=path, fields=fields)

    def create_or_update_primary_tag(
        self,
        category_name: str,
        primary_tag_fqn: str,
        primary_tag_body: CreateTagRequest,
    ) -> None:
        """Update primary tag info

        Args:
            entity: entity class model
            category_name (str): category name to get info on
            primary_tag_fqn (str): fully qualified name of the primary tag
            primary_tag_body (Tag): body of the Tag for the request
        """
        path = f"/tags/{category_name}/{primary_tag_fqn}"
        resp = self.client.put(path=path, data=primary_tag_body.json())
        logger.info(f"Updated primary tag: {resp}")

    def create_secondary_tag(
        self,
        category_name: str,
        primary_tag_fqn: str,
        secondary_tag_body: CreateTagRequest,
    ) -> None:
        """Method to create a secondary tag under a primary tag
        Args:
            category_name (str): tag category name
            primary_tag_fqn (str): primary tag fully qualified name
            secondary_tag_body (Tag): body of the Tag for the request
        """
        path = f"/tags/{category_name}/{primary_tag_fqn}"
        resp = self.client.post(path=path, data=secondary_tag_body.json())
        logger.info(
            f"Create secondary tag in category {category_name}"
            f"under primary tag {primary_tag_fqn}: {resp}"
        )

    # pylint: disable=too-many-arguments
    def get_secondary_tag(
        self,
        entity: Type[T],
        category_name: str,
        primary_tag_fqn: str,
        secondary_tag_fqn: str,
        fields: Optional[List[str]] = None,
    ) -> Optional[T]:
        """Get secondary tag information

        Args:
            entity: entity class model
            category_name (str): category name to get info on
            primary_tag_fqn (str): fully qualified name of the primary tag
            secondary_tag_fqn (str): fully qualified name of the secondary tag
            fields (List): list of fields to pass with the request
        """
        path = f"{category_name}/{primary_tag_fqn}/{secondary_tag_fqn}"
        return self._get(entity=entity, path=path, fields=fields)

    def update_secondary_tag(
        self,
        category_name: str,
        primary_tag_fqn: str,
        secondary_tag_fqn: str,
        secondary_tag_body: CreateTagRequest,
    ) -> None:
        """Update secondary tag information

        Args:
            entity: entity class model
            category_name (str): category name to get info on
            primary_tag_fqn (str): fully qualified name of the primary tag
            secondary_tag_fqn (str): fully qualified name of the secondary tag
            secondary_tag_body (Tag): body of the Tag for the request
        """
        path = f"/tags/{category_name}/{primary_tag_fqn}/{secondary_tag_fqn}"
        resp = self.client.put(path=path, data=secondary_tag_body.json())
        logger.info(f"Updated secondary tag: {resp}")
