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
Mixin class containing Custom Property specific methods

To be used by OpenMetadata class
"""
from typing import Dict

from metadata.generated.schema.type.customProperty import PropertyType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.custom_properties import (
    CustomPropertyDataTypes,
    CustomPropertyType,
    OMetaCustomProperties,
)
from metadata.ingestion.ometa.client import REST
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaCustomPropertyMixin:
    """
    OpenMetadata API methods related to CustomProperty.

    To be inherited by OpenMetadata
    """

    client: REST

    def create_or_update_custom_property(
        self, ometa_custom_property: OMetaCustomProperties
    ) -> Dict:
        """Create or update custom property. If custom property name matches an existing
        one then it will be updated.

        Args:
            ometa_custom_property (OMetaCustomProperties): custom property to be create or updated
        """
        # Get the json schema id of the entity to be updated
        entity_type = ENTITY_REFERENCE_TYPE_MAP.get(
            ometa_custom_property.entity_type.__name__
        )
        entity_schema = self.client.get(
            f"/metadata/types/name/{entity_type}?category=field"
        )

        resp = self.client.put(
            f"/metadata/types/{entity_schema.get('id')}",
            data=ometa_custom_property.createCustomPropertyRequest.json(),
        )
        return resp

    def get_custom_property_type(
        self, data_type: CustomPropertyDataTypes
    ) -> CustomPropertyType:
        """
        Get all the supported datatypes for the custom properties
        """
        resp = self.client.get(f"/metadata/types/name/{data_type.value}?category=field")
        return CustomPropertyType(**resp)

    def get_property_type_ref(self, data_type: CustomPropertyDataTypes) -> PropertyType:
        """
        Get the PropertyType for custom properties
        """
        custom_property_type = self.get_custom_property_type(data_type=data_type)
        return PropertyType(
            __root__=EntityReference(id=custom_property_type.id, type="type")
        )
