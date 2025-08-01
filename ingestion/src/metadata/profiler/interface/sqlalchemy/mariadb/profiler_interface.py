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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""

from typing import List

from sqlalchemy.exc import ProgrammingError

from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
    handle_query_exception,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.runner import QueryRunner
from metadata.profiler.source.database.mariadb.metrics.window.first_quartile import (
    MariaDBFirstQuartile,
)
from metadata.profiler.source.database.mariadb.metrics.window.median import (
    MariaDBMedian,
)
from metadata.profiler.source.database.mariadb.metrics.window.third_quartile import (
    MariaDBThirdQuartile,
)
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class MariaDBProfilerInterface(SQAProfilerInterface):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    def _compute_window_metrics(
        self,
        metrics: List[Metrics],
        runner: QueryRunner,
        *args,
        **kwargs,
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        session = kwargs.get("session")
        column = kwargs.get("column")

        if not metrics:
            return None

        try:
            # we patch the metrics at runtime to use the MariaDB specific functions
            # as we can't compile the query based on the dialect as it return `mysql`
            metrics = [MariaDBFirstQuartile, MariaDBMedian, MariaDBThirdQuartile]  # type: ignore
            row = runner.select_first_from_sample(
                *[metric(column).fn() for metric in metrics],
            )
            if row:
                return dict(row)
        except ProgrammingError:
            logger.info(
                f"Skipping window metrics for {runner.table_name}.{column.name} due to overflow"
            )
            return None

        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table_name}.{column.name}: {exc}"
            handle_query_exception(msg, exc, session)
        return None
