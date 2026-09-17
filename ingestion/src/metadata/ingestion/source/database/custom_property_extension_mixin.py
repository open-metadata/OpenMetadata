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
PROPERTY_NAME_DISAMBIGUATOR_LENGTH = 8
PROCESSED_PROPERTY_CACHE_SIZE = 1024
# One entry per entity type, each holding that type's definitions as the server returned them.
EXISTING_DEFINITIONS_CACHE_SIZE = 8

# name -> (data type, display name) for one entity type's custom property definitions.
EntityDefinitions = dict[str, tuple[str, str | None]]


class CustomPropertyExtensionMixin:
    """
    Registers source property names as custom property definitions and builds the
    matching entity extension payload.
    """

    source_config: DatabaseServiceMetadataPipeline
    metadata: OpenMetadata
    _string_property_type_ref: PropertyType | None
    _processed_prop: LRUCache[str]
    _existing_properties: LRUCache[EntityDefinitions]

    def _init_custom_properties(self) -> None:
        """Set up the per-source custom property state. Call from the source's __init__."""
        self._string_property_type_ref = None
        self._processed_prop = LRUCache(PROCESSED_PROPERTY_CACHE_SIZE)
        self._existing_properties = LRUCache(EXISTING_DEFINITIONS_CACHE_SIZE)

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
            logger.warning("Failed to fetch string property type ref: %s", exc)
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
        definitions = self._existing_definitions(entity_type)
        if definitions is None:
            # Fail closed. Treating unreadable definitions as none at all would register over
            # whatever is already there, which is the corruption the lookup exists to prevent, and
            # a timeout or a missing permission is enough to get there.
            logger.warning(
                "Cannot read %s custom property definitions; skipping the extension from %s",
                entity_type.__name__,
                source_label,
            )
            return None
        registered_properties: dict[str, str] = {}
        for prop_name, prop_value in properties.items():
            # Only absent and empty values are dropped. Glue extras are not coerced by the model,
            # so a parameter can arrive as 0 or False, and those are real values.
            if prop_value is None or prop_value == "":
                continue
            sanitized_name = self._resolve_property_name(prop_name, definitions)
            if sanitized_name in self._processed_prop:
                if not self._owns_property_name(sanitized_name, prop_name):
                    continue
            elif not self._register_custom_property(
                sanitized_name, prop_name, entity_type, source_label, property_type, definitions
            ):
                continue
            # Custom properties are registered as `string`; the server validates each value against
            # that schema and rejects the whole entity - not just the property - on a type mismatch.
            registered_properties[sanitized_name] = str(prop_value)
        return registered_properties or None

    @staticmethod
    def _base_property_name(prop_name: str) -> str:
        """The name the server will accept, before it is disambiguated."""
        sanitized_name = PROPERTY_NAME_INVALID_CHARS_PATTERN.sub(PROPERTY_NAME_REPLACEMENT, prop_name)
        if not PROPERTY_NAME_LEADING_CHAR_PATTERN.match(sanitized_name):
            sanitized_name = f"{PROPERTY_NAME_LEADING_PREFIX}{sanitized_name}"
        return sanitized_name

    @staticmethod
    def _legacy_property_name(prop_name: str) -> str:
        """The name registered before rewritten names were disambiguated."""
        base_name = CustomPropertyExtensionMixin._base_property_name(prop_name)
        if len(base_name) > PROPERTY_NAME_MAX_LENGTH:
            return CustomPropertyExtensionMixin._digest(prop_name)
        return base_name

    @staticmethod
    def _sanitize_property_name(prop_name: str) -> str:
        sanitized_name = CustomPropertyExtensionMixin._base_property_name(prop_name)
        if sanitized_name != prop_name:
            # Sanitizing is many to one: `a/b` and `a@b` both reduce to `a__b`, and `_x` reduces to
            # the `p__x` a source can send verbatim. Sharing one name means sharing one definition
            # and one extension key, so one value is lost and the definition's displayName describes
            # the wrong source key. The suffix is derived from the raw key alone - never from
            # iteration order or cache state, which would make the winner differ between runs.
            digest = CustomPropertyExtensionMixin._digest(prop_name)
            sanitized_name = f"{sanitized_name}_{digest[:PROPERTY_NAME_DISAMBIGUATOR_LENGTH]}"
        # After the suffix, so a name pushed over the limit still hashes. Hex always leads with an
        # alphanumeric, so the hash needs no prefix of its own.
        if len(sanitized_name) > PROPERTY_NAME_MAX_LENGTH:
            return CustomPropertyExtensionMixin._digest(prop_name)
        return sanitized_name

    @classmethod
    def _resolve_property_name(cls, prop_name: str, definitions: EntityDefinitions) -> str:
        """The custom property name this source key writes to."""
        sanitized_name = cls._sanitize_property_name(prop_name)
        legacy_name = cls._legacy_property_name(prop_name)
        if legacy_name == sanitized_name:
            return sanitized_name
        data_type, display_name = definitions.get(legacy_name, (None, None))
        if data_type == CustomPropertyDataTypes.STRING.value and display_name == prop_name:
            # An earlier release registered this exact source key under the undisambiguated name,
            # and every table ingested since holds its values there. Moving to the disambiguated
            # name would orphan them and leave two properties for one key. A legacy name claimed by
            # a different key, or by a type this code never creates, is left alone.
            return legacy_name
        return sanitized_name

    @staticmethod
    def _digest(prop_name: str) -> str:
        return hashlib.md5(prop_name.encode("utf-8"), usedforsecurity=False).hexdigest()

    def _owns_property_name(self, sanitized_name: str, prop_name: str) -> bool:
        """False when an unrelated source key already owns this custom property name."""
        try:
            previous = self._processed_prop.get(sanitized_name)
        except KeyError:
            # Another thread evicted the name between the membership check and this read. The
            # property is registered either way; only the key that produced it is unknowable.
            return True
        if previous == prop_name:
            return True
        # _sanitize_property_name disambiguates every rewritten name, so reaching here means the
        # digest itself collided. Dropping this value keeps the definition's displayName honest
        # about which source key it describes, where overwriting would mislabel the value.
        logger.warning(
            "Source keys [%s] and [%s] both map to custom property [%s]; dropping the value from [%s]",
            previous,
            prop_name,
            sanitized_name,
            prop_name,
        )
        return False

    def _register_custom_property(
        self,
        sanitized_name: str,
        prop_name: str,
        entity_type: type,
        source_label: str,
        property_type: PropertyType,
        definitions: EntityDefinitions,
    ) -> bool:
        """Ensure a `string` definition exists. Returns False when the caller must skip this property."""
        existing_type, _ = definitions.get(sanitized_name, (None, None))
        if existing_type is not None and existing_type != CustomPropertyDataTypes.STRING.value:
            # The definition is global to the entity type, so registering over it would retype a
            # property every other table shares and invalidate their values. A string value would
            # not validate against it anyway, which fails the whole entity.
            logger.warning(
                "Custom property [%s] already exists on %s as [%s]; skipping [%s] from %s rather "
                "than replacing the definition",
                sanitized_name,
                entity_type.__name__,
                existing_type,
                prop_name,
                source_label,
            )
            return False
        if existing_type is None:
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
                logger.warning("Failed to register custom property [%s] for %s: %s", prop_name, source_label, exc)
                logger.debug(traceback.format_exc())
                return False
        # Valued by the raw name that produced it so _owns_property_name can spot a digest collision.
        # Checking the cache, registering and writing it back is deliberately not atomic: Athena runs
        # schema workers concurrently, so two can miss the same first-seen name and both PUT. The PUT
        # is idempotent and the name is cached straight after, so the cost is bounded at one
        # redundant round trip per name per run - cheaper than holding a lock across a network call.
        self._processed_prop.put(sanitized_name, prop_name)
        return True

    def _existing_definitions(self, entity_type: type) -> EntityDefinitions | None:
        """The entity type's custom property definitions, or None when they could not be read."""
        entity_key = entity_type.__name__
        if entity_key in self._existing_properties:
            try:
                return self._existing_properties.get(entity_key)
            except KeyError:
                # Evicted between the check and the read; fetching again is correct either way.
                pass
        definitions = self._fetch_existing_properties(entity_type)
        if definitions is None:
            # Not cached, so a transient failure costs this entity its extension rather than
            # disabling custom properties for the rest of the run.
            return None
        self._existing_properties.put(entity_key, definitions)
        return definitions

    def _fetch_existing_properties(self, entity_type: type) -> EntityDefinitions | None:
        """Snapshot the entity type's definitions as name -> (data type, display name).

        One response held verbatim rather than a cache that accumulates: it is read only and never
        added to as properties are registered. None means the listing failed.
        """
        try:
            existing = self.metadata.get_entity_custom_properties(entity_type=entity_type)  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
        except Exception as exc:
            logger.warning("Failed to list existing custom properties for [%s]: %s", entity_type.__name__, exc)
            logger.debug(traceback.format_exc())
            return None
        defined: EntityDefinitions = {}
        for prop in existing or []:
            name = prop.get("name")
            data_type = (prop.get("propertyType") or {}).get("name")
            if name and data_type:
                # displayName carries the raw source key for anything this mixin registered, which
                # is what lets _resolve_property_name recognise its own earlier work.
                defined[name] = (data_type, prop.get("displayName"))
        return defined
