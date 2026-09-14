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
from collections import OrderedDict
from collections.abc import Iterable
from typing import NamedTuple, cast

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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class _TagLabelKey(NamedTuple):
    """Identity tuple for the TagLabel cache."""

    classification_name: str
    tag_name: str
    label_type: LabelType
    state: State


class ScopeAlreadyClearedError(RuntimeError):
    """Raised when 'attach' is called for a previously cleared scope.

    Surfaces topology lifecycle bug loudly rather than silently re-creating a cleared scope.
    """


class TagScope:
    """Tag attachments owned by one active source scope."""

    def __init__(self, registry: "TagRegistry", scope_fqn: str) -> None:
        self._registry = registry
        self.fqn = scope_fqn
        self.closed = False
        self._labels_by_entity: dict[str, list[TagLabel]] = {}

    def __enter__(self) -> "TagScope":
        if self.closed:
            raise ScopeAlreadyClearedError(f"Tag scope {self.fqn!r} is closed")
        return self

    def __exit__(self, *_) -> None:
        self.close()

    def close(self) -> None:
        """Release this scope and its descendants."""
        self._registry.close_scope(self)


class TagRegistry:
    """Registry for Tag and Classification ingestion bookkeeping."""

    def __init__(self, metadata: OpenMetadata, cache_size: int = 1000) -> None:
        if cache_size < 1:
            raise ValueError("cache_size must be positive")
        self._metadata = metadata
        self._cache_size = cache_size
        self._known_tag_fqns: OrderedDict[str, None] = OrderedDict()
        self._tag_label_cache: OrderedDict[_TagLabelKey, TagLabel] = OrderedDict()
        self._pending: dict[str, OMetaTagAndClassification] = {}
        self._scopes: dict[str, TagScope] = {}

        self._lock = threading.Lock()

    def open_scope(self, scope_fqn: str) -> TagScope:
        """Return an active scope, creating a new handle after a previous close."""
        with self._lock:
            if scope_fqn not in self._scopes:
                self._scopes[scope_fqn] = TagScope(self, scope_fqn)
            return self._scopes[scope_fqn]

    def _intern_tag_label_locked(
        self, *, classification_name: str, tag_name: str, label_type: LabelType, state: State
    ) -> TagLabel:
        """Return the shared ``TagLabel`` for the given key. Caller must hold ``self._lock``."""
        key = _TagLabelKey(classification_name, tag_name, label_type, state)
        cached = self._tag_label_cache.get(key)
        if cached is not None:
            self._tag_label_cache.move_to_end(key)
            return cached
        tag_fqn = cast("str", fqn.build(None, Tag, classification_name=classification_name, tag_name=tag_name))
        cached = TagLabel(  # pyright: ignore[reportCallIssue]
            tagFQN=TagFQN(tag_fqn),
            labelType=label_type,
            state=state,
            source=TagSource.Classification,
        )
        self._tag_label_cache[key] = cached
        if len(self._tag_label_cache) > self._cache_size:
            self._tag_label_cache.popitem(last=False)
        return cached

    def define(self, tag: TagDefinition) -> None:
        """Queue a definition without attaching it to an entity."""
        if not tag.tag_name or not tag.tag_name.strip():
            return
        tag_fqn = cast("str", fqn.build(None, Tag, classification_name=tag.classification_name, tag_name=tag.tag_name))
        with self._lock:
            if tag_fqn in self._known_tag_fqns:
                self._known_tag_fqns.move_to_end(tag_fqn)
            elif tag_fqn not in self._pending:
                self._pending[tag_fqn] = self._build_pending_record(
                    classification_name=tag.classification_name,
                    classification_description=tag.classification_description,
                    tag_name=tag.tag_name,
                    tag_description=tag.tag_description,
                )

    def attach(
        self,
        *,
        scope: TagScope,
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
            if scope._registry is not self:
                raise ValueError("Tag scope belongs to another registry")
            if scope.closed:
                raise ScopeAlreadyClearedError(
                    f"Tag attach called for closed scope {scope.fqn!r} for entity {entity_fqn!r}"
                )
            if entity_fqn != scope.fqn and not entity_fqn.startswith(scope.fqn + fqn.FQN_SEPARATOR):
                raise ValueError("Tag entity must belong to its scope")
            tag_label = self._intern_tag_label_locked(
                classification_name=tag.classification_name,
                tag_name=tag.tag_name,
                label_type=label_type,
                state=state,
            )
            scope._labels_by_entity.setdefault(entity_fqn, []).append(tag_label)

    def labels_for(self, entity_fqn: str) -> list[TagLabel]:
        """Return tag labels attached to ``entity_fqn`` (idempotent; returns a copy)."""
        with self._lock:
            return [label for scope in self._scopes.values() for label in scope._labels_by_entity.get(entity_fqn, [])]

    def drain(self) -> Iterable[OMetaTagAndClassification]:
        """Yield all queued create payloads and clear the queue."""
        with self._lock:
            pending, self._pending = self._pending, {}
            for tag_fqn in pending:
                self._remember_locked(tag_fqn)

        if pending:
            logger.debug("TagRegistry: drained %d pending tag payloads.", len(pending))
        yield from pending.values()

    def clear_scope(self, scope_fqn: str) -> None:
        """Close active scopes at or below ``scope_fqn``."""
        with self._lock:
            self._clear_scope_locked(scope_fqn)

    def close_scope(self, scope: TagScope) -> None:
        """Close a handle without affecting a newer scope with the same FQN."""
        with self._lock:
            if scope._registry is not self:
                raise ValueError("Tag scope belongs to another registry")
            if not scope.closed:
                self._clear_scope_locked(scope.fqn)

    def _clear_scope_locked(self, scope_fqn: str) -> None:
        prefix = scope_fqn + fqn.FQN_SEPARATOR
        for name in list(self._scopes):
            if name == scope_fqn or name.startswith(prefix):
                scope = self._scopes.pop(name)
                scope.closed = True
                scope._labels_by_entity.clear()

    def _remember_locked(self, tag_fqn: str) -> None:
        self._known_tag_fqns[tag_fqn] = None
        self._known_tag_fqns.move_to_end(tag_fqn)
        if len(self._known_tag_fqns) > self._cache_size:
            self._known_tag_fqns.popitem(last=False)

    def is_known(self, tag_fqn: str) -> bool:
        """Return True if the tag FQN has been recorded (case-sensitive match)."""
        with self._lock:
            if tag_fqn in self._pending:
                return True
            if tag_fqn in self._known_tag_fqns:
                self._known_tag_fqns.move_to_end(tag_fqn)
                return True
            return False

    def ensure_known(self, tag_fqn: str) -> bool:
        """Return True if the tag exists server-side, caching positive results.

        Returns False (and does NOT cache) on 404 or transport error.
        """
        if self.is_known(tag_fqn):
            return True

        logger.debug("TagRegistry: cache miss for %s; fetching from OpenMetadata.", tag_fqn)
        try:
            entity = self._metadata.get_by_name(entity=Tag, fqn=tag_fqn)
        except Exception:
            logger.exception("TagRegistry: tag lookup failed for %s.", tag_fqn)
            return False

        if entity is None:
            logger.warning(
                "TagRegistry: tag %s not found in OpenMetadata; labels referencing it will be skipped.", tag_fqn
            )
            return False

        with self._lock:
            self._remember_locked(tag_fqn)
        return True

    def stats(self) -> dict[str, int]:
        """Return current state counts for instrumentation."""
        with self._lock:
            return {
                "known_tag_fqns": len(self._known_tag_fqns),
                "tag_label_cache": len(self._tag_label_cache),
                "pending": len(self._pending),
                "active_scopes": len(self._scopes),
                "live_entities": sum(len(scope._labels_by_entity) for scope in self._scopes.values()),
                "live_labels": sum(
                    len(labels) for scope in self._scopes.values() for labels in scope._labels_by_entity.values()
                ),
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
