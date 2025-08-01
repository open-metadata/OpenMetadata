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
Metric Core definitions
"""

# pylint: disable=invalid-name

from abc import ABC, abstractmethod
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, Optional, Tuple, TypeVar

from sqlalchemy import Column
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.generated.schema.entity.data.table import Table
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor

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


def add_props(**kwargs):
    """
    Sometimes we might need to add some
    flavour dynamically to our Metrics definition.

    For example, when passing the `bins` for the HISTOGRAM
    or `expression` for LIKE & ILIKE.

    This function is a class decorator that we can run as:
    new_hist = add_props(bins=5)(Metrics.HISTOGRAM.value)

    new_hist will still be a class, so we can safely pass it
    to the profiler to be initialized for all the columns.
    """

    def inner(cls):
        # Create a new cls instance to avoid updating the original ref
        # In these scenarios, deepcopy(cls) just returns a pointer
        # to the same reference
        _new_cls = type("_new_cls", cls.__bases__, dict(cls.__dict__))
        _orig = cls.__init__

        def _new_init(self, *args, **kw):
            for key, value in kwargs.items():
                setattr(self, key, value)
            _orig(self, *args, **kw)

        _new_cls.__init__ = _new_init

        return _new_cls

    return inner


T = TypeVar("T")


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

    def __init__(self, col: Optional[Column] = None, **kwargs):
        self.col = col

        # We allow to pass any metric specific kwarg
        for key, value in kwargs.items():
            self.__setattr__(key, value)

    @classmethod
    @abstractmethod
    def name(cls) -> str:
        """
        Metric name. Follow JSON Schema specifications
        """

    @classmethod
    def is_col_metric(cls) -> bool:
        """
        Marks the metric as table or column metric.

        By default, assume that a metric is a column
        metric. Table metrics should override this.
        """
        return True

    @classmethod
    def is_window_metric(cls) -> bool:
        """
        Marks the metric as a window metric.

        By default, assume it is not a window metric
        """
        return False

    @classmethod
    def is_system_metrics(cls) -> bool:
        """Mark true if returns system metrics"""
        return False

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
        return self.col.type.python_type if self.col else None

    def nosql_fn(self, client: NoSQLAdaptor) -> Callable[[Table], Optional[T]]:
        """
        Return the function to be used for NoSQL clients to calculate the metric.
        By default, returns a "do nothing" function that returns None.
        """
        return lambda table: None


TMetric = TypeVar("TMetric", bound=Metric)


class StaticMetric(Metric, ABC):
    """
    Static metric definition
    """

    @abstractmethod
    def fn(self):
        """
        SQLAlchemy function to be executed in Query
        """


class QueryMetric(Metric, ABC):
    """
    Metric that needs to execute a fully fledged
    query to output +1 rows as a result or that
    need multiple steps in the computations.
    """

    @abstractmethod
    def query(
        self, sample: Optional[DeclarativeMeta], session: Optional[Session] = None
    ):
        """
        SQLAlchemy query to execute with .all()

        Note that we might need to pass the session
        from the profiler to precook some
        necessary ingredients.
        """


class HybridMetric(Metric, ABC):
    """
    Metric that needs to execute a fully fledged
    query and might need existing metrics to compute
    some part of the metric.
    """

    @abstractmethod
    def fn(
        self,
        sample: Optional[DeclarativeMeta],
        res: Dict[str, Any],
        session: Optional[Session] = None,
    ):
        """
        Function implementing the metric computation.

        These metrics will require result from other metrics
        and a session to execute the query.
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


class SystemMetric(Metric, ABC):
    """Abstract class for system metrics"""

    @abstractmethod
    def sql(self, session: Session, **kwargs):
        """SQL query to get system Metric"""


class ComposedMetric(Metric, ABC):
    """
    A Metric composed by other metrics.

    Here the fn is not an SQLAlchemy query block,
    but rather a property that will be added
    directly in the profiler.
    """

    @classmethod
    @abstractmethod
    def required_metrics(cls) -> Tuple[str, ...]:
        """
        Return a tuple of the required metrics' names
        necessary to compute the composed metric.

        This validation will happen at the profiler
        and will raise an exception if no proper metrics
        have been passed.
        """

    @abstractmethod
    def fn(self, res: Dict[str, Any]):
        """
        This metric computes its value based on
        the results already present in the Profiler
        """


class MetricTypes(Enum):
    """List of metric types"""

    Table = "Table"
    Static = "Static"
    Composed = "Composed"
    Custom = "Custom"
    Query = "Query"
    Window = "Window"
    System = "System"
