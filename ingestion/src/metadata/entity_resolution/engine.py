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

"""FQN entity resolution with state owned by one execution run."""

import re
from collections import OrderedDict
from dataclasses import dataclass
from enum import Enum
from threading import Lock
from typing import Generic, TypeVar

from metadata.ingestion.models.entity_interface import EntityInterface
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils import fqn

T = TypeVar("T", bound=EntityInterface)


class FqnLookupMode(str, Enum):
    EXACT = "exact"
    CASE_INSENSITIVE_EXACT = "case_insensitive_exact"
    WILDCARD = "wildcard"


@dataclass(frozen=True)
class FqnCandidate:
    value: str
    mode: FqnLookupMode


@dataclass(frozen=True)
class ResolutionTier:
    candidates: tuple[FqnCandidate, ...]


@dataclass(frozen=True)
class EntityResolutionPlan(Generic[T]):
    entity_type: type[T]
    tiers: tuple[ResolutionTier, ...]
    fields: tuple[str, ...] = ()
    include: str | None = None
    max_candidates_per_lookup: int = 10

    def __post_init__(self):
        object.__setattr__(self, "fields", tuple(sorted(set(self.fields))))
        if self.max_candidates_per_lookup < 1:
            raise ValueError("Candidate limit must be positive")
        if self.include not in (None, "non-deleted", "deleted", "all"):
            raise ValueError("Unsupported include policy")
        for tier in self.tiers:
            for candidate in tier.candidates:
                if not candidate.value or not isinstance(candidate.mode, FqnLookupMode):
                    raise ValueError("A candidate requires an FQN and lookup mode")
                if self.include in ("deleted", "all") and candidate.mode != FqnLookupMode.EXACT:
                    raise ValueError("Search-assisted resolution supports active entities only")


class EntityResolver:
    """Resolve borrowed read-only entities; the owner closes after its work finishes."""

    def __init__(self, metadata: OpenMetadata, cache_capacity: int = 512, max_plan_candidates: int = 100):
        if cache_capacity < 1 or max_plan_candidates < 1:
            raise ValueError("Resolver capacities must be positive")
        self._metadata = metadata
        self._capacity = cache_capacity
        self._max_plan_candidates = max_plan_candidates
        self._cache = OrderedDict()
        self._lock = Lock()
        self._closed = False

    def resolve(self, plan: EntityResolutionPlan[T]) -> tuple[T, ...]:
        """Return the first nonempty tier; do not cache empty results or failures."""
        with self._lock:
            self._ensure_open()
            if sum(len(tier.candidates) for tier in plan.tiers) > self._max_plan_candidates:
                raise ValueError("Too many candidates in resolution plan")
            if plan in self._cache:
                self._cache.move_to_end(plan)
                return self._cache[plan]

        result = ()
        for tier in plan.tiers:
            entities = {}
            for candidate in tier.candidates:
                for entity in self._lookup(plan, candidate):
                    entities[model_str(entity.id)] = entity
            if entities:
                result = tuple(
                    sorted(
                        entities.values(),
                        key=lambda entity: (model_str(entity.fullyQualifiedName), model_str(entity.id)),
                    )
                )
                break

        with self._lock:
            self._ensure_open()
            if result:
                self._cache[plan] = result
                self._cache.move_to_end(plan)
                if len(self._cache) > self._capacity:
                    self._cache.popitem(last=False)
        return result

    def _lookup(self, plan: EntityResolutionPlan[T], candidate: FqnCandidate) -> list[T]:
        if candidate.mode == FqnLookupMode.EXACT:
            names = (candidate.value,)
        else:
            found = self._metadata.search_fqn_candidates(
                entity_type=plan.entity_type,
                value=candidate.value,
                wildcard=candidate.mode == FqnLookupMode.WILDCARD,
                size=plan.max_candidates_per_lookup + 1,
            )
            if found.total > plan.max_candidates_per_lookup or len(found.fqns) > plan.max_candidates_per_lookup:
                raise ValueError("FQN candidate search exceeds the configured limit")
            if not found.total_is_exact or found.total != len(found.fqns):
                raise ValueError("Incomplete FQN candidate search")
            names = found.fqns

        result = []
        for name in dict.fromkeys(names):
            if not _matches(candidate, name):
                continue
            entity = self._metadata.get_by_name(
                entity=plan.entity_type, fqn=name, fields=list(plan.fields), include=plan.include
            )
            if entity is None:
                continue
            if model_str(entity.fullyQualifiedName) != name:
                continue
            deleted = bool(entity.deleted)
            if (plan.include in (None, "non-deleted") and deleted) or (plan.include == "deleted" and not deleted):
                continue
            result.append(entity)
        return result

    def close(self) -> None:
        """Clear owned state and reject future resolution without closing the client."""
        with self._lock:
            self._closed = True
            self._cache.clear()

    def _ensure_open(self) -> None:
        if self._closed:
            raise RuntimeError("EntityResolver is closed")


def _matches(candidate: FqnCandidate, name: str) -> bool:
    if candidate.mode == FqnLookupMode.EXACT:
        return candidate.value == name
    if candidate.mode == FqnLookupMode.CASE_INSENSITIVE_EXACT:
        return candidate.value.lower() == name.lower()
    patterns = fqn.split_raw_name(candidate.value)
    parts = fqn.split_raw_name(name)
    if len(patterns) != len(parts):
        return False
    return all(
        re.fullmatch(_wildcard_pattern(pattern.lower()), part.lower(), flags=re.DOTALL)
        for pattern, part in zip(patterns, parts, strict=True)
    )


def _wildcard_pattern(value: str) -> str:
    pattern = []
    chars = iter(value)
    for char in chars:
        if char == "\\":
            pattern.append(re.escape(next(chars, "\\")))
        elif char == "*":
            pattern.append(".*")
        elif char == "?":
            pattern.append(".")
        else:
            pattern.append(re.escape(char))
    return "".join(pattern)
