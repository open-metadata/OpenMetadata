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
import logging
from abc import ABC, abstractmethod
from functools import wraps
from typing import Any, Dict, Optional, Tuple, TypeVar

from sqlalchemy import Column
from sqlalchemy.orm import Session

try:
    from sqlalchemy.orm import DeclarativeMeta
except ImportError:
    logging.warning(
        "Cannot import DeclarativeMeta from SQLAlchemy version <1.4. This will break the profiler."
        " Make sure to install `openmetadata-ingestion` with the `profiler` plugin if you"
        " need to run the Profiler Workflow."
    )

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
        self, sample: Optional["DeclarativeMeta"], session: Optional[Session] = None
    ):
        """
        SQLAlchemy query to execute with .all()

        Note that we might need to pass the session
        from the profiler to precook some
        necessary ingredients.
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
