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
Base source for the profiler used to instantiate a profiler runner with
its interface
"""
from copy import deepcopy
from typing import Optional, Type, cast

from metadata.generated.schema.configuration.profilerConfiguration import (
    ProfilerConfiguration,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.api.models import ProfilerProcessorConfig, TableConfig
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.processor.core import Profiler
from metadata.profiler.processor.default import DefaultProfiler, get_default_metrics
from metadata.profiler.registry import MetricRegistry
from metadata.profiler.source.database.base.profiler_resolver import ProfilerResolver
from metadata.profiler.source.profiler_source_interface import ProfilerSourceInterface
from metadata.sampler.config import (
    get_config_for_table,
    get_exclude_columns,
    get_include_columns,
)
from metadata.sampler.models import SampleConfig
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.dependency_injector.dependency_injector import (
    DependencyNotFoundError,
    Inject,
    inject,
)
from metadata.utils.logger import profiler_logger
from metadata.utils.profiler_utils import get_context_entities

logger = profiler_logger()


class ProfilerSource(ProfilerSourceInterface):
    """
    Base class for the profiler source
    """

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        database: Database,
        ometa_client: OpenMetadata,
        global_profiler_configuration: ProfilerConfiguration,
    ):
        self.config = config
        self.service_conn_config = self._copy_service_config(config, database)
        self.profiler_config = ProfilerProcessorConfig.model_validate(
            config.processor.model_dump().get("config")
        )
        self.ometa_client = ometa_client
        self._interface_type: str = config.source.type.lower()
        self._interface = None

        self.source_config = None
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

    def _copy_service_config(
        self, config: OpenMetadataWorkflowConfig, database: Database
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

    @inject
    def create_profiler_interface(
        self,
        entity: Table,
        config: Optional[TableConfig],
        schema_entity: DatabaseSchema,
        database_entity: Database,
        profiler_resolver: Inject[Type[ProfilerResolver]] = None,
    ) -> ProfilerInterface:
        """Create the appropriate profiler interface based on processing engine."""
        if profiler_resolver is None:
            raise DependencyNotFoundError(
                "ProfilerResolver dependency not found. Please ensure the ProfilerResolver is properly registered."
            )

        # NOTE: For some reason I do not understand, if we instantiate this on the __init__ method, we break the
        # autoclassification workflow. This should be fixed. There should not be an impact on AutoClassification.
        # We have an issue to track this here: https://github.com/open-metadata/OpenMetadata/issues/21790
        self.source_config = DatabaseServiceProfilerPipeline.model_validate(
            self.config.source.sourceConfig.config
        )

        sampler_class, profiler_class = profiler_resolver.resolve(
            processing_engine=self.get_processing_engine(self.source_config),
            service_type=ServiceType.Database,
            source_type=self._interface_type,
        )

        # This is shared between the sampler and profiler interfaces
        sampler_interface: SamplerInterface = sampler_class.create(
            service_connection_config=self.service_conn_config,
            ometa_client=self.ometa_client,
            entity=entity,
            schema_entity=schema_entity,
            database_entity=database_entity,
            table_config=config,
            default_sample_config=SampleConfig(
                profileSample=self.source_config.profileSample,
                profileSampleType=self.source_config.profileSampleType,
                samplingMethodType=self.source_config.samplingMethodType,
                randomizedSample=self.source_config.randomizedSample,
            ),
            # TODO: Change this when we have the processing engine configuration implemented. Right now it does nothing.
            processing_engine=self.get_processing_engine(self.source_config),
        )

        profiler_interface: ProfilerInterface = profiler_class.create(
            entity=entity,
            source_config=self.source_config,
            service_connection_config=self.service_conn_config,
            sampler=sampler_interface,
            ometa_client=self.ometa_client,
        )  # type: ignore

        self.interface = profiler_interface
        return self.interface

    @inject
    def get_profiler_runner(
        self,
        entity: Table,
        profiler_config: ProfilerProcessorConfig,
        metrics_registry: Inject[Type[MetricRegistry]] = None,
    ) -> Profiler:
        """
        Returns the runner for the profiler
        """
        if metrics_registry is None:
            raise DependencyNotFoundError(
                "MetricRegistry dependency not found. Please ensure the MetricRegistry is properly registered."
            )

        table_config = get_config_for_table(entity, profiler_config)
        schema_entity, database_entity, db_service = get_context_entities(
            entity=entity, metadata=self.ometa_client
        )
        profiler_interface = self.create_profiler_interface(
            entity, table_config, schema_entity, database_entity
        )

        if not profiler_config.profiler:
            return DefaultProfiler(
                profiler_interface=profiler_interface,
                metrics_registry=metrics_registry,
                include_columns=get_include_columns(entity, table_config),
                exclude_columns=get_exclude_columns(entity, table_config),
                global_profiler_configuration=self.global_profiler_configuration,
                db_service=db_service,
            )

        metrics = (
            [metrics_registry.get(name) for name in profiler_config.profiler.metrics]
            if profiler_config.profiler.metrics
            else get_default_metrics(
                metrics_registry=metrics_registry,
                table=profiler_interface.table,
                ometa_client=self.ometa_client,
                db_service=db_service,
            )
        )

        return Profiler(
            *metrics,  # type: ignore
            profiler_interface=profiler_interface,
            include_columns=get_include_columns(entity, table_config),
            exclude_columns=get_exclude_columns(entity, table_config),
            global_profiler_configuration=self.global_profiler_configuration,
        )
