#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Class defining the interface for the profiler source
"""

from abc import ABC, abstractmethod
from typing import Optional

from metadata.profiler.interface.profiler_interface import ProfilerInterface


class ProfilerSourceInterface(ABC):
    """Abstract class defining the interface for the profiler source"""

    @property
    @abstractmethod
    def interface(self) -> Optional[ProfilerInterface]:
        """Interface property"""
        raise NotImplementedError

    @interface.setter
    @abstractmethod
    def interface(self, interface):
        """Set the interface"""
        raise NotImplementedError

    @abstractmethod
    def create_profiler_interface(
        self,
        entity,
        config,
        profiler_config,
        schema_entity,
        database_entity,
        db_service,
    ) -> ProfilerInterface:
        """Create the profiler interface"""
        raise NotImplementedError

    @abstractmethod
    def get_profiler_runner(self, entity, profiler_config):
        """Get the profiler runner"""
        raise NotImplementedError
