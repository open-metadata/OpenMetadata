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
from functools import wraps
from typing import Any, Dict, Optional

from sqlalchemy.orm.attributes import InstrumentedAttribute

# When creating complex metrics, use inherit_cache = CACHE
CACHE = True


def _label(_fn):
    """
    Decorator factory (based on self) to
    automate how we pass the naming - label -
    to the metrics when defining `fn`.

    Decorate fn with @self.label() if you
    want the default label, or ignore and write
    your own query.label("<name>").

    Using the name `_fn` here to not be confused
    with the `fn` method in Metric.
    """

    @wraps(_fn)
    def inner(self, *args, **kwargs):
        res = _fn(self, *args, **kwargs)

        # If the metric computation returns some value
        if res is not None:
            return res.label(self.name())

        return None

    return inner


class Metric(ABC):
    """
    Parent class metric

    We have 3 types of Metrics:
    - StaticMetric
    - TimeMetric
    - CustomMetric

    Table Metrics do not require a column.
    If not specified, it is a Table metric.
    """

    def __init__(self, col: Optional[InstrumentedAttribute] = None):
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

    # TODO: new abstract method with the set of required metrics so that we can validate profilers

    @abstractmethod
    def fn(self, res: Dict[str, Any]):
        """
        This metric computes its value based on
        the results already present in the Profiler
        """


class RuleMetric(Metric, ABC):
    """
    Useful when we need to take into consideration the
    state of more than one column at a time.

    E.g., the validation would be:
    if `state` is `delivered`, `payment` should be informed.

    This Metric is based on a target column, the one we will
    use to inform the results, and the filters, which will
    define the domain.

    TODO: Figure out the filters signature. We might need
          to come back here after defining the validations.
    """

    def __init__(
        self, target_col: InstrumentedAttribute, *filters: InstrumentedAttribute
    ):
        super().__init__(col=target_col)
        self._filters = filters
