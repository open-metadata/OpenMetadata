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
Metric Core definitions
"""

from abc import ABC, abstractmethod
from typing import Any, Dict

from sqlalchemy.orm.attributes import InstrumentedAttribute

# When creating complex metrics, use inherit_cache = CACHE
CACHE = True


class Metric(ABC):
    """
    Parent class metric

    We have 3 types of Metrics:
    - StaticMetric
    - TimeMetric
    - CustomMetric
    """

    def __init__(self, col: InstrumentedAttribute):
        self.col = col

    @classmethod
    def name(cls) -> str:
        """
        Metric name
        """
        return cls.__name__.upper()

    @property
    def metric_type(self):
        """
        By default, the returning type
        of metric is the column type.

        We are converting the SQLAlchemy type
        to a Python type. E.g.,
        String(length=256) -> str

        We can override this for things like
        variance, where it will be a float
        """
        return self.col.type.python_type


class StaticMetric(Metric, ABC):
    """
    Static metric definition
    """

    @abstractmethod
    def fn(self):
        """
        SQLAlchemy function to be executed in Query
        """


class TimeMetric(Metric, ABC):
    """
    Time Metric definition
    """

    @property
    @abstractmethod
    def window(self):
        """
        Window time to run the validation
        """

    @abstractmethod
    def fn(self):
        """
        SQLAlchemy function to be executed in Query
        """


class CustomMetric(Metric, ABC):
    """
    Custom metric definition
    """

    @property
    @abstractmethod
    def sql(self):
        """
        SQL query to run the custom Metric
        """


class ComposedMetric(Metric, ABC):
    """
    A Metric composed by other metrics.

    Here the fn is not an SQLAlchemy query block,
    but rather a property that will be added
    directly in the profiler.
    """

    @abstractmethod
    def fn(self, res: Dict[str, Any]):
        """
        This metric computes its value based on
        the results already present in the Profiler
        """
