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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""

from abc import ABC, abstractmethod
from typing import Dict, Optional

from metadata.generated.schema.tests.basic import TestCaseResult


class InterfaceProtocol(ABC):
    """Protocol interface for the processor"""

    @abstractmethod
    def create_sampler(*args, **kwargs) -> None:
        """Method to instantiate a Sampler object"""
        raise NotImplementedError

    @abstractmethod
    def create_runner(*args, **kwargs) -> None:
        """Method to instantiate a Runner object"""
        raise NotImplementedError

    @abstractmethod
    def get_table_metrics(*args, **kwargs) -> Dict:
        """Method to retrieve table metrics"""
        raise NotImplementedError

    @abstractmethod
    def get_window_metrics(*args, **kwargs) -> Dict:
        """Method to retrieve window metrics"""
        raise NotImplementedError

    @abstractmethod
    def get_static_metrics(*args, **kwargs) -> Dict:
        """Method to retrieve static metrics"""
        raise NotImplementedError

    @abstractmethod
    def get_query_metrics(*args, **kwargs) -> Dict:
        """Method to retrieve query metrics"""
        raise NotImplementedError

    @abstractmethod
    def get_composed_metrics(*args, **kwargs) -> Dict:
        """Method to retrieve composed metrics"""
        raise NotImplementedError

    @abstractmethod
    def run_table_test(*args, **kwargs) -> Optional[TestCaseResult]:
        """run table data quality tests"""
        raise NotImplementedError

    @abstractmethod
    def run_column_test(*args, **kwargs) -> Optional[TestCaseResult]:
        """run column data quality tests"""
        raise NotImplementedError
