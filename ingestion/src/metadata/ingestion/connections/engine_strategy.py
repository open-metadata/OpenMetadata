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
Engine-building strategy for database connectors.

A database connector selects one strategy per authentication mode; the strategy
builds the SQLAlchemy engine and releases whatever it created. Most modes hold
only the engine, so ``close()`` defaults to disposing it; a mode with an
auxiliary resource (e.g. a GCP CloudSQL ``Connector``) extends ``close()``.

This base is shared across database connectors. Connector-specific strategies
live in the connector's module for now; strategies reused across connectors
(Azure AD, CloudSQL) are expected to graduate here as connectors adopt them.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Generic, TypeVar

if TYPE_CHECKING:
    from sqlalchemy.engine import Engine

ConnectionConfig = TypeVar("ConnectionConfig")


class EngineStrategy(ABC, Generic[ConnectionConfig]):
    """Builds and tears down the engine for one auth mode of a database connector."""

    def __init__(self, connection: ConnectionConfig) -> None:
        self._connection = connection
        self._engine: Engine | None = None

    @abstractmethod
    def build(self) -> Engine:
        """Build the engine, storing it on ``self._engine`` for ``close()``."""

    def close(self) -> None:
        if self._engine is not None:
            self._engine.dispose()
            self._engine = None
