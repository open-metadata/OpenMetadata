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
OpenMetadata source for the profiler
"""
import traceback
from typing import Iterable, List, Optional, cast

from pydantic import BaseModel, ConfigDict

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.source.base.profiler_source import ProfilerSource
from metadata.profiler.source.profiler_source_factory import profiler_source_factory
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


TABLE_FIELDS = ["tableProfilerConfig", "columns", "customMetrics"]
TAGS_FIELD = ["tags"]


class ProfilerSourceAndEntity(BaseModel):
    """Return class for the OpenMetadata Profiler Source"""

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    profiler_source: ProfilerSource
    entity: Table

    def __str__(self):
        """Return the information of the table being profiler"""
        return f"Table [{self.entity.name.root}]"


class OpenMetadataSource(Source):
    """
    This source lists and filters the entities that need
    to be processed by the profiler workflow.

    Note that in order to manage the following steps we need
    to test the connection against the Database Service Source.
    We do this here as well.
    """

    def init_steps(self):
        super().__init__()

    @property
    def name(self) -> str:
        return "OpenMetadata Service"

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
        self.source_config: DatabaseServiceProfilerPipeline = cast(
            DatabaseServiceProfilerPipeline, self.config.source.sourceConfig.config
        )  # Used to satisfy type checked

        if not self._validate_service_name():
            raise ValueError(
                f"Service name `{self.config.source.serviceName}` does not exist. "
                "Make sure you have run the ingestion for the service specified in the profiler workflow. "
                "If so, make sure the profiler service name matches the service name specified during ingestion "
                "and that your ingestion token (settings > bots) is still valid."
            )

        logger.info(
            f"Starting profiler for service {self.config.source.serviceName}"
            f":{self.config.source.type.lower()}"
        )

    def _validate_service_name(self):
        """Validate service name exists in OpenMetadata"""
        return self.metadata.get_by_name(
            entity=DatabaseService, fqn=self.config.source.serviceName
        )

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        """
        Our source is the ometa client. Validate the
        health check before moving forward
        """
        self.metadata.health_check()

    def _iter(self, *_, **__) -> Iterable[Either[ProfilerSourceAndEntity]]:
        global_profiler_config = self.metadata.get_profiler_config_settings()
        for database in self.get_database_entities():
            try:
                profiler_source = profiler_source_factory.create(
                    self.config.source.type.lower(),
                    self.config,
                    database,
                    self.metadata,
                    global_profiler_config,
                )
                for entity in self.get_table_entities(database=database):
                    yield Either(
                        right=ProfilerSourceAndEntity(
                            profiler_source=profiler_source,
                            entity=entity,
                        )
                    )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=database.fullyQualifiedName.root,
                        error=f"Error listing source and entities for database due to [{exc}]",
                        stackTrace=traceback.format_exc(),
                    )
                )

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "Step":
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config=config, metadata=metadata)

    def filter_databases(self, database: Database) -> Optional[Database]:
        """Returns filtered database entities"""
        database_fqn = fqn.build(
            self.metadata,
            entity_type=Database,
            service_name=self.config.source.serviceName,
            database_name=database.name.root,
        )
        if filter_by_database(
            self.source_config.databaseFilterPattern,
            database_fqn
            if self.source_config.useFqnForFiltering
            else database.name.root,
        ):
            self.status.filter(database.name.root, "Database pattern not allowed")
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
                schema_fqn = fqn.build(
                    self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.config.source.serviceName,
                    database_name=table.database.name,
                    schema_name=table.databaseSchema.name,
                )
                if filter_by_schema(
                    self.source_config.schemaFilterPattern,
                    schema_fqn
                    if self.source_config.useFqnForFiltering
                    else table.databaseSchema.name,  # type: ignore
                ):
                    self.status.filter(
                        f"Schema pattern not allowed: {table.fullyQualifiedName.root}",
                        "Schema pattern not allowed",
                    )
                    continue
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.config.source.serviceName,
                    database_name=table.database.name,
                    schema_name=table.databaseSchema.name,
                    table_name=table.name.root,
                )

                if filter_by_table(
                    self.source_config.tableFilterPattern,
                    table_fqn
                    if self.source_config.useFqnForFiltering
                    else table.name.root,
                ):
                    self.status.filter(
                        f"Table pattern not allowed: {table.fullyQualifiedName.root}",
                        "Table pattern not allowed",
                    )
                    continue
                if (
                    table.tableType == TableType.View
                    and not self.source_config.includeViews
                ):
                    self.status.filter(
                        table.fullyQualifiedName.root,
                        "View filtered out",
                    )
                    continue
                yield table
            except Exception as exc:
                self.status.failed(
                    StackTraceError(
                        name=table.fullyQualifiedName.root,
                        error=f"Unexpected error filtering entities for table [{table}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

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

    def _get_fields(self) -> List[str]:
        """Get the fields required to process the tables"""
        return (
            TABLE_FIELDS
            if not self.source_config.processPiiSensitive
            else TABLE_FIELDS + TAGS_FIELD
        )

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
            fields=self._get_fields(),
            params={
                "service": self.config.source.serviceName,
                "database": fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.config.source.serviceName,
                    database_name=database.name.root,
                ),
            },  # type: ignore
        )

        yield from self.filter_entities(tables)

    def close(self) -> None:
        """Nothing to close"""
