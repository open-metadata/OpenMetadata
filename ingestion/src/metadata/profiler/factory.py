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
Factory class for creating profiler interface objects
"""
from abc import ABC, abstractmethod


class Factory(ABC):
    """Creational factory for interface objects"""

    def __init__(self):
        self._interface_type = {}

    def register(self, interface_type: str, interface_class):
        """Register a new interface"""
        self._interface_type[interface_type] = interface_class

    def register_many(self, interface_dict):
        """
        Registers multiple profiler interfaces at once.

        Args:
            interface_dict: A dictionary mapping connection class names (strings) to their
            corresponding profiler interface classes.
        """
        for interface_type, interface_class in interface_dict.items():
            self.register(interface_type, interface_class)

    @abstractmethod
    def create(self, interface_type: str, *args, **kwargs) -> any:
        pass
