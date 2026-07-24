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
from collections.abc import Iterable
from typing import NamedTuple, cast

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
from metadata.ingestion.ometa.utils import model_str
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


class TagRegistry:
    """Registry for Tag and Classification ingestion bookkeeping."""

    def __init__(self, metadata: OpenMetadata) -> None:
        self._metadata = metadata

        self._known_tag_fqns: set[str] = set()
        self._tag_label_cache: dict[_TagLabelKey, TagLabel] = {}
        self._pending: list[OMetaTagAndClassification] = []
        self._cleared_scopes: set[str] = set()
        self._labels_by_entity: dict[str, list[TagLabel]] = {}

        self._lock = threading.Lock()

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

    def attach(
        self,
        *,
        scope_fqn: str,
        entity_fqn: str,
        classification_name: str,
        tag_name: str,
        classification_description: str,
        tag_description: str,
        label_type: LabelType = LabelType.Automated,
        state: State = State.Suggested,
    ) -> None:
        """Register a tag <-> entity association."""
        if not tag_name or not tag_name.strip():
            logger.debug("TagRegistry: skipping empty tag for classification %s", classification_name)
            return

        with self._lock:
            if scope_fqn in self._cleared_scopes:
                raise ScopeAlreadyClearedError(
                    f"Tag attach called for cleared scope '{scope_fqn!r}' for entity '{entity_fqn!r}'"
                )
            tag_label = self._intern_tag_label_locked(
                classification_name=classification_name,
                tag_name=tag_name,
                label_type=label_type,
                state=state,
            )
            self._labels_by_entity.setdefault(entity_fqn, []).append(tag_label)

            tag_fqn = model_str(tag_label.tagFQN)
            if tag_fqn not in self._known_tag_fqns:
                self._known_tag_fqns.add(tag_fqn)
                self._pending.append(
                    self._build_pending_record(
                        classification_name=classification_name,
                        classification_description=classification_description,
                        tag_name=tag_name,
                        tag_description=tag_description,
                    )
                )

    def labels_for(self, entity_fqn: str) -> list[TagLabel]:
        """Return tag labels attached to ``entity_fqn`` (idempotent; returns a copy)."""
        with self._lock:
            return list(self._labels_by_entity.get(entity_fqn, []))

    def drain(self) -> Iterable[OMetaTagAndClassification]:
        """Yield all queued create payloads and clear the queue."""
        with self._lock:
            pending, self._pending = self._pending, []

        if pending:
            logger.debug("TagRegistry: drained %d pending tag payloads.", len(pending))
        yield from pending

    def clear_scope(self, scope_fqn: str) -> None:
        """Drop labels under ``scope_fqn`` and mark the scope cleared.

        Subsequent ``attach`` calls for this scope will raise.
        """
        prefix = scope_fqn + fqn.FQN_SEPARATOR

        with self._lock:
            self._cleared_scopes.add(scope_fqn)
            kept = {k: v for k, v in self._labels_by_entity.items() if k != scope_fqn and not k.startswith(prefix)}
            dropped = len(self._labels_by_entity) - len(kept)
            self._labels_by_entity = kept
        if dropped:
            logger.debug("TagRegistry: cleared scope %s (%d entity labels dropped)", scope_fqn, dropped)

    def is_known(self, tag_fqn: str) -> bool:
        """Return True if the tag FQN has been recorded (case-sensitive match)."""
        with self._lock:
            return tag_fqn in self._known_tag_fqns

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
            self._known_tag_fqns.add(tag_fqn)
        return True

    def stats(self) -> dict[str, int]:
        """Return current state counts for instrumentation."""
        with self._lock:
            return {
                "known_tag_fqns": len(self._known_tag_fqns),
                "tag_label_cache": len(self._tag_label_cache),
                "pending": len(self._pending),
                "cleared_scopes": len(self._cleared_scopes),
                "live_entities": len(self._labels_by_entity),
                "live_labels": sum(len(v) for v in self._labels_by_entity.values()),
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
