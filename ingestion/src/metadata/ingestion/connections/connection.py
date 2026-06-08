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
BaseConnection: the lifecycle owner for a connector's client.

Each connector subclasses ``BaseConnection`` and implements ``_get_client`` to
build its client (a SQLAlchemy Engine, a REST client, ...). The base owns the
rest: lazy creation, a registry of teardowns (``_on_close``) unwound in LIFO by
``close()``, context-manager support, and the ``test_connection`` entrypoint.
The client is built once (at source start-up or per test connection); any
per-thread working handles derived from it are managed a layer up, so this class
is not concerned with concurrent access.
"""

from abc import ABC, abstractmethod
from collections.abc import Callable
from contextlib import ExitStack
from typing import TYPE_CHECKING, Generic, Optional, TypeVar

from metadata.core.connections.test_connection.constants import STEP_TIMEOUT_SECONDS
from metadata.core.connections.test_connection.runner import TestConnectionRunner
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

if TYPE_CHECKING:
    from metadata.core.connections.test_connection.check import ChecksProvider

S = TypeVar("S")  # ServiceConnection Type
C = TypeVar("C")  # Client Type


class BaseConnection(ABC, Generic[S, C]):
    """
    Abstract base class for connections, providing a unified interface for service
    connection and client/engine access across different data sources.
    """

    service_connection: S
    _client: Optional[C]  # noqa: UP045

    def __init__(self, service_connection: S) -> None:
        self.service_connection = service_connection
        self._client = None
        self._closing = ExitStack()

    @property
    def client(self) -> C:
        """The service client, built once on first access and cached."""
        if self._client is None:
            self._client = self._get_client()
        return self._client

    @abstractmethod
    def _get_client(self) -> C:
        """Build the client (engine, REST client, ...). Called once by ``client``."""

    def checks(self) -> "ChecksProvider":
        """
        Return this connection's checks provider. Override to expose
        test-connection checks; until then this connection exposes none.
        """
        raise NotImplementedError("This connector has not implemented test-connection checks")

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = STEP_TIMEOUT_SECONDS,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test the connection to the service through the test-connection runner.
        The timeout is applied per step.
        """
        # Every service connection config carries a `type` enum, but `S` is an
        # unbound TypeVar so the access can't be proven statically.
        service_type = self.service_connection.type.value  # pyright: ignore[reportAttributeAccessIssue]
        try:
            result = TestConnectionRunner(self.checks(), service_type, timeout_seconds).run(
                metadata, automation_workflow
            )
        finally:
            self.close()
        return result

    def _on_close(self, teardown: Callable[[], None]) -> None:
        """Register a teardown to run on ``close()``. ``_get_client`` calls this
        for each resource it acquires (e.g. ``engine.dispose``); they unwind in
        LIFO order, so the client is released after anything derived from it."""
        self._closing.callback(teardown)

    def close(self) -> None:
        """Release the client and everything its build registered, then reset so
        the connection can be reused (the next ``client`` access rebuilds). The
        connection owns its lifecycle; callers use it as a context manager or
        call ``close()`` when done."""
        self._closing.close()
        self._closing = ExitStack()
        self._client = None

    def __enter__(self) -> "BaseConnection[S, C]":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    @abstractmethod
    def get_connection_dict(self) -> dict:
        """
        Return the connection dictionary for this service.
        """
