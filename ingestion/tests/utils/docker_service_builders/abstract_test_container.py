#  Copyright 2024 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""abstract test container for integration tests"""

from abc import ABC, abstractmethod

from testcontainers.core.container import DockerContainer


class AbstractTestContainer(ABC):
    @abstractmethod
    def get_connection_url(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_config(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_source_config(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def start(self):
        raise NotImplementedError

    @abstractmethod
    def stop(self):
        raise NotImplementedError

    @property
    @abstractmethod
    def container(self) -> DockerContainer:
        raise NotImplementedError

    @property
    @abstractmethod
    def connector_type(self) -> str:
        raise NotImplementedError
