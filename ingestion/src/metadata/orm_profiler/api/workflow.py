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
Workflow definition for the ORM Profiler.

- How to specify the source
- How to specify the entities to run
- How to define metrics & tests
"""
import traceback
from copy import deepcopy
from typing import Iterable, List, Optional, cast

from pydantic import ValidationError
from sqlalchemy import MetaData

from metadata.config.common import WorkflowExecutionError
from metadata.config.workflow import get_sink
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    ColumnProfilerConfig,
    PartitionProfilerConfig,
    Table,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.processor import ProcessorStatus
from metadata.ingestion.api.sink import Sink
from metadata.ingestion.models.custom_types import ServiceWithConnectionType
from metadata.ingestion.ometa.client_utils import create_ometa_client
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import SQLSourceStatus
from metadata.interfaces.datalake.datalake_profiler_interface import (
    DataLakeProfilerInterface,
)
from metadata.interfaces.profiler_protocol import (
    ProfilerInterfaceArgs,
    ProfilerProtocol,
)
from metadata.interfaces.sqalchemy.sqa_profiler_interface import SQAProfilerInterface
from metadata.orm_profiler.api.models import (
    ProfilerProcessorConfig,
    ProfilerResponse,
    TableConfig,
)
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.core import Profiler
from metadata.orm_profiler.profiler.default import DefaultProfiler, get_default_metrics
from metadata.utils import fqn
from metadata.utils.class_helper import (
    get_service_class_from_service_type,
    get_service_type_from_source_type,
)
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.logger import profiler_logger
from metadata.utils.partition import get_partition_details
from metadata.utils.workflow_helper import (
    set_ingestion_pipeline_status as set_ingestion_pipeline_status_helper,
)
from metadata.utils.workflow_output_handler import print_profiler_status

logger = profiler_logger()


class ProfilerInterfaceInstantiationError(Exception):
    """Raise when interface cannot be instantiated"""


class ProfilerWorkflow:
    """
    Configure and run the ORM profiler
    """

    config: OpenMetadataWorkflowConfig
    sink: Sink
    metadata: OpenMetadata

    def __init__(self, config: OpenMetadataWorkflowConfig):
        self.profiler_obj = None  # defined in `create_profiler_obj()``
        self.config = config
        self.metadata_config: OpenMetadataConnection = (
            self.config.workflowConfig.openMetadataServerConfig
        )
        self.profiler_config = ProfilerProcessorConfig.parse_obj(
            self.config.processor.dict().get("config")
        )
        self.metadata = OpenMetadata(self.metadata_config)
        self._retrieve_service_connection_if_needed()
        self.set_ingestion_pipeline_status(state=PipelineState.running)
        # Init and type the source config
        self.source_config: DatabaseServiceProfilerPipeline = cast(
            DatabaseServiceProfilerPipeline, self.config.source.sourceConfig.config
        )  # Used to satisfy type checked
        self.source_status = SQLSourceStatus()
        self.status = ProcessorStatus()
        self._profiler_interface_args = None
        if self.config.sink:
            self.sink = get_sink(
                sink_type=self.config.sink.type,
                sink_config=self.config.sink,
                metadata_config=self.metadata_config,
                _from="orm_profiler",
            )

        if not self._validate_service_name():
            raise ValueError(
                f"Service name `{self.config.source.serviceName}` does not exist. "
                "Make sure you have run the ingestion for the service specified in the profiler workflow. "
                "If so, make sure the profiler service name matches the service name specified during ingestion."
            )
        self._table_entity = None

    @classmethod
    def create(cls, config_dict: dict) -> "ProfilerWorkflow":
        """
        Parse a JSON (dict) and create the workflow
        """
        try:
            config = parse_workflow_config_gracefully(config_dict)
            return cls(config)
        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error trying to parse the Profiler Workflow configuration: {err}"
            )
            raise err

    def get_config_for_entity(self, entity: Table) -> Optional[TableConfig]:
        """Get config for a specific entity

        Args:
            entity: table entity
        """

        if not self.profiler_config.tableConfig:
            return None
        return next(
            (
                table_config
                for table_config in self.profiler_config.tableConfig
                if table_config.fullyQualifiedName.__root__
                == entity.fullyQualifiedName.__root__  # type: ignore
            ),
            None,
        )

    def get_include_columns(self, entity) -> Optional[List[ColumnProfilerConfig]]:
        """get included columns"""
        entity_config: Optional[TableConfig] = self.get_config_for_entity(entity)
        if entity_config and entity_config.columnConfig:
            return entity_config.columnConfig.includeColumns

        if entity.tableProfilerConfig:
            return entity.tableProfilerConfig.includeColumns

        return None

    def get_exclude_columns(self, entity) -> Optional[List[str]]:
        """get included columns"""
        entity_config: Optional[TableConfig] = self.get_config_for_entity(entity)
        if entity_config and entity_config.columnConfig:
            return entity_config.columnConfig.excludeColumns

        if entity.tableProfilerConfig:
            return entity.tableProfilerConfig.excludeColumns

        return None

    def get_profile_sample(self, entity: Table) -> Optional[float]:
        """Get profile sample

        Args:
            entity: table entity
        """
        entity_config: Optional[TableConfig] = self.get_config_for_entity(entity)
        if entity_config:
            return entity_config.profileSample

        if entity.tableProfilerConfig:
            return entity.tableProfilerConfig.profileSample

        if self.source_config.profileSample:
            return self.source_config.profileSample

        return None

    def get_profile_query(self, entity: Table) -> Optional[str]:
        """Get profile sample

        Args:
            entity: table entity
        """
        entity_config: Optional[TableConfig] = self.get_config_for_entity(entity)
        if entity_config:
            return entity_config.profileQuery

        if entity.tableProfilerConfig:
            return entity.tableProfilerConfig.profileQuery

        return None

    def get_partition_details(self, entity: Table) -> Optional[PartitionProfilerConfig]:
        """Get partition details

        Args:
            entity: table entity
        """
        entity_config: Optional[TableConfig] = self.get_config_for_entity(entity)

        if entity_config:  # check if a yaml config was pass with partition definition
            return entity_config.partitionConfig

        return get_partition_details(entity)

    def create_profiler_interface(
        self,
        service_connection_config,
        table_entity: Table,
        sqa_metadata_obj,
    ):
        """Creates a profiler interface object"""
        try:

            self._table_entity = table_entity
            self._profiler_interface_args = ProfilerInterfaceArgs(
                service_connection_config=service_connection_config,
                sqa_metadata_obj=sqa_metadata_obj,
                ometa_client=create_ometa_client(self.metadata_config),
                thread_count=self.source_config.threadCount,
                table_entity=self._table_entity,
                table_sample_precentage=self.get_profile_sample(self._table_entity)
                if not self.get_profile_query(self._table_entity)
                else None,
                table_sample_query=self.get_profile_query(self._table_entity)
                if not self.get_profile_sample(self._table_entity)
                else None,
                table_partition_config=self.get_partition_details(self._table_entity)
                if not self.get_profile_query(self._table_entity)
                else None,
            )
            if isinstance(service_connection_config, DatalakeConnection):
                return DataLakeProfilerInterface(self._profiler_interface_args)
            return SQAProfilerInterface(self._profiler_interface_args)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error("We could not create a profiler interface")
            raise ProfilerInterfaceInstantiationError(exc)

    def create_profiler_obj(
        self, table_entity: Table, profiler_interface: ProfilerProtocol
    ):
        """Profile a single entity"""
        if not self.profiler_config.profiler:
            self.profiler_obj = DefaultProfiler(
                profiler_interface=profiler_interface,
                include_columns=self.get_include_columns(table_entity),
                exclude_columns=self.get_exclude_columns(table_entity),
            )
        else:
            metrics = (
                [Metrics.get(name) for name in self.profiler_config.profiler.metrics]
                if self.profiler_config.profiler.metrics
                else get_default_metrics(profiler_interface.table)
            )

            self.profiler_obj = Profiler(
                *metrics,  # type: ignore
                profiler_interface=profiler_interface,
                include_columns=self.get_include_columns(table_entity),
                exclude_columns=self.get_exclude_columns(table_entity),
            )

    def filter_databases(self, database: Database) -> Optional[Database]:
        """Returns filtered database entities"""
        if filter_by_database(
            self.source_config.databaseFilterPattern,
            database.name.__root__,
        ):
            self.source_status.filter(
                database.name.__root__, "Database pattern not allowed"
            )
            return None
        return database

    def filter_entities(self, tables: Iterable[Table]) -> Iterable[Table]:
        """
        From a list of tables, apply the SQLSourceConfig
        filter patterns.

        We will update the status on the SQLSource Status.
        """
        for table in tables:
            try:
                if filter_by_schema(
                    self.source_config.schemaFilterPattern,
                    table.databaseSchema.name,  # type: ignore
                ):
                    self.source_status.filter(
                        f"Schema pattern not allowed: {table.fullyQualifiedName.__root__}",  # type: ignore
                        "Schema pattern not allowed",
                    )
                    continue
                if filter_by_table(
                    self.source_config.tableFilterPattern,
                    table.name.__root__,
                ):
                    self.source_status.filter(
                        f"Table pattern not allowed: {table.fullyQualifiedName.__root__}",  # type: ignore
                        "Table pattern not allowed",
                    )
                    continue

                yield table
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(
                    "Unexpected error filtering entities for table "
                    f"[{table.fullyQualifiedName.__root__}]: {exc}"  # type: ignore
                )
                self.source_status.failure(table.fullyQualifiedName.__root__, f"{exc}")  # type: ignore

    def get_database_entities(self):
        """List all databases in service"""

        return [
            self.filter_databases(database)
            for database in self.metadata.list_all_entities(
                entity=Database,
                params={"service": self.config.source.serviceName},
            )
            if self.filter_databases(database)
        ]

    def get_table_entities(self, database):
        """
        List and filter OpenMetadata tables based on the
        source configuration.

        The listing will be based on the entities from the
        informed service name in the source configuration.

        Note that users can specify `table_filter_pattern` to
        either be `includes` or `excludes`. This means
        that we will either what is specified in `includes`
        or we will use everything but the tables excluded.

        Same with `schema_filter_pattern`.
        """
        all_tables = self.metadata.list_all_entities(
            entity=Table,
            fields=[
                "tableProfilerConfig",
                "tests",
            ],
            params={
                "service": self.config.source.serviceName,
                "database": fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.config.source.serviceName,
                    database_name=database.name.__root__,
                ),
            },  # type: ignore
        )

        yield from self.filter_entities(all_tables)

    def copy_service_config(self, database) -> DatabaseService.__config__:
        copy_service_connection_config = deepcopy(
            self.config.source.serviceConnection.__root__.config  # type: ignore
        )
        if hasattr(
            self.config.source.serviceConnection.__root__.config,  # type: ignore
            "supportsDatabase",
        ):
            if hasattr(copy_service_connection_config, "database"):
                copy_service_connection_config.database = database.name.__root__  # type: ignore
            if hasattr(copy_service_connection_config, "catalog"):
                copy_service_connection_config.catalog = database.name.__root__  # type: ignore

        # we know we'll only be working with databaseServices, we cast the type to satisfy type checker
        copy_service_connection_config = cast(
            DatabaseService.__config__, copy_service_connection_config
        )

        return copy_service_connection_config

    def execute(self):
        """
        Run the profiling and tests
        """

        databases = self.get_database_entities()

        if not databases:
            raise ValueError(
                "databaseFilterPattern returned 0 result. At least 1 database must be returned by the filter pattern."
                f"\n\t- includes: {self.source_config.databaseFilterPattern.includes if self.source_config.databaseFilterPattern else None}"  # pylint: disable=line-too-long
                f"\n\t- excludes: {self.source_config.databaseFilterPattern.excludes if self.source_config.databaseFilterPattern else None}"  # pylint: disable=line-too-long
            )

        for database in databases:
            copied_service_config = self.copy_service_config(database)
            try:
                sqa_metadata_obj = MetaData()
                for entity in self.get_table_entities(database=database):
                    try:
                        profiler_interface = self.create_profiler_interface(
                            sqa_metadata_obj=sqa_metadata_obj,
                            service_connection_config=copied_service_config,
                            table_entity=entity,
                        )
                        self.create_profiler_obj(entity, profiler_interface)
                        profile: ProfilerResponse = self.profiler_obj.process(
                            self.source_config.generateSampleData
                        )
                        profiler_interface.close()
                        if hasattr(self, "sink"):
                            self.sink.write_record(profile)
                        self.status.failures.extend(
                            profiler_interface.processor_status.failures
                        )  # we can have column level failures we need to report
                        self.status.processed(entity.fullyQualifiedName.__root__)  # type: ignore
                        self.source_status.scanned(entity.fullyQualifiedName.__root__)  # type: ignore
                    except Exception as exc:  # pylint: disable=broad-except
                        logger.debug(traceback.format_exc())
                        logger.warning(
                            "Unexpected exception processing entity "
                            f"[{entity.fullyQualifiedName.__root__}]: {exc}"  # type: ignore
                        )
                        self.status.failures.extend(
                            profiler_interface.processor_status.failures  # type: ignore
                        )
                        self.source_status.failure(
                            entity.fullyQualifiedName.__root__, f"{exc}"  # type: ignore
                        )
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Unexpected exception executing in database [{database}]: {exc}"
                )

    def print_status(self) -> None:
        """
        Print the workflow results with click
        """
        print_profiler_status(self)

    def result_status(self) -> int:
        """
        Returns 1 if status is failed, 0 otherwise.
        """
        if (
            self.source_status.failures
            or self.status.failures
            or (hasattr(self, "sink") and self.sink.get_status().failures)
        ):
            return 1
        return 0

    def raise_from_status(self, raise_warnings=False):
        """
        Check source, processor and sink status and raise if needed

        Our profiler source will never log any failure, only filters,
        as we are just picking up data from OM.
        """

        if self.status.failures:
            raise WorkflowExecutionError("Processor reported errors", self.status)
        if hasattr(self, "sink") and self.sink.get_status().failures:
            raise WorkflowExecutionError("Sink reported errors", self.sink.get_status())

        if raise_warnings:
            if self.source_status.warnings:
                raise WorkflowExecutionError(
                    "Source reported warnings", self.source_status
                )
            if self.status.warnings:
                raise WorkflowExecutionError("Processor reported warnings", self.status)
            if hasattr(self, "sink") and self.sink.get_status().warnings:
                raise WorkflowExecutionError(
                    "Sink reported warnings", self.sink.get_status()
                )

    def _validate_service_name(self):
        """Validate service name exists in OpenMetadata"""
        return self.metadata.get_by_name(
            entity=DatabaseService, fqn=self.config.source.serviceName
        )

    def stop(self):
        """
        Close all connections
        """
        self.set_ingestion_pipeline_status(PipelineState.success)
        self.metadata.close()

    def _retrieve_service_connection_if_needed(self) -> None:
        """
        We override the current `serviceConnection` source config object if source workflow service already exists
        in OM. When it is configured, we retrieve the service connection from the secrets' manager. Otherwise, we get it
        from the service object itself through the default `SecretsManager`.

        :return:
        """
        service_type: ServiceType = get_service_type_from_source_type(
            self.config.source.type
        )
        if self.config.source.serviceConnection:
            service_name = self.config.source.serviceName
            try:
                service: ServiceWithConnectionType = cast(
                    ServiceWithConnectionType,
                    self.metadata.get_by_name(
                        get_service_class_from_service_type(service_type),
                        service_name,
                    ),
                )
                if service:
                    self.config.source.serviceConnection = ServiceConnection(
                        __root__=service.connection
                    )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error getting service connection for service name [{service_name}]"
                    f" using the secrets manager provider [{self.metadata.config.secretsManagerProvider}]: {exc}"
                )

    def set_ingestion_pipeline_status(self, state: PipelineState):
        """
        Method to set the pipeline status of current ingestion pipeline
        """
        pipeline_run_id = set_ingestion_pipeline_status_helper(
            state=state,
            ingestion_pipeline_fqn=self.config.ingestionPipelineFQN,
            pipeline_run_id=self.config.pipelineRunId,
            metadata=self.metadata,
        )
        self.config.pipelineRunId = pipeline_run_id
