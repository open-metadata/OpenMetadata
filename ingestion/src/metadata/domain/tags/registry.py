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
"""Per-source tag processing and scoped attachment bookkeeping.

Canonicalizes system names, queues deduplicated create payloads, and retains
entity labels until scope cleanup. Custom tag identity remains case-sensitive.
Safe for concurrent use across topology workers.
"""

import threading
import traceback
from collections.abc import Generator
from dataclasses import dataclass, replace
from typing import TYPE_CHECKING, NamedTuple, cast

from cachetools import LRUCache

from metadata.domain.tags.canonicalizer import TagCanonicalizer
from metadata.domain.tags.models import TagAssignment, TagDefinition
from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.services.ingestionPipelines.status import StackTraceError
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
    """Per-source tag processing with an injectable resolution policy.

    Injected canonicalizers supply shared classification() and tag() policies.
    """

    def __init__(
        self,
        cache_size: int = 1000,
        *,
        metadata: "OpenMetadata",
        canonicalizer: TagCanonicalizer | None = None,
    ) -> None:
        if cache_size < 1:
            raise ValueError("cache_size must be positive")
        self._metadata = metadata
        self._canonicalizer = (
            canonicalizer if canonicalizer is not None else TagCanonicalizer(metadata=metadata, cache_size=cache_size)
        )
        self._known_tag_fqns: LRUCache[str, _TagState] = LRUCache(maxsize=cache_size)
        self._tag_label_cache: LRUCache[_TagLabelKey, TagLabel] = LRUCache(maxsize=cache_size)
        self._pending: dict[str, OMetaTagAndClassification] = {}
        self._labels_by_entity: dict[str, list[TagLabel]] = {}

        self._lock = threading.Lock()
        self._drain_lock = threading.Lock()

    def _intern_tag_label_locked(self, assignment: TagAssignment, label: TagLabel) -> TagLabel:
        """Return the shared ``TagLabel`` for the given key. Caller must hold ``self._lock``."""
        key = _TagLabelKey(assignment.classification_name, assignment.tag_name, assignment.label_type, assignment.state)
        cached = self._tag_label_cache.get(key)
        if cached is not None:
            return cached
        self._tag_label_cache[key] = label
        return label

    def register(
        self,
        definition: TagDefinition | None,
        *,
        entity_fqn: str | None = None,
        label_type: LabelType = LabelType.Automated,
        state: State = State.Suggested,
    ) -> StackTraceError | None:
        """Eagerly queue a canonical definition and optionally attach it to an entity."""
        if definition is None:
            return None
        try:
            if not self._valid_names(definition.classification_name, definition.tag_name, entity_fqn):
                return None
            classification = self._canonicalizer.classification(
                definition.classification_name, definition.classification_description
            )
            tag = self._canonicalizer.tag(classification.name, definition.tag_name, definition.tag_description)
            tag_fqn = cast("str", fqn.build(None, Tag, classification_name=classification.name, tag_name=tag.name))
            record = self._build_pending_record(
                classification_name=classification.name,
                classification_description=classification.description,
                tag_name=tag.name,
                tag_description=tag.description,
            )
            assignment = (
                TagAssignment(classification.name, tag.name, entity_fqn, label_type, state)
                if entity_fqn is not None
                else None
            )
            label = self._build_label(assignment, tag_fqn) if assignment is not None else None
            with self._lock:
                known = self._known_tag_fqns.get(tag_fqn)
                if not (known is not None and known.emitted) and tag_fqn not in self._pending:
                    self._pending[tag_fqn] = record
                if assignment is not None and label is not None:
                    self._store_assignment_locked(assignment, label)
        except Exception as exc:
            return self._processing_error("register", definition, entity_fqn, exc)
        return None

    def attach(self, assignment: TagAssignment | None) -> StackTraceError | None:
        """Eagerly attach a canonical reference without queuing a definition."""
        if assignment is None:
            return None
        try:
            if not self._valid_names(assignment.classification_name, assignment.tag_name, assignment.entity_fqn):
                return None
            classification = self._canonicalizer.classification(assignment.classification_name, "")
            tag = self._canonicalizer.tag(classification.name, assignment.tag_name, "")
            canonical = replace(assignment, classification_name=classification.name, tag_name=tag.name)
            tag_fqn = cast("str", fqn.build(None, Tag, classification_name=classification.name, tag_name=tag.name))
            label = self._build_label(canonical, tag_fqn)
            with self._lock:
                self._store_assignment_locked(canonical, label)
        except Exception as exc:
            return self._processing_error("attach", assignment, assignment.entity_fqn, exc)
        return None

    def _store_assignment_locked(self, assignment: TagAssignment, label: TagLabel) -> None:
        """Store an attachment. Caller must hold the state lock."""
        interned = self._intern_tag_label_locked(assignment, label)
        self._labels_by_entity.setdefault(assignment.entity_fqn, []).append(interned)

    @staticmethod
    def _build_label(assignment: TagAssignment, tag_fqn: str) -> TagLabel:
        return TagLabel(  # pyright: ignore[reportCallIssue]
            tagFQN=TagFQN(tag_fqn),
            labelType=assignment.label_type,
            state=assignment.state,
            source=TagSource.Classification,
        )

    @staticmethod
    def _valid_names(classification_name: str, tag_name: str, entity_fqn: str | None) -> bool:
        if not tag_name or not tag_name.strip():
            return False
        if fqn.is_valid_entity_name(classification_name) and fqn.is_valid_entity_name(tag_name):
            return True
        logger.warning(
            "%sSkipped tag %r in classification %r: classification and tag names must be 1 to %d characters"
            " long and cannot contain '\"', '>', '::' or control characters",
            entity_fqn + ": " if entity_fqn else "",
            tag_name,
            classification_name,
            fqn.ENTITY_NAME_MAX_LENGTH,
        )
        return False

    @staticmethod
    def _processing_error(
        operation: str, tag: TagDefinition | TagAssignment, entity_fqn: str | None, exc: Exception
    ) -> StackTraceError:
        return StackTraceError(
            name=entity_fqn or "Tags and Classifications",
            error=f"Failed to {operation} tag [{tag.classification_name}.{tag.tag_name}]: {exc}",
            stackTrace=traceback.format_exc(),
        )

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
            exists = known.exists is True or exists
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
