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
The reference a collaborator may hold to a client it does not own.

A connection owns exactly one client: it knows the recipe (the service config and
``_get_client``) and it owns the teardown. A collaborator - a checks provider -
needs to *use* that client without being able to build another one or to close
this one. ``Borrowed`` is that reference.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Generic, TypeVar

if TYPE_CHECKING:
    from collections.abc import Callable

C = TypeVar("C")


class Borrowed(Generic[C]):
    """A client someone else owns: read it, never build it, never close it.

    Reads through to the owner, which builds the client on first read and caches
    it, so every reader sees the one client the owner also uses. Carries no
    service config - so a holder cannot construct a second client - and no
    teardown - so it cannot destroy the one it borrowed.

    A checks provider takes its clients as ``Borrowed``: reading one inside a
    ``@check`` is what makes the owner build it, which keeps the first connection
    behind the runner's gate instead of running while the provider is assembled.
    """

    __slots__ = ("_read",)

    def __init__(self, read: Callable[[], C]) -> None:
        self._read = read

    @property
    def client(self) -> C:
        return self._read()

    @classmethod
    def of(cls, client: C) -> Borrowed[C]:
        """A handle over an already-built client. For tests and fakes."""
        return cls(lambda: client)
