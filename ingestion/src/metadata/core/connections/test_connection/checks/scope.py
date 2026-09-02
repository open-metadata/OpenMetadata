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
"""Which objects a check probes, and probing them until one answers.

A step that has to read *one* schema (keyspace, bucket, ...) out of many must pick
the same objects the ingestion will read. Probing whichever object the server
happened to list first fails connections whose ingestion would have worked: a
restricted login usually holds permission on exactly the objects it ingests, and
nothing else. See #28142 and #32450.

Athena (``AthenaChecks._targeted_schemas``) and Glue (``list_tables``) arrived at
the same shape independently - resolve the in-scope objects, try them until one
answers, treat "nothing in scope" as a caveat rather than a failure. This is that
shape, factored out so the next connector does not rediscover it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from metadata.utils.filters import filtered_out
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable, Sequence

    from metadata.generated.schema.type.filterPattern import FilterPattern

logger = ingestion_logger()


# Each target costs a round-trip, so a catalog with very many objects cannot be
# allowed to exhaust the step timeout. Matches Glue's MAX_DATABASES_TO_PROBE.
DEFAULT_MAX_TARGETS = 10


@dataclass(frozen=True)
class ProbeScope:
    """The objects a check may probe, in the order to try them.

    ``pinned`` is a configured single target (``databaseSchema``, ``bucket``, ...):
    when set it is the only object ingestion reads, so it is the only one probed
    and no listing is needed. ``excluded`` is the filter pattern from the service
    connection.

    System objects are handled two ways, because the connectors differ on whether
    ingestion reads them: ``skipped`` drops them from the candidates, ``last_resort``
    keeps them but tries them only once everything else has been tried. A connector
    whose ingestion reads its system objects (Cassandra keyspaces) wants the
    latter; one whose ingestion never does (a SQL catalog) wants the former.
    """

    pinned: str | None = None
    excluded: FilterPattern | None = None
    skipped: frozenset[str] = field(default_factory=frozenset)
    last_resort: frozenset[str] = field(default_factory=frozenset)
    limit: int = DEFAULT_MAX_TARGETS

    def targets(self, names: Iterable[str]) -> list[str]:
        """The in-scope objects among ``names``, preferred ones first."""
        if self.pinned:
            return [self.pinned]
        dropped = {name.lower() for name in self.skipped}
        deferred_names = {name.lower() for name in self.last_resort}
        preferred: list[str] = []
        deferred: list[str] = []
        for name in names:
            if name.lower() in dropped or filtered_out(self.excluded, name):
                continue
            target = deferred if name.lower() in deferred_names else preferred
            target.append(name)
        return (preferred + deferred)[: self.limit]


def probe_targets(targets: Sequence[str], probe: Callable[[str], None]) -> str | None:
    """The first target ``probe`` accepts, or ``None`` when there is nothing to probe.

    Every target failing re-raises the last error - the login can read none of what
    it would ingest, which is a real failure. One target failing is not: the next
    one is tried. An empty ``targets`` is for the caller to report, usually as a
    caveat, since a scope that resolves to nothing is a configuration answer rather
    than a connection error.
    """
    error: Exception | None = None
    for target in targets:
        try:
            probe(target)
        except Exception as exc:
            error = exc
            logger.debug("Probe of %r failed: %s", target, exc)
        else:
            return target
    if error is not None:
        raise error
    return None
