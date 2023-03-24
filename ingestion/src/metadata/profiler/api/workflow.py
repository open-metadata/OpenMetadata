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
from typing import Iterable, List, Optional, Tuple, Union, cast

from pydantic import ValidationError
from sqlalchemy import MetaData

from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import ColumnProfilerConfig, Table
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
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.models.custom_types import ServiceWithConnectionType
from metadata.ingestion.ometa.client_utils import create_ometa_client
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.profiler.api.models import (
    ProfilerProcessorConfig,
    ProfilerResponse,
    TableConfig,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.profiler.core import Profiler
from metadata.profiler.profiler.default import DefaultProfiler, get_default_metrics
from metadata.profiler.profiler.interface.pandas.pandas_profiler_interface import (
    PandasProfilerInterface,
)
from metadata.profiler.profiler.interface.profiler_protocol import ProfilerProtocol
from metadata.profiler.profiler.interface.sqlalchemy.sqa_profiler_interface import (
    SQAProfilerInterface,
)
from metadata.utils import fqn
from metadata.utils.class_helper import (
    get_service_class_from_service_type,
    get_service_type_from_source_type,
)
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.importer import get_sink
from metadata.utils.logger import profiler_logger
from metadata.utils.workflow_output_handler import print_profiler_status
from metadata.workflow.workflow_status_mixin import WorkflowStatusMixin

logger = profiler_logger()

NON_SQA_DATABASE_CONNECTIONS = (DatalakeConnection,)


class ProfilerInterfaceInstantiationError(Exception):
    """Raise when interface cannot be instantiated"""


class ProfilerWorkflow(WorkflowStatusMixin):
    """
    Configure and run the ORM profiler
    """

    config: OpenMetadataWorkflowConfig
    sink: Sink
    metadata: OpenMetadata

    def __init__(self, config: OpenMetadataWorkflowConfig):
        self.profiler = None  # defined in `create_profiler()``
        self.config = config
        self.metadata_config: OpenMetadataConnection = (
            self.config.workflowConfig.openMetadataServerConfig
        )
        self.profiler_config = ProfilerProcessorConfig.parse_obj(
            self.config.processor.dict().get("config")
        )
        self.metadata = OpenMetadata(self.metadata_config)
        self._retrieve_service_connection_if_needed()
        self.test_connection()
        self.set_ingestion_pipeline_status(state=PipelineState.running)
        # Init and type the source config
        self.source_config: DatabaseServiceProfilerPipeline = cast(
            DatabaseServiceProfilerPipeline, self.config.source.sourceConfig.config
        )  # Used to satisfy type checked
        self.source_status = SourceStatus()
        self.status = ProcessorStatus()
        self._profiler_interface_args = None
        if self.config.sink:
            self.sink = get_sink(
                sink_type=self.config.sink.type,
                sink_config=self.config.sink,
                metadata_config=self.metadata_config,
                from_="profiler",
            )

        if not self._validate_service_name():
            raise ValueError(
                f"Service name `{self.config.source.serviceName}` does not exist. "
                "Make sure you have run the ingestion for the service specified in the profiler workflow. "
                "If so, make sure the profiler service name matches the service name specified during ingestion "
                "and that your ingestion token (settings > bots) is still valid."
            )

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

    def create_profiler(
        self, table_entity: Table, profiler_interface: ProfilerProtocol
    ):
        """Profile a single entity"""
        if not self.profiler_config.profiler:
            self.profiler = DefaultProfiler(
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

            self.profiler = Profiler(
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

        databases = [
            self.filter_databases(database)
            for database in self.metadata.list_all_entities(
                entity=Database,
                params={"service": self.config.source.serviceName},
            )
            if self.filter_databases(database)
        ]

        if not databases:
            raise ValueError(
                "databaseFilterPattern returned 0 result. At least 1 database must be returned by the filter pattern."
                f"\n\t- includes: {self.source_config.databaseFilterPattern.includes if self.source_config.databaseFilterPattern else None}"  # pylint: disable=line-too-long
                f"\n\t- excludes: {self.source_config.databaseFilterPattern.excludes if self.source_config.databaseFilterPattern else None}"  # pylint: disable=line-too-long
            )

        return databases

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
        tables = self.metadata.list_all_entities(
            entity=Table,
            fields=[
                "tableProfilerConfig",
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

        yield from self.filter_entities(tables)

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

    def run_profiler(
        self, entity: Table, copied_service_config, sqa_metadata=None
    ) -> Tuple[Optional[ProfilerResponse], Optional[List]]:
        """
        Main logic for the profiler workflow
        """
        try:
            profiler_interface: Union[
                SQAProfilerInterface, PandasProfilerInterface
            ] = ProfilerProtocol.create(
                (
                    copied_service_config.__class__.__name__
                    if isinstance(copied_service_config, NON_SQA_DATABASE_CONNECTIONS)
                    else self.config.source.serviceConnection.__root__.__class__.__name__
                ),
                entity,
                self.get_config_for_entity(entity),
                self.source_config,
                copied_service_config,
                create_ometa_client(self.metadata_config),
                sqa_metadata=sqa_metadata,
            )  # type: ignore
            self.create_profiler(entity, profiler_interface)
            self.profiler = cast(Profiler, self.profiler)  # satisfy type checker
            profile: ProfilerResponse = self.profiler.process(
                self.source_config.generateSampleData,
                self.source_config.processPiiSensitive,
            )
        except Exception as exc:  # pylint: disable=broad-except

            logger.debug(traceback.format_exc())
            logger.error(
                "Unexpected exception processing entity "
                f"[{entity.fullyQualifiedName.__root__}]: {exc}"  # type: ignore
            )
            try:
                # if we fail to instatiate a profiler_interface, we won't have a profiler_interface variable
                self.status.failures.extend(
                    profiler_interface.processor_status.failures  # type: ignore
                )
            except UnboundLocalError:
                pass
            self.source_status.failure(
                entity.fullyQualifiedName.__root__, f"{exc}"  # type: ignore
            )
            profile = None  # type: ignore
        else:
            return profile, profiler_interface.processor_status.failures

        return None, None

    def execute(self):
        """
        Run the profiling and tests
        """

        try:
            for database in self.get_database_entities():
                copied_service_config = self.copy_service_config(database)
                sqa_metadata = (
                    MetaData()
                    if not isinstance(
                        copied_service_config, NON_SQA_DATABASE_CONNECTIONS
                    )
                    else None
                )  # we only need this for sqlalchemy based services
                for entity in self.get_table_entities(database=database):
                    profile, failures = self.run_profiler(
                        entity, copied_service_config, sqa_metadata
                    )
                    if hasattr(self, "sink") and profile:
                        self.sink.write_record(profile)
                    if failures:
                        self.status.failures.extend(
                            failures
                        )  # we can have column level failures we need to report on
                    self.status.processed(entity.fullyQualifiedName.__root__)  # type: ignore
                    self.source_status.scanned(entity.fullyQualifiedName.__root__)  # type: ignore
            # At the end of the `execute`, update the associated Ingestion Pipeline status as success
            self.set_ingestion_pipeline_status(PipelineState.success)

        # Any unhandled exception breaking the workflow should update the status
        except Exception as err:
            self.set_ingestion_pipeline_status(PipelineState.failed)
            raise err

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

    def _raise_from_status_internal(self, raise_warnings=False):
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
        if (
            not self.config.source.serviceConnection
            and not self.metadata.config.forceEntityOverwriting
        ):
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

    def test_connection(self):
        service_config = self.config.source.serviceConnection.__root__.config
        self.engine = get_connection(service_config)

        test_connection_fn = get_test_connection_fn(service_config)
        test_connection_fn(self.engine, service_config)
