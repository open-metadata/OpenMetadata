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
"""MetricIngestionFeature — connector-neutral, bounded, drainable Metric emitter.

Contract:
    ``accept(definition)`` validates and buffers definitions.
    ``drain()`` yields one CreateMetricRequest per accepted definition, in
    dependency order, with ``assets`` populated as fqn-only EntityReferenceInput
    items. The server resolves fqn → id in ``MetricMapper.createToEntity``.

Failure modes:
    * Non-identical definitions for one MetricKey → ``ValueError``.
    * Overflow past ``max_definitions`` → ``MetricFeatureOverflowError``.
    * Cycles or unresolved dependencies → visible ``Either.left`` at drain.
"""

from __future__ import annotations

import traceback
from collections.abc import Iterable  # noqa: TC003

from metadata.domain.metrics.mappers import (
    resolve_related_metric_fqns,
    to_create_request,
)
from metadata.domain.metrics.records import MetricDefinition, MetricKey  # noqa: TC001
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.ingestion.api.models import Either


class MetricFeatureOverflowError(RuntimeError):
    """Raised when accept() would exceed the feature's bounded capacity."""


DEFAULT_MAX_DEFINITIONS = 10_000


class MetricIngestionFeature:
    """See the module docstring for the full contract."""

    def __init__(self, *, max_definitions: int = DEFAULT_MAX_DEFINITIONS) -> None:
        self._max = max_definitions
        self._definitions: dict[MetricKey, MetricDefinition] = {}

    def accept(self, definition: MetricDefinition) -> None:
        """Register a definition.

        Raises:
            MetricFeatureOverflowError: bounded capacity reached.
            ValueError: same MetricKey seen with a non-identical payload.
        """
        existing = self._definitions.get(definition.key)
        if existing is not None:
            if existing.canonical_payload() != definition.canonical_payload():
                raise ValueError(
                    f"Conflicting definitions for {_key_repr(definition.key)}: "
                    "same MetricKey, different payload; refusing last-write-wins",
                )
            return
        if len(self._definitions) >= self._max:
            raise MetricFeatureOverflowError(
                f"MetricIngestionFeature capacity reached ({self._max} definitions); "
                f"cannot accept {_key_repr(definition.key)}",
            )
        self._definitions[definition.key] = definition

    def drain(self) -> Iterable[Either]:
        """Yield one CreateMetricRequest per accepted definition, in dep order."""
        definitions = self._definitions
        self._definitions = {}
        if not definitions:
            return

        ordered, cycle_errors = _topological_sort(definitions)
        for error in cycle_errors:
            yield Either(left=error, right=None)

        emitted_fqns: dict[MetricKey, str] = {}
        for definition in ordered:
            related_fqns = resolve_related_metric_fqns(definition, emitted_fqns)
            try:
                request = to_create_request(definition, related_metric_fqns=related_fqns)
            except Exception as exc:
                yield _error(_key_repr(definition.key), exc)
                continue
            emitted_fqns[definition.key] = definition.name
            yield Either(left=None, right=request)


def _key_repr(key: MetricKey) -> str:
    return f"{key.source_type.value}:{key.service_name}:{key.external_id}"


def _topological_sort(
    definitions: dict[MetricKey, MetricDefinition],
) -> tuple[list[MetricDefinition], list[StackTraceError]]:
    """Kahn topo sort with stable ordering; errors for cycles + unresolved deps."""
    keys_sorted = sorted(definitions, key=_sort_key)
    known = set(definitions)
    errors: list[StackTraceError] = []
    dependents: dict[MetricKey, list[MetricKey]] = {k: [] for k in keys_sorted}
    remaining_indegree: dict[MetricKey, int] = {}
    for key in keys_sorted:
        definition = definitions[key]
        remaining = 0
        for dep in definition.depends_on:
            if dep not in known:
                errors.append(
                    StackTraceError(
                        name=_key_repr(key),
                        error=(f"unresolved dependency {_key_repr(dep)} referenced by {_key_repr(key)}"),
                        stackTrace=None,
                    )
                )
                continue
            dependents[dep].append(key)
            remaining += 1
        remaining_indegree[key] = remaining
    ready = sorted(
        (k for k, count in remaining_indegree.items() if count == 0),
        key=_sort_key,
    )
    ordered_keys: list[MetricKey] = []
    while ready:
        current = ready.pop(0)
        ordered_keys.append(current)
        for child in sorted(dependents[current], key=_sort_key):
            remaining_indegree[child] -= 1
            if remaining_indegree[child] == 0:
                _insort(ready, child)
    if len(ordered_keys) < len(keys_sorted):
        cycle_keys = [k for k in keys_sorted if k not in ordered_keys]
        errors.extend(
            StackTraceError(
                name=_key_repr(key),
                error=f"dependency cycle involving {_key_repr(key)}",
                stackTrace=None,
            )
            for key in cycle_keys
        )
    ordered = [definitions[k] for k in ordered_keys]
    return ordered, errors


def _sort_key(key: MetricKey) -> tuple[str, str, str]:
    return (key.source_type.value, key.service_name, key.external_id)


def _insort(container: list[MetricKey], key: MetricKey) -> None:
    lo, hi = 0, len(container)
    while lo < hi:
        mid = (lo + hi) // 2
        if _sort_key(container[mid]) < _sort_key(key):
            lo = mid + 1
        else:
            hi = mid
    container.insert(lo, key)


def _error(context: str, exc: Exception) -> Either:
    return Either(
        left=StackTraceError(
            name=context,
            error=f"{context}: {exc}",
            stackTrace=traceback.format_exc(),
        ),
        right=None,
    )
