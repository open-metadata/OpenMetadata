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
OpenMetadataExt source for the profiler

This source is used in cases where the service name
is not provided for the profiler workflow.
In such situations, the profiler will perform a thorough scan 
of the entire data source to locate the 
corresponding table entity in OpenMetadata.
Subsequently, it will proceed to ingest relevant metrics 
and sample data for that identified entity.
"""
import traceback
from copy import deepcopy
from typing import Iterable, cast

from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.source.metadata import (
    OpenMetadataSource,
    ProfilerSourceAndEntity,
)
from metadata.profiler.source.profiler_source_factory import profiler_source_factory
from metadata.utils import fqn
from metadata.utils.class_helper import get_service_type_from_source_type
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.importer import import_source_class
from metadata.utils.logger import profiler_logger
from metadata.utils.ssl_manager import get_ssl_connection

logger = profiler_logger()


class OpenMetadataSourceExt(OpenMetadataSource):
    """
    This source lists and filters the entities that need
    to be processed by the profiler workflow.

    Note that in order to manage the following steps we need
    to test the connection against the Database Service Source.
    We do this here as well.
    """

    # pylint: disable=super-init-not-called
    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
    ):
        self.init_steps()

        self.config = config
        self.metadata = metadata
        self.test_connection()

        # Init and type the source config
        self.service_connection = self.config.source.serviceConnection.root.config
        self.source_config: DatabaseServiceProfilerPipeline = cast(
            DatabaseServiceProfilerPipeline, self.config.source.sourceConfig.config
        )  # Used to satisfy type checked
        source_type = self.config.source.type.lower()
        service_type = get_service_type_from_source_type(self.config.source.type)
        source_class = import_source_class(
            service_type=service_type, source_type=source_type
        )
        database_source_config = DatabaseServiceMetadataPipeline()
        new_config = deepcopy(self.config.source)
        new_config.sourceConfig.config = database_source_config
        self.source = source_class.create(new_config.model_dump(), self.metadata)
        self.engine = None
        self.inspector = None
        self._connection = None
        self.set_inspector()

        logger.info(
            f"Starting profiler for service {self.config.source.type}"
            f":{self.config.source.type.lower()}"
        )

    def set_inspector(self, database_name: str = None) -> None:
        """
        When sources override `get_database_names`, they will need
        to setup multiple inspectors. They can use this function.
        :param database_name: new database to set
        """
        new_service_connection = deepcopy(self.service_connection)
        if database_name:
            logger.info(f"Ingesting from database: {database_name}")
            new_service_connection.database = database_name
        self.engine = get_ssl_connection(new_service_connection)
        self.inspector = inspect(self.engine)
        self._connection = None  # Lazy init as well

    def _iter(self, *_, **__) -> Iterable[Either[ProfilerSourceAndEntity]]:
        global_profiler_config = self.metadata.get_profiler_config_settings()
        for database_name in self.get_database_names():
            try:
                database_entity = fqn.search_database_from_es(
                    database_name=database_name,
                    metadata=self.metadata,
                    service_name=None,
                )
                if not database_entity:
                    logger.debug(
                        f"Database Entity for database `{database_name}` not found"
                    )
                    continue
                for schema_name in self.get_schema_names():
                    for table_name in self.get_table_names(schema_name):
                        table_entity = fqn.search_table_from_es(
                            metadata=self.metadata,
                            database_name=database_name,
                            service_name=None,
                            schema_name=schema_name,
                            table_name=table_name,
                            fields=",".join(self._get_fields()),
                        )
                        if not table_entity:
                            logger.debug(
                                f"Table Entity for table `{database_name}.{schema_name}.{table_name}` not found"
                            )
                            continue

                        profiler_source = profiler_source_factory.create(
                            self.config.source.type.lower(),
                            self.config,
                            database_entity,
                            self.metadata,
                            global_profiler_config,
                        )
                        yield Either(
                            right=ProfilerSourceAndEntity(
                                profiler_source=profiler_source,
                                entity=table_entity,
                            )
                        )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=database_name,
                        error=f"Error listing source and entities for database due to [{exc}]",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def get_table_names(self, schema_name: str) -> Iterable[str]:
        for table_name in self.inspector.get_table_names(schema_name) or []:
            if filter_by_table(self.source_config.tableFilterPattern, table_name):
                self.status.filter(table_name, "Table pattern not allowed")
                continue
            yield table_name

    def get_schema_names(self) -> Iterable[str]:
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema
        else:
            for schema_name in self.inspector.get_schema_names():
                if filter_by_schema(
                    self.source_config.schemaFilterPattern, schema_name
                ):
                    self.status.filter(schema_name, "Schema pattern not allowed")
                    continue
                yield schema_name

    def get_database_names(self) -> Iterable[str]:
        """
        Method to fetch database names from source
        """
        try:
            if hasattr(self.service_connection, "supportsDatabase"):
                configured_db = self.source.get_configured_database()
                if configured_db:
                    yield configured_db
                else:
                    database_names = self.source.get_database_names_raw()
                    for database in database_names:
                        database_fqn = fqn.build(
                            self.metadata,
                            entity_type=Database,
                            service_name=self.config.source.serviceName,
                            database_name=database,
                        )
                        if filter_by_database(
                            self.source_config.databaseFilterPattern,
                            database_fqn
                            if self.source_config.useFqnForFiltering
                            else database,
                        ):
                            self.status.filter(database, "Database pattern not allowed")
                            continue
                        self.set_inspector(database_name=database)
                        yield database
            else:
                custom_database_name = self.service_connection.__dict__.get(
                    "databaseName"
                )
                database_name = self.service_connection.__dict__.get(
                    "database", custom_database_name or "default"
                )
                yield database_name
        except Exception as exc:
            logger.debug(f"Failed to fetch database names {exc}")
            logger.debug(traceback.format_exc())
