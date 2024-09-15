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
Base source for the profiler used to instantiate a profiler runner with
its interface
"""
from copy import deepcopy
from typing import List, Optional, Tuple, cast

from sqlalchemy import MetaData

from metadata.generated.schema.configuration.profilerConfiguration import (
    ProfilerConfiguration,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import ColumnProfilerConfig, Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.api.models import ProfilerProcessorConfig, TableConfig
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.core import Profiler
from metadata.profiler.processor.default import DefaultProfiler, get_default_metrics
from metadata.profiler.source.profiler_source_interface import ProfilerSourceInterface

NON_SQA_DATABASE_CONNECTIONS = (DatalakeConnection,)


class ProfilerSource(ProfilerSourceInterface):
    """
    Base class for the profiler source
    """

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        database: DatabaseService,
        ometa_client: OpenMetadata,
        global_profiler_configuration: ProfilerConfiguration,
    ):
        self.service_conn_config = self._copy_service_config(config, database)
        self.source_config = config.source.sourceConfig.config
        self.source_config = cast(
            DatabaseServiceProfilerPipeline, self.source_config
        )  # satisfy type checker
        self.profiler_config = ProfilerProcessorConfig.model_validate(
            config.processor.model_dump().get("config")
        )
        self.ometa_client = ometa_client
        self.profiler_interface_type: str = self._get_profiler_interface_type(config)
        self.sqa_metadata = self._set_sqa_metadata()
        self._interface = None
        self.global_profiler_configuration = global_profiler_configuration

    @property
    def interface(
        self,
    ) -> Optional[ProfilerInterface]:
        """Get the interface"""
        return self._interface

    @interface.setter
    def interface(self, interface):
        """Set the interface"""
        self._interface = interface

    def _set_sqa_metadata(self):
        """Set sqlalchemy metadata"""
        if not isinstance(self.service_conn_config, NON_SQA_DATABASE_CONNECTIONS):
            return MetaData()
        return None

    def _get_profiler_interface_type(self, config) -> str:
        """_summary_

        Args:
            config (_type_): profiler config
        Returns:
            str:
        """
        if isinstance(self.service_conn_config, NON_SQA_DATABASE_CONNECTIONS):
            return self.service_conn_config.__class__.__name__
        return config.source.serviceConnection.root.config.__class__.__name__

    @staticmethod
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

    def _get_include_columns(
        self, entity, entity_config: Optional[TableConfig]
    ) -> Optional[List[ColumnProfilerConfig]]:
        """get included columns"""
        if entity_config and entity_config.columnConfig:
            return entity_config.columnConfig.includeColumns

        if entity.tableProfilerConfig:
            return entity.tableProfilerConfig.includeColumns

        return None

    def _get_exclude_columns(
        self, entity, entity_config: Optional[TableConfig]
    ) -> Optional[List[str]]:
        """get included columns"""
        if entity_config and entity_config.columnConfig:
            return entity_config.columnConfig.excludeColumns

        if entity.tableProfilerConfig:
            return entity.tableProfilerConfig.excludeColumns

        return None

    def _copy_service_config(
        self, config: OpenMetadataWorkflowConfig, database: DatabaseService
    ) -> DatabaseConnection:
        """Make a copy of the service config and update the database name

        Args:
            database (_type_): a database entity

        Returns:
            DatabaseService.__config__
        """
        config_copy = deepcopy(
            config.source.serviceConnection.root.config  # type: ignore
        )
        if hasattr(
            config_copy,  # type: ignore
            "supportsDatabase",
        ):
            if hasattr(config_copy, "database"):
                config_copy.database = database.name.root  # type: ignore
            if hasattr(config_copy, "catalog"):
                config_copy.catalog = database.name.root  # type: ignore

        # we know we'll only be working with DatabaseConnection, we cast the type to satisfy type checker
        config_copy = cast(DatabaseConnection, config_copy)

        return config_copy

    def create_profiler_interface(
        self,
        entity: Table,
        config: Optional[TableConfig],
        profiler_config: Optional[ProfilerProcessorConfig],
        schema_entity: Optional[DatabaseSchema],
        database_entity: Optional[Database],
        db_service: Optional[DatabaseService],
    ) -> ProfilerInterface:
        """Create sqlalchemy profiler interface"""
        from metadata.profiler.interface.profiler_interface_factory import (  # pylint: disable=import-outside-toplevel
            profiler_interface_factory,
        )

        profiler_interface: ProfilerInterface = profiler_interface_factory.create(
            self.profiler_interface_type,
            entity,
            schema_entity,
            database_entity,
            db_service,
            config,
            profiler_config,
            self.source_config,
            self.service_conn_config,
            self.ometa_client,
            sqa_metadata=self.sqa_metadata,
        )  # type: ignore

        self.interface = profiler_interface
        return self.interface

    def _get_context_entities(
        self, entity: Table
    ) -> Tuple[DatabaseSchema, Database, DatabaseService]:
        schema_entity = None
        database_entity = None
        db_service = None

        if entity.databaseSchema:
            schema_entity_list = self.ometa_client.es_search_from_fqn(
                entity_type=DatabaseSchema,
                fqn_search_string=entity.databaseSchema.fullyQualifiedName,
                fields="databaseSchemaProfilerConfig",
            )
            if schema_entity_list:
                schema_entity = schema_entity_list[0]

        if entity.database:
            database_entity_list = self.ometa_client.es_search_from_fqn(
                entity_type=Database,
                fqn_search_string=entity.database.fullyQualifiedName,
                fields="databaseProfilerConfig",
            )
            if database_entity_list:
                database_entity = database_entity_list[0]

        if entity.service:
            db_service_list = self.ometa_client.es_search_from_fqn(
                entity_type=DatabaseService,
                fqn_search_string=entity.service.fullyQualifiedName,
            )
            if db_service_list:
                db_service = db_service_list[0]

        return schema_entity, database_entity, db_service

    def get_profiler_runner(
        self, entity: Table, profiler_config: ProfilerProcessorConfig
    ) -> Profiler:
        """
        Returns the runner for the profiler
        """
        table_config = self.get_config_for_table(entity, profiler_config)
        schema_entity, database_entity, db_service = self._get_context_entities(
            entity=entity
        )
        profiler_interface = self.create_profiler_interface(
            entity,
            table_config,
            profiler_config,
            schema_entity,
            database_entity,
            db_service,
        )

        if not profiler_config.profiler:
            return DefaultProfiler(
                profiler_interface=profiler_interface,
                include_columns=self._get_include_columns(entity, table_config),
                exclude_columns=self._get_exclude_columns(entity, table_config),
                global_profiler_configuration=self.global_profiler_configuration,
                db_service=db_service,
            )

        metrics = (
            [Metrics.get(name) for name in profiler_config.profiler.metrics]
            if profiler_config.profiler.metrics
            else get_default_metrics(
                table=profiler_interface.table,
                ometa_client=self.ometa_client,
                db_service=db_service,
            )
        )

        return Profiler(
            *metrics,  # type: ignore
            profiler_interface=profiler_interface,
            include_columns=self._get_include_columns(entity, table_config),
            exclude_columns=self._get_exclude_columns(entity, table_config),
            global_profiler_configuration=self.global_profiler_configuration,
        )
