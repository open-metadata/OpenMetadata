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
Sampler configuration helpers
"""
from typing import Any, Dict, List, Optional, Union

from metadata.generated.schema.entity.data.database import (
    Database,
    DatabaseProfilerConfig,
)
from metadata.generated.schema.entity.data.databaseSchema import (
    DatabaseSchema,
    DatabaseSchemaProfilerConfig,
)
from metadata.generated.schema.entity.data.table import ColumnProfilerConfig, Table
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    DataStorageConfig,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.profiler.api.models import ProfilerProcessorConfig
from metadata.profiler.config import (
    get_database_profiler_config,
    get_schema_profiler_config,
)
from metadata.sampler.models import DatabaseAndSchemaConfig, SampleConfig, TableConfig


def get_sample_storage_config(
    config: Union[
        DatabaseSchemaProfilerConfig,
        DatabaseProfilerConfig,
        DatabaseAndSchemaConfig,
    ],
) -> Optional[Union[DataStorageConfig, Dict[str, Any]]]:
    """Get sample storage config"""
    if (
        config
        and config.sampleDataStorageConfig
        and config.sampleDataStorageConfig.config
    ):
        return config.sampleDataStorageConfig.config
    return None


def get_storage_config_for_table(
    entity: Table,
    schema_entity: DatabaseSchema,
    database_entity: Database,
    db_service: Optional[DatabaseService],
    profiler_config: ProfilerProcessorConfig,
) -> Optional[Union[DataStorageConfig, Dict[str, Any]]]:
    """Get storage config for a specific entity"""
    schema_profiler_config = get_schema_profiler_config(schema_entity=schema_entity)
    database_profiler_config = get_database_profiler_config(
        database_entity=database_entity
    )

    for schema_config in profiler_config.schemaConfig or []:
        if (
            entity.databaseSchema
            and schema_config.fullyQualifiedName.root
            == entity.databaseSchema.fullyQualifiedName
            and get_sample_storage_config(schema_config)
        ):
            return get_sample_storage_config(schema_config)

    for database_config in profiler_config.databaseConfig or []:
        if (
            entity.database
            and database_config.fullyQualifiedName.root
            == entity.database.fullyQualifiedName
            and get_sample_storage_config(database_config)
        ):
            return get_sample_storage_config(database_config)

    if schema_profiler_config and get_sample_storage_config(schema_profiler_config):
        return get_sample_storage_config(schema_profiler_config)

    if database_profiler_config and get_sample_storage_config(database_profiler_config):
        return get_sample_storage_config(database_profiler_config)

    try:
        return db_service.connection.config.sampleDataStorageConfig.config
    except AttributeError:
        pass

    return None


def get_profile_sample_config(
    entity: Table,
    schema_entity: Optional[DatabaseSchema],
    database_entity: Optional[Database],
    entity_config: Optional[Union[TableConfig, DatabaseAndSchemaConfig]],
    default_sample_config: Optional[SampleConfig],
) -> SampleConfig:
    """Get profile sample config for a specific entity"""
    schema_profiler_config = get_schema_profiler_config(schema_entity=schema_entity)
    database_profiler_config = get_database_profiler_config(
        database_entity=database_entity
    )

    for config in (
        entity_config,
        entity.tableProfilerConfig,
        schema_profiler_config,
        database_profiler_config,
        default_sample_config,
    ):
        try:
            if config and config.profileSample:
                return SampleConfig(
                    profileSample=config.profileSample,
                    profileSampleType=config.profileSampleType,
                    samplingMethodType=config.samplingMethodType,
                )
        except AttributeError:
            pass

    return SampleConfig()


def get_sample_query(
    entity: Table, entity_config: Optional[TableConfig]
) -> Optional[str]:
    """get profile query for sampling

    Args:
        entity (Table): table entity object
        entity_config (Optional[TableConfig]): entity configuration

    Returns:
        Optional[str]:
    """
    if entity_config:
        return entity_config.profileQuery

    if entity.tableProfilerConfig:
        return entity.tableProfilerConfig.profileQuery

    return None


def get_sample_data_count_config(
    entity: Table,
    schema_entity: Optional[DatabaseSchema],
    database_entity: Optional[Database],
    entity_config: Optional[TableConfig],
    default_sample_data_count: int,
) -> Optional[int]:
    """_summary_
    Args:
        entity_config (Optional[TableConfig]): table config object from yaml/json file
        source_config DatabaseServiceProfilerPipeline: profiler pipeline details
    Returns:
        Optional[int]: int
    """
    schema_profiler_config = get_schema_profiler_config(schema_entity=schema_entity)
    database_profiler_config = get_database_profiler_config(
        database_entity=database_entity
    )

    for config in (
        entity_config,
        entity.tableProfilerConfig,
        schema_profiler_config,
        database_profiler_config,
    ):
        if config and config.sampleDataCount:
            return config.sampleDataCount

    return default_sample_data_count


def get_config_for_table(entity: Table, profiler_config) -> Optional[TableConfig]:
    """Get config for a specific entity

    Args:
        entity: table entity
    """
    for table_config in profiler_config.tableConfig or []:
        if table_config.fullyQualifiedName.root == entity.fullyQualifiedName.root:
            return table_config

    for schema_config in profiler_config.schemaConfig or []:
        if (
            schema_config.fullyQualifiedName.root
            == entity.databaseSchema.fullyQualifiedName
        ):
            return TableConfig.from_database_and_schema_config(
                schema_config, entity.fullyQualifiedName.root
            )
    for database_config in profiler_config.databaseConfig or []:
        if (
            database_config.fullyQualifiedName.root
            == entity.database.fullyQualifiedName
        ):
            return TableConfig.from_database_and_schema_config(
                database_config, entity.fullyQualifiedName.root
            )

    return None


def get_include_columns(
    entity, entity_config: Optional[TableConfig]
) -> Optional[List[ColumnProfilerConfig]]:
    """get included columns"""
    if entity_config and entity_config.columnConfig:
        return entity_config.columnConfig.includeColumns

    if entity.tableProfilerConfig:
        return entity.tableProfilerConfig.includeColumns

    return None


def get_exclude_columns(
    entity, entity_config: Optional[TableConfig]
) -> Optional[List[str]]:
    """get included columns"""
    if entity_config and entity_config.columnConfig:
        return entity_config.columnConfig.excludeColumns

    if entity.tableProfilerConfig:
        return entity.tableProfilerConfig.excludeColumns

    return None
