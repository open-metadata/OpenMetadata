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
from typing import Union, Optional

from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import DatabaseServiceProfilerPipeline

from metadata.generated.schema.entity.data.table import Table, PartitionProfilerConfig

from metadata.generated.schema.entity.services.databaseService import DatabaseService

from metadata.generated.schema.entity.services.connections.connectionBasicType import DataStorageConfig

from metadata.generated.schema.entity.data.database import DatabaseProfilerConfig

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchemaProfilerConfig
from metadata.profiler.api.models import DatabaseAndSchemaConfig, ProfilerProcessorConfig, ProfileSampleConfig
from metadata.sampler.models import TableConfig


def get_sample_storage_config(
        config: Union[
            DatabaseSchemaProfilerConfig,
            DatabaseProfilerConfig,
            DatabaseAndSchemaConfig,
        ],
) -> Optional[DataStorageConfig]:
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
        schema_profiler_config: Optional[DatabaseSchemaProfilerConfig],
        database_profiler_config: Optional[DatabaseProfilerConfig],
        db_service: Optional[DatabaseService],
        profiler_config: ProfilerProcessorConfig,
) -> Optional[DataStorageConfig]:
    """Get storage config for a specific entity"""
    for schema_config in profiler_config.schemaConfig:
        if (
                schema_config.fullyQualifiedName.root
                == entity.databaseSchema.fullyQualifiedName
                and get_sample_storage_config(schema_config)
        ):
            return get_sample_storage_config(schema_config)

    for database_config in profiler_config.databaseConfig:
        if (
                database_config.fullyQualifiedName.root
                == entity.database.fullyQualifiedName
                and get_sample_storage_config(database_config)
        ):
            return get_sample_storage_config(database_config)

    if get_sample_storage_config(schema_profiler_config):
        return get_sample_storage_config(schema_profiler_config)

    if get_sample_storage_config(database_profiler_config):
        return get_sample_storage_config(
            database_profiler_config
        )

    try:
        return db_service.connection.config.sampleDataStorageConfig.config
    except AttributeError:
        pass

    return None


def get_profile_sample_config(
        entity: Table,
        schema_profiler_config: Optional[DatabaseSchemaProfilerConfig],
        database_profiler_config: Optional[DatabaseProfilerConfig],
        entity_config: Optional[Union[TableConfig, DatabaseAndSchemaConfig]],
        source_config: DatabaseServiceProfilerPipeline,
) -> Optional[ProfileSampleConfig]:
    """Get profile sample config for a specific entity"""
    for config in (
            entity_config,
            entity.tableProfilerConfig,
            schema_profiler_config,
            database_profiler_config,
            source_config,
    ):
        try:
            if config and config.profileSample:
                return ProfileSampleConfig(
                    profile_sample=config.profileSample,
                    profile_sample_type=config.profileSampleType,
                    sampling_method_type=config.samplingMethodType,
                )
        except AttributeError:
            pass

    return None


def get_partition_details(
        entity: Table,
        entity_config: Optional[TableConfig] = None,
) -> Optional[PartitionProfilerConfig]:
    """_summary_

    Args:
        entity (Table): table entity object
        entity_config (Optional[TableConfig]): entity configuration

    Returns:
        Optional[PartitionProfilerConfig]:
    """
    if entity_config:
        return entity_config.partitionConfig

    return get_partition_details(entity)


def get_profile_query(
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
    schema_profiler_config: Optional[DatabaseSchemaProfilerConfig],
    database_profiler_config: Optional[DatabaseProfilerConfig],
    entity_config: Optional[TableConfig],
    source_config: DatabaseServiceProfilerPipeline,
) -> Optional[int]:
    """_summary_
    Args:
        entity_config (Optional[TableConfig]): table config object from yaml/json file
        source_config DatabaseServiceProfilerPipeline: profiler pipeline details
    Returns:
        Optional[int]: int
    """

    for config in (
        entity_config,
        entity.tableProfilerConfig,
        schema_profiler_config,
        database_profiler_config,
    ):
        if config and config.sampleDataCount:
            return config.sampleDataCount

    return source_config.sampleDataCount
