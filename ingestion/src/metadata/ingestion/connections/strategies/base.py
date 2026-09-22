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
Client-building strategy for connectors.

A connector with more than one way to build its client (typically one per
authentication mode) implements one strategy per mode and selects between them
in ``_get_client``. Connectors with a single build path do not need a strategy.

The client type is generic: most database connectors build a SQLAlchemy
``Engine``, but a strategy may build any client (a driver session, a cloud SDK
client, etc.).
"""

from abc import ABC, abstractmethod
from typing import Generic, TypeVar

Config = TypeVar("Config")
Client = TypeVar("Client")


class ClientStrategy(ABC, Generic[Config, Client]):
    """Builds the client for one connection mode of a connector."""

    def __init__(self, connection: Config) -> None:
        self._connection = connection

    @abstractmethod
    def build(self) -> Client:
        """Build and return the client for this mode."""
