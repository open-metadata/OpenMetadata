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
OpenMetadata data insight producer interface. This is an abstract class that 
defines the interface for all data insight producers.
"""

from abc import ABC, abstractmethod

from metadata.ingestion.ometa.ometa_api import OpenMetadata


class ProducerInterface(ABC):
    def __init__(self, metadata: OpenMetadata):
        """instantiate a producer object"""
        self.metadata = metadata

    @abstractmethod
    def fetch_data(self, limit, fields):
        """fetch data from source"""
        raise NotImplementedError
