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
Profiler for Snowflake
"""
from metadata.ingestion.source.database.snowflake.profiler.system import (
    SnowflakeSystemMetricsComputer,
)
from metadata.profiler.interface.sqlalchemy.snowflake.profiler_interface import (
    SnowflakeProfilerInterface,
)
from metadata.profiler.metrics.system.system import SystemMetricsComputer


class SnowflakeProfiler(SnowflakeProfilerInterface):
    def initialize_system_metrics_computer(self) -> SystemMetricsComputer:
        return SnowflakeSystemMetricsComputer(session=self.session)
