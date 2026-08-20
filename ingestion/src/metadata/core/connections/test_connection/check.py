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
"""Step identity, the ``@check`` decorator, and discovery."""

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
    """A failed check that still carries the ``Evidence`` it had gathered.

    Lets a failed step report what it attempted, without the runner reading the
    cause's internals.
    """

    def __init__(self, cause: BaseException, evidence: Evidence) -> None:
        super().__init__(str(cause))
        self.cause = cause
        self.evidence = evidence


class StepName(str, Enum):
    """Base for per-category step-identity enums; ``str`` so members join the
    definition's step names directly."""


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

    Walks the MRO (subclass overrides win) and reads only tagged methods, so a
    provider property with side effects is never triggered.
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
