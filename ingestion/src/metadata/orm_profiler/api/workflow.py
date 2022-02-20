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
from typing import Dict, Iterable, List, Optional

import click
from pydantic import Field
from sqlalchemy.orm import DeclarativeMeta, InstrumentedAttribute, Session

from metadata.config.common import ConfigModel, DynamicTypedConfig
from metadata.config.workflow import get_ingestion_source, get_sink
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.sink import Sink
from metadata.ingestion.api.source import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import (
    SQLConnectionConfig,
    SQLSourceStatus,
)
from metadata.orm_profiler.api.models import ColumnProfiler, ProfilerResult
from metadata.orm_profiler.engines import create_and_bind_session, get_engine
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.orm.converter import ometa_to_orm
from metadata.orm_profiler.profiles.core import Profiler, SingleProfiler
from metadata.orm_profiler.profiles.models import ProfilerDef
from metadata.orm_profiler.profiles.simple import SimpleProfiler, SimpleTableProfiler
from metadata.orm_profiler.utils import logger
from metadata.orm_profiler.validations.models import TestDef

logger = logger()


class TestValidationException(Exception):
    """
    Raised when there are test errors
    """


class ProfilerWorkflowConfig(ConfigModel):
    """
    Configurations we expect to find in the
    Workflow JSON
    """

    run_id: str = Field(default_factory=lambda: str(uuid.uuid1()))
    source: DynamicTypedConfig
    metadata_server: DynamicTypedConfig
    profiler: Optional[ProfilerDef] = None
    tests: Optional[TestDef] = None
    sink: Optional[DynamicTypedConfig] = None


class ProfilerWorkflow:
    """
    Configure and run the ORM profiler
    """

    config: ProfilerWorkflowConfig
    ctx: WorkflowContext
    source: Source
    sink: Sink
    metadata: OpenMetadata
    session: Session
    report = {}

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

        # SQLAlchemy Session to run the profilers
        self.session: Session = create_and_bind_session(get_engine(self.source_config))

        # Init validation report
        self.report["tests"] = {}

    @classmethod
    def create(cls, config_dict: dict) -> "ProfilerWorkflow":
        """
        Parse a JSON (dict) and create the workflow
        """
        config = ProfilerWorkflowConfig.parse_obj(config_dict)
        return cls(config)

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

    def build_table_profiler(self, table) -> Profiler:
        """
        Prepare the profiler for table tests

        table is of type DeclarativeMeta
        """
        if not self.config.profiler:
            return SimpleTableProfiler(session=self.session, table=table)

        metrics = [Metrics.init(name) for name in self.config.profiler.table_metrics]

        return SingleProfiler(*metrics, session=self.session, table=table)

    def build_column_profiler(
        self, table, column: InstrumentedAttribute
    ) -> ColumnProfiler:
        """
        Given a column from the entity, build the profiler

        table is of type DeclarativeMeta
        """
        if not self.config.profiler:
            return ColumnProfiler(
                column=column.name,
                profiler=SimpleProfiler(session=self.session, col=column, table=table),
            )

        metrics = [
            Metrics.init(name, col=column) for name in self.config.profiler.metrics
        ]

        return ColumnProfiler(
            column=column.name,
            profiler=SingleProfiler(*metrics, session=self.session, table=table),
        )

    def profile_entity(self, orm, table: Table) -> ProfilerResult:
        """
        Given a table, we will prepare the profiler for
        all its columns and return all the run profilers
        in a Dict in the shape {col_name: Profiler}

        Type of entity is DeclarativeMeta
        """
        if not isinstance(orm, DeclarativeMeta):
            raise ValueError(f"Entity {orm} should be a DeclarativeMeta.")

        # Prepare the profilers for all table columns
        res = ProfilerResult(
            table=table,
            table_profiler=self.build_table_profiler(orm),
            column_profilers=[
                self.build_column_profiler(orm, col) for col in orm.__table__.c
            ],
        )

        logger.info(f"Executing profilers for {table.fullyQualifiedName}...")

        # Execute Table Profiler
        res.table_profiler.execute()

        # Execute all column profilers
        for col_profiler in res.column_profilers:
            col_profiler.profiler.execute()

        return res

    def validate_entity(self, orm, profiler_results: ProfilerResult) -> TestDef:
        """
        Given a table, check if it has any tests pending.

        If so, run the Validations against the profiler_results
        and return the computed Validations.

        The result will have the shape {test_name: Validation}

        Type of entity is DeclarativeMeta
        """
        if not isinstance(orm, DeclarativeMeta):
            raise ValueError(f"Entity {orm} should be a DeclarativeMeta.")

        logger.info(
            f"Checking validations for {profiler_results.table.fullyQualifiedName}..."
        )

        # We have all validations parsed at read-time
        test_def: TestDef = self.config.tests

        # Compute all validations against the profiler results
        for test in test_def.table_tests:
            for validation in test.expression:
                validation.validate(profiler_results.table_profiler.results)
                self.report["tests"][test.name.replace(" ", "_")] = validation.valid

        for column_res in test_def.column_tests:
            for test in column_res.columns:
                profiler = next(
                    iter(
                        col_profiler.profiler
                        for col_profiler in profiler_results.column_profilers
                        if col_profiler.column == test.column
                    ),
                    None,
                )
                if profiler is None:
                    logger.warn(
                        f"Cannot find a profiler that computed the column {test.column}. Skipping validation {test}"
                    )
                    continue

                for validation in test.expression:
                    validation.validate(profiler.results)
                    self.report["tests"][test.name.replace(" ", "_")] = validation.valid

        return test_def

    def execute(self):
        """
        Run the profiling and tests
        """
        for entity in self.list_entities():

            # Convert entity to ORM. Fetch the db by ID to make sure we use the proper db name
            database = self.metadata.get_by_id(
                entity=Database, entity_id=entity.database.id
            )
            orm_table = ometa_to_orm(table=entity, database=database)

            entity_profile = self.profile_entity(orm_table, entity)
            # TODO: Publish profile results with sink

            if self.config.tests:
                entity_validations = self.validate_entity(orm_table, entity_profile)
                # TODO: publish validation with sink
            else:
                logger.info("No tests found. We will just return the Profiler data.")

    def print_status(self) -> Dict[str, bool]:
        """
        Print test report and return it
        """
        click.echo()
        click.secho("Tests Status:", bold=True)
        click.echo(self.report["tests"])
        return self.report["tests"]

    def raise_from_status(self):
        """
        Raise an exception if any test failed
        """
        failures = next(
            iter(name for name, res in self.report["tests"].items() if not res), None
        )

        if failures:
            click.secho("Some tests did not pass:")
            click.secho(failures)
            raise TestValidationException

    def stop(self):
        """
        Close all connections
        """
        self.metadata.close()
        self.session.close()
