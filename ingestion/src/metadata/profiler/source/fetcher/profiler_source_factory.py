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
#  pylint: disable=import-outside-toplevel
"""
Factory class for creating profiler source objects
"""

from typing import Callable, Dict, Type

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigqueryType,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksType,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlType,
)
from metadata.profiler.source.profiler_source_interface import ProfilerSourceInterface


class ProfilerSourceFactory:
    """Creational factory for profiler source objects"""

    def __init__(self):
        self._source_type: Dict[str, Callable[[], Type[ProfilerSourceInterface]]] = {
            "base": self.base
        }

    def register_source(self, type_: str, source_fn):
        """Register a new source type"""
        self._source_type[type_] = source_fn

    def register_many_sources(
        self, source_dict: Dict[str, Callable[[], Type[ProfilerSourceInterface]]]
    ):
        """Register multiple source types at once"""
        for type_, source_fn in source_dict.items():
            self.register_source(type_, source_fn)

    def create(self, type_: str, *args, **kwargs) -> ProfilerSourceInterface:
        """Create source object based on source type"""
        source_fn = self._source_type.get(type_)
        if not source_fn:
            source_fn = self._source_type["base"]

        source_class = source_fn()
        return source_class(*args, **kwargs)

    @staticmethod
    def base() -> Type[ProfilerSourceInterface]:
        """Lazy loading of the base source"""
        from metadata.profiler.source.database.base.profiler_source import (
            ProfilerSource,
        )

        return ProfilerSource

    @staticmethod
    def bigquery() -> Type[ProfilerSourceInterface]:
        """Lazy loading of the BigQuery source"""
        from metadata.profiler.source.database.bigquery.profiler_source import (
            BigQueryProfilerSource,
        )

        return BigQueryProfilerSource

    @staticmethod
    def databricks() -> Type[ProfilerSourceInterface]:
        """Lazy loading of the Databricks source"""
        from metadata.profiler.source.database.databricks.profiler_source import (
            DataBricksProfilerSource,
        )

        return DataBricksProfilerSource

    @staticmethod
    def mssql() -> Type[ProfilerSourceInterface]:
        """Lazy loading of the MSSQL source"""
        from metadata.profiler.source.database.mssql.profiler_source import (
            MssqlProfilerSource,
        )

        return MssqlProfilerSource


source = {
    BigqueryType.BigQuery.value.lower(): ProfilerSourceFactory.bigquery,
    DatabricksType.Databricks.value.lower(): ProfilerSourceFactory.databricks,
    MssqlType.Mssql.value.lower(): ProfilerSourceFactory.mssql,
}

profiler_source_factory = ProfilerSourceFactory()
profiler_source_factory.register_many_sources(source)
