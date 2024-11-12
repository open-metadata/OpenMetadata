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
#  pylint: disable=unused-argument
"""
System Metric
"""

from abc import ABC
from collections import defaultdict
from typing import Callable, Generic, List, TypeVar

from sqlalchemy.orm import Session

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.profiler.metrics.core import SystemMetric
from metadata.utils.helpers import deep_size_of_dict
from metadata.utils.logger import profiler_logger
from metadata.utils.lru_cache import LRU_CACHE_SIZE, LRUCache

logger = profiler_logger()

MAX_SIZE_IN_BYTES = 2 * 1024**3  # 2GB


def recursive_dic():
    """recursive default dict"""
    return defaultdict(recursive_dic)


SYSTEM_QUERY_RESULT_CACHE = recursive_dic()

T = TypeVar("T")


class CacheProvider(ABC, Generic[T]):
    """Cache provider class to provide cache for system metrics"""

    def __init__(self):
        self.cache = LRUCache[T](LRU_CACHE_SIZE)

    def get_or_update_cache(
        self,
        cache_path: str,
        get_queries_fn: Callable[..., List[T]],
        *args,
        **kwargs,
    ):
        if cache_path in self.cache:
            return self.cache.get(cache_path)
        result = get_queries_fn(*args, **kwargs)
        self.cache.put(cache_path, result)
        return result


class EmptySystemMetricsSource:
    """Empty system metrics source that can be used as a default. Just returns an empty list of system metrics
    for any resource."""

    def get_inserts(self, **kwargs) -> List[SystemProfile]:
        """Get insert queries"""
        return []

    def get_deletes(self, **kwargs) -> List[SystemProfile]:
        """Get delete queries"""
        return []

    def get_updates(self, **kwargs) -> List[SystemProfile]:
        """Get update queries"""
        return []

    def get_kwargs(self, **kwargs):
        """Get kwargs to be used in get_inserts, get_deletes, get_updates"""
        return {}


class SystemMetricsComputer(EmptySystemMetricsSource):
    def __init__(self, *args, **kwargs):
        # collaborative constructor that initalizes upstream classes
        super().__init__(*args, **kwargs)

    def get_system_metrics(self, **kwargs) -> List[SystemProfile]:
        """Return system metrics for a given table. Actual passed object can be a variety of types based
        on the underlying infrastructure. For example, in the case of SQLalchemy, it can be a Table object
        and in the case of Mongo, it can be a collection object."""
        kwargs = super().get_kwargs(**kwargs)
        return (
            super().get_inserts(**kwargs)
            + super().get_deletes(**kwargs)
            + super().get_updates(**kwargs)
        )


class SQASessionProvider:
    """SQASessionProvider class to provide session to the system metrics"""

    def __init__(self, *args, **kwargs):
        self.session = kwargs.pop("session")
        super().__init__(*args, **kwargs)

    def get_session(self):
        return self.session

    def get_database(self) -> str:
        return self.session.get_bind().url.database


class System(SystemMetric):
    """System metric class to fetch:
        1. freshness
        2. affected rows

    This is supported only for BigQuery, Snowflake, and Redshift
    """

    @classmethod
    def is_col_metric(cls) -> bool:
        """
        Marks the metric as table or column metric.

        By default, assume that a metric is a column
        metric. Table metrics should override this.
        """
        return False

    @classmethod
    def is_system_metrics(cls) -> bool:
        """True if returns system metrics"""
        return True

    @classmethod
    def name(cls):
        return MetricType.system.value

    def _manage_cache(self, max_size_in_bytes: int = MAX_SIZE_IN_BYTES) -> None:
        """manage cache and clears it if it exceeds the max size

        Args:
            max_size_in_bytes (int, optional): max size of cache in bytes. Defaults to 2147483648.
        Returns:
            None
        """
        if deep_size_of_dict(SYSTEM_QUERY_RESULT_CACHE) > max_size_in_bytes:
            logger.debug("Clearing system cache")
            SYSTEM_QUERY_RESULT_CACHE.clear()

    def _validate_attrs(self, attr_list: List[str]) -> None:
        """Validate the necessary attributes given via add_props"""
        for attr in attr_list:
            if not hasattr(self, attr):
                raise AttributeError(
                    f"System requires a table to be set: add_props({attr}=...)(Metrics.SYSTEM.value)"
                )

    def sql(self, session: Session, **kwargs):
        raise NotImplementedError(
            "SQL method is not implemented for System metric. Use SystemMetricsComputer.get_system_metrics instead"
        )
