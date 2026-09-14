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
"""TagCanonicalizer — case-corrected name resolution against OpenMetadata.

Resolves source-system Classification and Tag names to the canonical form
of any matching system-provider entity in OM (e.g., source reports
``pii.sensitive`` → returns ``PII.Sensitive``). Persistent ES failures
raise after retry exhaustion.
"""

import logging
import threading
from collections import OrderedDict
from collections.abc import Iterable
from typing import Any, NamedTuple, cast

from tenacity import (
    before_sleep_log,
    retry,
    stop_after_attempt,
    wait_random_exponential,
)

from metadata.domain.tags.models import TagDefinition
from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.basic import ProviderType
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


_es_retry = retry(
    stop=stop_after_attempt(5),
    wait=wait_random_exponential(multiplier=2, max=30),
    reraise=True,
    before_sleep=before_sleep_log(logger, logging.WARNING),
)


class Canonical(NamedTuple):
    """Canonical (name, description) pair returned from OpenMetadata."""

    name: str
    description: str


class TagCanonicalizer:
    """Case-corrected name resolution for system Classifications and Tags.

    Persistent ES failures raise; callers should wrap in ``Either`` to
    surface them to workflow status.
    """

    def __init__(self, metadata: OpenMetadata, cache_size: int = 1000) -> None:
        if cache_size < 1:
            raise ValueError("cache_size must be positive")
        self._metadata = metadata
        self._cache_size = cache_size
        self._classification_cache: OrderedDict[str, Canonical | None] = OrderedDict()
        self._tag_cache: OrderedDict[tuple[str, str], Canonical | None] = OrderedDict()
        self._lock = threading.RLock()

    def resolve(
        self,
        *,
        classification_name: str,
        tag_name: str,
        classification_description: str,
        tag_description: str,
    ) -> TagDefinition:
        """Resolve a definition against system classifications and tags."""
        classification = self.classification(classification_name, classification_description)
        tag = self.tag(classification.name, tag_name, tag_description)
        return TagDefinition(classification.name, tag.name, classification.description, tag.description)

    def classification(
        self,
        name: str,
        default_description: str,
    ) -> Canonical:
        """Return canonical classification name + description from OM, cached.

        ``default_description`` is used to seed the Canonical when no
        system-provider match exists in OM, and as a fallback when an
        OM match has an empty description. An OM-side description wins
        over the default whenever available.
        """
        key = name.lower()
        with self._lock:
            if key in self._classification_cache:
                self._classification_cache.move_to_end(key)
                return self._with_fallback(self._classification_cache[key], name, default_description)

        results = self._es_search(Classification, name)
        canonical = None
        for entity in results:
            if entity.provider == ProviderType.system and entity.name.root.lower() == key:
                canonical = Canonical(
                    name=entity.name.root,
                    description=entity.description.root if entity.description else "",
                )
                break

        with self._lock:
            self._classification_cache[key] = canonical
            self._classification_cache.move_to_end(key)
            if len(self._classification_cache) > self._cache_size:
                self._classification_cache.popitem(last=False)
        return self._with_fallback(canonical, name, default_description)

    def tag(
        self,
        classification_name: str,
        tag_name: str,
        default_tag_description: str,
    ) -> Canonical:
        """Return canonical tag name + description from OM, cached.

        ``classification_name`` must already be canonical (call ``classification`` first).
        ``default_tag_description`` is used to seed the Canonical when no
        system-provider match exists in OM, and as a fallback when an
        OM match has an empty description.
        """
        tag_fqn = cast(
            "str",
            fqn.build(None, Tag, classification_name=classification_name, tag_name=tag_name),
        )
        key = (classification_name, tag_name.lower())
        with self._lock:
            if key in self._tag_cache:
                self._tag_cache.move_to_end(key)
                return self._with_fallback(self._tag_cache[key], tag_name, default_tag_description)

        results = self._es_search(Tag, tag_fqn)
        canonical = None
        for entity in results:
            if (
                entity.provider == ProviderType.system
                and entity.classification.name == classification_name
                and entity.name.root.lower() == tag_name.lower()
            ):
                canonical = Canonical(
                    name=entity.name.root,
                    description=entity.description.root if entity.description else "",
                )
                break

        with self._lock:
            self._tag_cache[key] = canonical
            self._tag_cache.move_to_end(key)
            if len(self._tag_cache) > self._cache_size:
                self._tag_cache.popitem(last=False)
        return self._with_fallback(canonical, tag_name, default_tag_description)

    @staticmethod
    def _with_fallback(canonical: Canonical | None, name: str, description: str) -> Canonical:
        if canonical is None:
            return Canonical(name, description)
        return Canonical(canonical.name, canonical.description or description)

    @_es_retry
    def _es_search(self, entity_type: Any, search_string: str) -> Iterable[Any]:
        """Run an ES search by FQN with retries."""
        return (
            self._metadata.es_search_from_fqn(
                entity_type=entity_type, fqn_search_string=search_string, raise_on_error=True
            )
            or []
        )
