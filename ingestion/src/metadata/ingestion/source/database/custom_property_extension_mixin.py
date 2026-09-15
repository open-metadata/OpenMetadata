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
Mixin turning source-native key/value table properties into OpenMetadata custom properties.

Sources expose these under different names - Iceberg table properties on Athena, Parameters on
a Glue catalog table - but the OpenMetadata side is identical: register a definition for every
property name, then hand the values back to be attached to the entity extension.
"""

import hashlib
import re
import traceback
from collections.abc import Mapping
from typing import Any

from metadata.generated.schema.api.data.createCustomProperty import (
    CreateCustomPropertyRequest,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.type.basic import EntityName, Markdown
from metadata.generated.schema.type.customProperty import PropertyType
from metadata.ingestion.models.custom_properties import (
    CustomPropertyDataTypes,
    OMetaCustomProperties,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache

logger = ingestion_logger()

PROPERTY_NAME_INVALID_CHARS_PATTERN = re.compile(r"[^A-Za-z0-9_.\-]")
PROPERTY_NAME_REPLACEMENT = "__"
PROPERTY_NAME_MAX_LENGTH = 256
# The server's customPropertyName pattern requires an alphanumeric first character, and the
# generated EntityName carries no pattern to catch it client side.
PROPERTY_NAME_LEADING_CHAR_PATTERN = re.compile(r"^[A-Za-z0-9]")
PROPERTY_NAME_LEADING_PREFIX = "p_"
PROCESSED_PROPERTY_CACHE_SIZE = 1024


class CustomPropertyExtensionMixin:
    """
    Registers source property names as custom property definitions and builds the
    matching entity extension payload.
    """

    source_config: DatabaseServiceMetadataPipeline
    metadata: OpenMetadata
    _string_property_type_ref: PropertyType | None
    _processed_prop: LRUCache[str]

    def _init_custom_properties(self) -> None:
        """Set up the per-source custom property state. Call from the source's __init__."""
        self._string_property_type_ref = None
        self._processed_prop = LRUCache(PROCESSED_PROPERTY_CACHE_SIZE)

    @property
    def custom_properties_enabled(self) -> bool:
        return bool(getattr(self.source_config, "includeCustomProperties", False))

    def _load_string_property_type_ref(self) -> None:
        """Resolve the `string` property type once per workflow. Call from the source's prepare()."""
        if not self.custom_properties_enabled:
            return
        try:
            self._string_property_type_ref = self.metadata.get_property_type_ref(CustomPropertyDataTypes.STRING)
        except Exception as exc:
            logger.warning(f"Failed to fetch string property type ref: {exc}")
            logger.debug(traceback.format_exc())

    def build_entity_extension(
        self,
        properties: Mapping[str, Any],
        *,
        source_label: str,
        entity_type: type = Table,
    ) -> dict[str, str] | None:
        """Register a custom property definition per name and return the extension payload."""
        property_type = self._string_property_type_ref
        if property_type is None:
            return None
        registered_properties: dict[str, str] = {}
        for prop_name, prop_value in properties.items():
            if not prop_value:
                continue
            sanitized_name = self._sanitize_property_name(prop_name)
            if sanitized_name in self._processed_prop:
                self._log_name_collision(sanitized_name, prop_name)
            elif not self._register_custom_property(
                sanitized_name, prop_name, entity_type, source_label, property_type
            ):
                continue
            # Custom properties are registered as `string`; the server validates each value against
            # that schema and rejects the whole entity - not just the property - on a type mismatch.
            registered_properties[sanitized_name] = str(prop_value)
        return registered_properties or None

    @staticmethod
    def _sanitize_property_name(prop_name: str) -> str:
        sanitized_name = PROPERTY_NAME_INVALID_CHARS_PATTERN.sub(PROPERTY_NAME_REPLACEMENT, prop_name)
        if not PROPERTY_NAME_LEADING_CHAR_PATTERN.match(sanitized_name):
            sanitized_name = f"{PROPERTY_NAME_LEADING_PREFIX}{sanitized_name}"
        # After the prefix, so a name pushed over the limit still hashes. Hex always leads
        # with an alphanumeric, so the hash needs no prefix of its own.
        if len(sanitized_name) > PROPERTY_NAME_MAX_LENGTH:
            return hashlib.md5(prop_name.encode("utf-8"), usedforsecurity=False).hexdigest()
        return sanitized_name

    def _register_custom_property(
        self,
        sanitized_name: str,
        prop_name: str,
        entity_type: type,
        source_label: str,
        property_type: PropertyType,
    ) -> bool:
        """Create or update the definition. Returns False when the caller must skip this property."""
        try:
            self.metadata.create_or_update_custom_property(  # pyright: ignore[reportUnknownMemberType, reportUnusedCallResult]
                OMetaCustomProperties(
                    entity_type=entity_type,
                    createCustomPropertyRequest=CreateCustomPropertyRequest(
                        name=EntityName(sanitized_name),
                        displayName=prop_name,
                        description=Markdown(prop_name),
                        propertyType=property_type,
                        customPropertyConfig=None,
                    ),
                )
            )
        except Exception as exc:
            # Not cached, so the next table retries. Emitting a value for a name the server never
            # registered fails the whole entity, so the caller must drop this property.
            logger.warning(f"Failed to register custom property [{prop_name}] for {source_label}: {exc}")
            logger.debug(traceback.format_exc())
            return False
        # Valued by the raw name that produced it so _log_name_collision can spot two source
        # keys that sanitize alike and silently share one definition.
        self._processed_prop.put(sanitized_name, prop_name)
        return True

    def _log_name_collision(self, sanitized_name: str, prop_name: str) -> None:
        try:
            previous = self._processed_prop.get(sanitized_name)
        except KeyError:
            # Another thread evicted the name between the membership check and this read. The
            # property is already registered either way, so there is nothing to report.
            return
        if previous != prop_name:
            logger.debug(f"Custom property [{sanitized_name}] is shared by source keys [{previous}] and [{prop_name}]")
