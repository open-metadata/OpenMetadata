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
Profiler configuration helpers
"""
from typing import Optional

from metadata.generated.schema.entity.data.database import (
    Database,
    DatabaseProfilerConfig,
)
from metadata.generated.schema.entity.data.databaseSchema import (
    DatabaseSchema,
    DatabaseSchemaProfilerConfig,
)


def get_database_profiler_config(
    database_entity: Optional[Database],
) -> Optional[DatabaseProfilerConfig]:
    if database_entity and database_entity.databaseProfilerConfig:
        return database_entity.databaseProfilerConfig
    return None


def get_schema_profiler_config(
    schema_entity: Optional[DatabaseSchema],
) -> Optional[DatabaseSchemaProfilerConfig]:
    if schema_entity and schema_entity.databaseSchemaProfilerConfig:
        return schema_entity.databaseSchemaProfilerConfig
    return None
