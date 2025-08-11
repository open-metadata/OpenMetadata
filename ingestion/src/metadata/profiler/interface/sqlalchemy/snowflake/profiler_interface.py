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

from typing import List, Type, cast

from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    OVERFLOW_ERROR_CODES,
    SQAProfilerInterface,
)
from metadata.profiler.metrics.system.snowflake.system import (
    SnowflakeSystemMetricsComputer,
)
from metadata.profiler.metrics.system.system import System
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class SnowflakeProfilerInterface(SQAProfilerInterface):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def create_session(self):
        super().create_session()
        self.set_session_tag(self.session)

    def _compute_system_metrics(
        self, metrics: Type[System], runner: QueryRunner, *args, **kwargs
    ) -> List[SystemProfile]:
        self.system_metrics_class = cast(
            Type[SnowflakeSystemMetricsComputer], self.system_metrics_class
        )
        instance = self.system_metrics_class(
            session=self.session,
            runner=runner,
        )
        return instance.get_system_metrics()

    def _programming_error_static_metric(self, runner, column, exc, session, metrics):
        if exc.orig and exc.orig.errno in OVERFLOW_ERROR_CODES.get(
            session.bind.dialect.name
        ):
            logger.info(
                f"Computing metrics without sum for {runner.table_name}.{column.name}"
            )
            return self._compute_static_metrics_wo_sum(metrics, runner, session, column)
        return None
