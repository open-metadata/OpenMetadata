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

from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class DB2ProfilerInterface(SQAProfilerInterface):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    def _programming_error_static_metric(self, runner, column, exc, session, metrics):
        # pylint: disable=protected-access
        if exc.orig and "overflow" in exc.orig._message:
            logger.info(
                f"Computing metrics without sum for {runner.table_name}.{column.name}"
            )
            return self._compute_static_metrics_wo_sum(metrics, runner, session, column)
        return None
