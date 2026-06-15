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
Step identity, the ``@check`` decorator, and discovery.

A connector exposes its checks as ``@check(StepName)``-decorated methods on a
provider object. ``collect_checks`` walks the provider's class hierarchy and
returns a ``{step name: bound method}`` map the runner resolves against the
definition.
"""

from __future__ import annotations

from collections.abc import Callable
from enum import Enum
from typing import TYPE_CHECKING, Protocol, TypeVar

if TYPE_CHECKING:
    from metadata.core.connections.test_connection.classifier import ErrorPack
    from metadata.core.connections.test_connection.records import Evidence

_CHECK_ATTR = "__check__"

_Provider = TypeVar("_Provider")


class DuplicateCheckError(Exception):
    """Raised when two methods on a provider claim the same step name."""


class CheckError(Exception):
    """A check that failed but still carries the ``Evidence`` it had gathered.

    Raising this instead of the bare cause lets the runner record what the step
    attempted (e.g. the executed command) on a *failed* result, while still
    classifying and logging the real cause. The runner stays engine-agnostic: it
    only reads the ``Evidence`` off this core type, never the cause's internals.
    """

    def __init__(self, cause: BaseException, evidence: Evidence) -> None:
        super().__init__(str(cause))
        self.cause = cause
        self.evidence = evidence


class StepName(str, Enum):
    """Base for per-category step-identity enums (e.g. ``DatabaseStep``).

    Subclassing ``str`` is what lets members join directly to the definition's
    string step names; subclasses declare the members.
    """


# A bound check the runner calls; the connector implements the unbound form.
# A check may return ``None`` when it has nothing to report beyond "did not
# raise"; the runner treats that as empty ``Evidence``.
CheckMethod = Callable[[], "Evidence | None"]


def check(
    name: StepName,
) -> Callable[[Callable[[_Provider], Evidence | None]], Callable[[_Provider], Evidence | None]]:
    """Tag a method as the check for ``name``.

    The decorated method must be ``(self) -> Evidence | None``; a static type
    checker flags any check whose parameters or return type differ.
    """

    def mark(
        fn: Callable[[_Provider], Evidence | None],
    ) -> Callable[[_Provider], Evidence | None]:
        setattr(fn, _CHECK_ATTR, name)
        return fn

    return mark


class ChecksProvider(Protocol):
    """The contract the runner depends on: an error pack plus ``@check`` methods."""

    errors: ErrorPack


def collect_checks(provider: ChecksProvider) -> dict[str, CheckMethod]:
    """Return ``{step name: bound method}`` for every ``@check`` on the provider.

    Walks the class MRO so inherited checks are found and a subclass's ``@check``
    override wins over the base's, and reads only ``@check``-tagged methods - never
    instance data, so a provider property with side effects is never triggered.
    """
    collected: dict[str, CheckMethod] = {}
    seen: set[str] = set()
    for klass in type(provider).__mro__:
        for attr, member in vars(klass).items():
            # Unwrap classmethod/staticmethod; the marker lives on the function.
            target = getattr(member, "__func__", member)
            name: StepName | None = getattr(target, _CHECK_ATTR, None)
            if name is None or attr in seen:
                continue
            seen.add(attr)
            if name in collected:
                raise DuplicateCheckError(
                    f"Step {name!r} is claimed by both "
                    f"{collected[name].__name__!r} and {attr!r} on "
                    f"{type(provider).__name__}"
                )
            collected[name] = getattr(provider, attr)
    return collected
