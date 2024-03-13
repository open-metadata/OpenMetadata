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
Factory class for creating sampler objects
"""

from typing import Union

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.profiler.processor.sampler.nosql.sampler import NoSQLSampler
from metadata.profiler.processor.sampler.pandas.sampler import DatalakeSampler
from metadata.profiler.processor.sampler.sqlalchemy.bigquery.sampler import (
    BigQuerySampler,
)
from metadata.profiler.processor.sampler.sqlalchemy.sampler import SQASampler
from metadata.profiler.processor.sampler.sqlalchemy.trino.sampler import TrinoSampler


class SamplerFactory:
    """Creational factory for sampler objects"""

    def __init__(self):
        self._sampler_type = {}

    def register(self, source_type: str, sampler_class):
        """Register a new source type"""
        self._sampler_type[source_type] = sampler_class

    def create(
        self, source_type: str, *args, **kwargs
    ) -> Union[SQASampler, DatalakeSampler]:
        """Create source object based on source type"""
        sampler_class = self._sampler_type.get(source_type)
        if not sampler_class:
            sampler_class = self._sampler_type[DatabaseConnection.__name__]
            return sampler_class(*args, **kwargs)
        return sampler_class(*args, **kwargs)


sampler_factory_ = SamplerFactory()
sampler_factory_.register(DatabaseConnection.__name__, SQASampler)
sampler_factory_.register(BigQueryConnection.__name__, BigQuerySampler)
sampler_factory_.register(DatalakeConnection.__name__, DatalakeSampler)
sampler_factory_.register(TrinoConnection.__name__, TrinoSampler)
sampler_factory_.register(MongoDBConnection.__name__, NoSQLSampler)
