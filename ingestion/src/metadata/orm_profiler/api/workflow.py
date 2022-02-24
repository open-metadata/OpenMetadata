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
import itertools
import uuid
from typing import Iterable, List, Optional

import click
from pydantic import Field, ValidationError

from metadata.config.common import (
    ConfigModel,
    DynamicTypedConfig,
    WorkflowExecutionError,
)
from metadata.config.workflow import get_ingestion_source, get_processor, get_sink
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.processor import Processor
from metadata.ingestion.api.sink import Sink
from metadata.ingestion.api.source import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import (
    SQLConnectionConfig,
    SQLSourceStatus,
)
from metadata.orm_profiler.api.models import ProfileAndTests, ProfilerProcessorConfig
from metadata.orm_profiler.engines import create_and_bind_session, get_engine
from metadata.orm_profiler.utils import logger

logger = logger()


class WorkflowConfigException(Exception):
    """
    Raised when the workflow is not properly configured
    """


class ProfilerWorkflowConfig(ConfigModel):
    """
    Configurations we expect to find in the
    Workflow JSON
    """

    run_id: str = Field(default_factory=lambda: str(uuid.uuid1()))
    source: DynamicTypedConfig
    metadata_server: DynamicTypedConfig
    processor: Optional[DynamicTypedConfig] = None
    sink: Optional[DynamicTypedConfig] = None


class ProfilerWorkflow:
    """
    Configure and run the ORM profiler
    """

    config: ProfilerWorkflowConfig
    ctx: WorkflowContext
    source: Source
    processor: Processor
    sink: Sink
    metadata: OpenMetadata

    def __init__(self, config: ProfilerWorkflowConfig):
        self.config = config
        self.ctx = WorkflowContext(workflow_id=self.config.run_id)

        self.metadata_config = MetadataServerConfig.parse_obj(
            self.config.metadata_server.dict().get("config", {})
        )

        # We will use the existing sources to build the Engine
        self.source = get_ingestion_source(
            source_type=self.config.source.type,
            context=self.ctx,
            source_config=self.config.source,
            metadata_config=self.metadata_config,
        )

        if not isinstance(self.source, SQLSource):
            raise ValueError(
                f"Invalid source type for {self.source}. We only support SQLSource in the Profiler"
            )

        # Init and type the source config
        self.source_config: SQLConnectionConfig = self.source.config
        self.source_status = SQLSourceStatus()

        self.processor = get_processor(
            processor_type=self.config.processor.type,  # orm-profiler
            context=self.ctx,
            processor_config=self.config.processor or ProfilerProcessorConfig(),
            metadata_config=self.metadata_config,
            _from="orm_profiler",
            # Pass the session as kwargs for the profiler
            session=create_and_bind_session(get_engine(self.source_config)),
        )

        if self.config.sink:
            self.sink = get_sink(
                sink_type=self.config.sink.type,
                context=self.ctx,
                sink_config=self.config.sink,
                metadata_config=self.metadata_config,
                _from="orm_profiler",
            )

        # OpenMetadata client to fetch tables
        self.metadata = OpenMetadata(self.metadata_config)

    @classmethod
    def create(cls, config_dict: dict) -> "ProfilerWorkflow":
        """
        Parse a JSON (dict) and create the workflow
        """
        try:
            config = ProfilerWorkflowConfig.parse_obj(config_dict)
            return cls(config)
        except ValidationError as err:
            logger.error("Error trying to parse the Profiler Workflow configuration")
            raise WorkflowConfigException(f"Error parsing workflow - {err}")

    def filter_entities(self, tables: List[Table]) -> Iterable[Table]:
        """
        From a list of tables, apply the SQLSourceConfig
        filter patterns.

        We will update the status on the SQLSource Status.
        """
        for table in tables:

            # Validate schema
            if not self.source_config.schema_filter_pattern.included(
                table.database.name
            ):
                self.source_status.filter(
                    table.database.name, "Schema pattern not allowed"
                )
                continue

            # Validate database
            if not self.source_config.table_filter_pattern.included(
                str(table.name.__root__)
            ):
                self.source_status.filter(
                    table.fullyQualifiedName, "Table name pattern not allowed"
                )
                continue

            self.source_status.scanned(table.fullyQualifiedName)
            yield table

    def list_entities(self) -> Iterable[Table]:
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

        # First, get all the databases for the service:
        all_dbs = self.metadata.list_entities(
            entity=Database,
            params={"service": self.source_config.service_name},
        )

        # Then list all tables from each db.
        # This returns a nested structure [[db1 tables], [db2 tables]...]
        all_tables = [
            self.metadata.list_entities(
                entity=Table,
                fields=[
                    "tableProfile"
                ],  # We will need it for window metrics to check past data
                params={
                    "database": f"{self.source_config.service_name}.{database.name.__root__}"
                },
            ).entities
            for database in all_dbs.entities
        ]

        # Flatten the structure into a List[Table]
        flat_tables = list(itertools.chain.from_iterable(all_tables))

        yield from self.filter_entities(flat_tables)

    def execute(self):
        """
        Run the profiling and tests
        """
        for entity in self.list_entities():
            profile_and_tests: ProfileAndTests = self.processor.process(entity)
            print(profile_and_tests)

    def print_status(self) -> int:
        click.echo()
        click.secho("Source Status:", bold=True)
        click.echo(self.source_status.as_string())
        click.secho("Processor Status:", bold=True)
        click.echo(self.processor.get_status().as_string())
        if hasattr(self, "sink"):
            click.secho("Sink Status:", bold=True)
            click.echo(self.sink.get_status().as_string())
            click.echo()

        if (
            self.source_status.failures
            or self.processor.get_status().failures
            or (hasattr(self, "sink") and self.sink.get_status().failures)
        ):
            click.secho("Workflow finished with failures", fg="bright_red", bold=True)
            return 1
        elif (
            self.source_status.warnings
            or self.processor.get_status().failures
            or (hasattr(self, "sink") and self.sink.get_status().warnings)
        ):
            click.secho("Workflow finished with warnings", fg="yellow", bold=True)
            return 0
        else:
            click.secho("Workflow finished successfully", fg="green", bold=True)
            return 0

    def raise_from_status(self, raise_warnings=False):
        """
        Check source, processor and sink status and raise if needed

        Our profiler source will never log any failure, only filters,
        as we are just picking up data from OM.
        """

        if self.processor.get_status().failures:
            raise WorkflowExecutionError(
                "Processor reported errors", self.processor.get_status()
            )
        if hasattr(self, "sink") and self.sink.get_status().failures:
            raise WorkflowExecutionError("Sink reported errors", self.sink.get_status())

        if raise_warnings:
            if self.source_status.warnings:
                raise WorkflowExecutionError(
                    "Source reported warnings", self.source_status
                )
            if self.processor.get_status().warnings:
                raise WorkflowExecutionError(
                    "Processor reported warnings", self.processor.get_status()
                )
            if hasattr(self, "sink") and self.sink.get_status().warnings:
                raise WorkflowExecutionError(
                    "Sink reported warnings", self.sink.get_status()
                )

    def stop(self):
        """
        Close all connections
        """
        self.metadata.close()
