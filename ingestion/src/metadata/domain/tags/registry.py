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
"""TagRegistry — per-Source bookkeeping for Tag and Classification ingestion.

Holds two concerns:

* a queue of classification/tag create-payloads bound for the sink
  (deduped by FQN, drained per scope), and
* a per-entity-FQN lookup of ``TagLabel`` instances for inheritance
  reads, dropped at scope boundaries.

Dedup is case-sensitive, matching OpenMetadata's tag-identity rule.
Safe for concurrent use across the topology's parallel schema workers.
"""

import threading
from collections.abc import Generator
from dataclasses import dataclass, replace
from typing import TYPE_CHECKING, NamedTuple, cast

from cachetools import LRUCache

from metadata.domain.tags.models import TagDefinition
from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

logger = ingestion_logger()


@dataclass(frozen=True)
class _TagState:
    emitted: bool = False
    exists: bool | None = None


class _TagLabelKey(NamedTuple):
    """Identity tuple for the TagLabel cache."""

    classification_name: str
    tag_name: str
    label_type: LabelType
    state: State


class TagRegistry:
    """Registry for Tag and Classification ingestion bookkeeping."""

    def __init__(self, cache_size: int = 1000, *, metadata: "OpenMetadata") -> None:
        if cache_size < 1:
            raise ValueError("cache_size must be positive")
        self._metadata = metadata
        self._known_tag_fqns: LRUCache[str, _TagState] = LRUCache(maxsize=cache_size)
        self._tag_label_cache: LRUCache[_TagLabelKey, TagLabel] = LRUCache(maxsize=cache_size)
        self._pending: dict[str, OMetaTagAndClassification] = {}
        self._labels_by_entity: dict[str, list[TagLabel]] = {}

        self._lock = threading.Lock()
        self._drain_lock = threading.Lock()

    def _intern_tag_label_locked(
        self, *, classification_name: str, tag_name: str, label_type: LabelType, state: State
    ) -> TagLabel:
        """Return the shared ``TagLabel`` for the given key. Caller must hold ``self._lock``."""
        key = _TagLabelKey(classification_name, tag_name, label_type, state)
        cached = self._tag_label_cache.get(key)
        if cached is not None:
            return cached
        tag_fqn = cast("str", fqn.build(None, Tag, classification_name=classification_name, tag_name=tag_name))
        cached = TagLabel(  # pyright: ignore[reportCallIssue]
            tagFQN=TagFQN(tag_fqn),
            labelType=label_type,
            state=state,
            source=TagSource.Classification,
        )
        self._tag_label_cache[key] = cached
        return cached

    def define(self, tag: TagDefinition) -> None:
        """Queue a definition without attaching it to an entity."""
        if not tag.tag_name or not tag.tag_name.strip():
            return
        tag_fqn = cast("str", fqn.build(None, Tag, classification_name=tag.classification_name, tag_name=tag.tag_name))
        with self._lock:
            known = self._known_tag_fqns.get(tag_fqn)
            if known is not None and known.emitted:
                return
            if tag_fqn not in self._pending:
                self._pending[tag_fqn] = self._build_pending_record(
                    classification_name=tag.classification_name,
                    classification_description=tag.classification_description,
                    tag_name=tag.tag_name,
                    tag_description=tag.tag_description,
                )

    def attach(
        self,
        *,
        entity_fqn: str,
        tag: TagDefinition,
        label_type: LabelType = LabelType.Automated,
        state: State = State.Suggested,
    ) -> None:
        """Register a tag <-> entity association."""
        if not tag.tag_name or not tag.tag_name.strip():
            logger.debug("TagRegistry: skipping empty tag for classification %s", tag.classification_name)
            return

        with self._lock:
            tag_label = self._intern_tag_label_locked(
                classification_name=tag.classification_name,
                tag_name=tag.tag_name,
                label_type=label_type,
                state=state,
            )
            self._labels_by_entity.setdefault(entity_fqn, []).append(tag_label)

    def labels_for(self, entity_fqn: str) -> list[TagLabel]:
        """Return existing tag labels attached to ``entity_fqn`` as a copy."""
        with self._lock:
            labels = list(self._labels_by_entity.get(entity_fqn, []))
        return [label for label in labels if self._exists(label.tagFQN.root)]

    def _exists(self, tag_fqn: str) -> bool:
        with self._lock:
            known = self._known_tag_fqns.get(tag_fqn)
            if known is not None and known.exists is not None:
                return known.exists
        try:
            exists = self._metadata.get_by_name(entity=Tag, fqn=tag_fqn) is not None
        except Exception as exc:
            logger.warning("Unable to verify tag %s; omitting its labels: %s", tag_fqn, exc)
            exists = False
        else:
            if not exists:
                logger.warning("Tag %s does not exist in OpenMetadata; omitting its labels", tag_fqn)
        with self._lock:
            known = self._known_tag_fqns.get(tag_fqn, _TagState())
            self._known_tag_fqns[tag_fqn] = replace(known, exists=exists)
        return exists

    def drain(self) -> Generator[OMetaTagAndClassification, None, None]:
        """Yield pending definitions; publish each before advancing and close on interruption."""
        with self._drain_lock:
            with self._lock:
                pending = list(self._pending.items())

            for tag_fqn, record in pending:
                yield record
                # Resuming confirms publication to the workflow queue, not successful persistence.
                with self._lock:
                    del self._pending[tag_fqn]
                    known = self._known_tag_fqns.get(tag_fqn, _TagState())
                    self._known_tag_fqns[tag_fqn] = replace(known, emitted=True)

            if pending:
                logger.debug("TagRegistry: drained %d pending tag payloads.", len(pending))

    def clear_scope(self, scope_fqn: str) -> None:
        """Drop attachments at or below ``scope_fqn``; later attachments are allowed."""
        prefix = scope_fqn + fqn.FQN_SEPARATOR
        with self._lock:
            self._labels_by_entity = {
                entity: labels
                for entity, labels in self._labels_by_entity.items()
                if entity != scope_fqn and not entity.startswith(prefix)
            }

    def stats(self) -> dict[str, int]:
        """Return current state counts for instrumentation."""
        with self._lock:
            return {
                "known_tag_fqns": len(self._known_tag_fqns),
                "tag_label_cache": len(self._tag_label_cache),
                "pending": len(self._pending),
                "live_entities": len(self._labels_by_entity),
                "live_labels": sum(len(labels) for labels in self._labels_by_entity.values()),
            }

    @staticmethod
    def _build_pending_record(
        *,
        classification_name: str,
        classification_description: str,
        tag_name: str,
        tag_description: str,
    ) -> OMetaTagAndClassification:
        """Compose the sink-bound create-payload for a classification + tag."""
        return OMetaTagAndClassification(
            fqn=None,
            classification_request=CreateClassificationRequest(  # pyright: ignore[reportCallIssue]
                name=EntityName(classification_name),
                description=Markdown(classification_description),
            ),
            tag_request=CreateTagRequest(  # pyright: ignore[reportCallIssue]
                classification=FullyQualifiedEntityName(classification_name),
                name=EntityName(tag_name),
                description=Markdown(tag_description),
            ),
        )
