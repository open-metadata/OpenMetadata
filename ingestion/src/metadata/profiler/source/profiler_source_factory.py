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
Factory class for creating profiler source objects
"""

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigqueryType,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksType,
)
from metadata.profiler.source.base.profiler_source import ProfilerSource
from metadata.profiler.source.bigquery.profiler_source import BigQueryProfilerSource
from metadata.profiler.source.databricks.profiler_source import DataBricksProfilerSource


class ProfilerSourceFactory:
    """Creational factory for profiler source objects"""

    def __init__(self):
        self._source_type = {"base": ProfilerSource}

    def register_source(self, source_type: str, source_class):
        """Register a new source type"""
        self._source_type[source_type] = source_class

    def create(self, source_type: str, *args, **kwargs) -> ProfilerSource:
        """Create source object based on source type"""
        source_class = self._source_type.get(source_type)
        if not source_class:
            source_class = self._source_type["base"]
            return source_class(*args, **kwargs)
        return source_class(*args, **kwargs)


profiler_source_factory = ProfilerSourceFactory()
profiler_source_factory.register_source(
    BigqueryType.BigQuery.value.lower(),
    BigQueryProfilerSource,
)
profiler_source_factory.register_source(
    DatabricksType.Databricks.value.lower(),
    DataBricksProfilerSource,
)
