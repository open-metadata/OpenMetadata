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
Defines the ORM Profiler processor

For each table, we compute its profiler
and run the validations.
"""
from dataclasses import dataclass, field
from typing import List

from sqlalchemy.orm import DeclarativeMeta, InstrumentedAttribute, Session

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.processor import Processor, ProcessorStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.orm_profiler.api.models import (
    ColumnProfiler,
    ProfileAndTests,
    ProfilerProcessorConfig,
    ProfilerResult,
)
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.orm.converter import ometa_to_orm
from metadata.orm_profiler.profiles.core import Profiler, SingleProfiler
from metadata.orm_profiler.profiles.simple import SimpleProfiler, SimpleTableProfiler
from metadata.orm_profiler.utils import logger
from metadata.orm_profiler.validations.core import Validation
from metadata.orm_profiler.validations.models import TestDef

logger = logger()


@dataclass
class OrmProfilerStatus(ProcessorStatus):
    """
    Keep track of the profiler execution
    """

    tests: List[str] = field(default_factory=list)

    def tested(self, record: str) -> None:
        self.tests.append(record)
        logger.info(f"Table tested: {record}")


class OrmProfilerProcessor(Processor[Table]):
    """
    For each table, run the profiler and validations.

    We won't return Entity, but the executed Profiler
    and Validation objects.
    """

    config: ProfilerProcessorConfig
    status: OrmProfilerStatus

    def __init__(
        self,
        ctx: WorkflowContext,
        config: ProfilerProcessorConfig,
        metadata_config: MetadataServerConfig,
        session: Session,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = OrmProfilerStatus()
        self.session = session

        self.report = {"tests": {}}

        # OpenMetadata client to fetch tables
        self.metadata = OpenMetadata(self.metadata_config)

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata_config_dict: dict,
        ctx: WorkflowContext,
        **kwargs,
    ):
        """
        We expect to receive `session` inside kwargs
        """

        config = ProfilerProcessorConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)

        session = kwargs.get("session")
        if not session:
            raise ValueError(
                "Cannot initialise the ProfilerProcessor without an SQLAlchemy Session"
            )

        return cls(ctx, config, metadata_config, session=session)

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

    def safe_profile_exec(self, profiler: Profiler, elem: str) -> None:
        """
        Safely execute the profiler and if there are
        any issues, add the status as a failure.
        """
        try:
            profiler.execute()
        except Exception as exc:  # pylint: disable=broad-except
            self.status.failure(f"Error trying to compute profile for {elem} - {exc}")

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
        self.safe_profile_exec(res.table_profiler, table.fullyQualifiedName)

        # Execute all column profilers
        for col_profiler in res.column_profilers:
            self.safe_profile_exec(
                col_profiler.profiler,
                f"{table.fullyQualifiedName}.{col_profiler.column}",
            )

        self.status.processed(table.fullyQualifiedName)
        return res

    def log_validation(self, name: str, validation: Validation) -> None:
        """
        Log validation results
        """
        self.status.tested(name)
        if not validation.valid:
            self.status.failure(
                f"{name}: Expected value {validation.value} vs. Real value {validation.computed_metric}"
            )

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
                self.log_validation(name=test.name, validation=validation)

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
                    self.status.warning(
                        f"Cannot find a profiler that computed the column {test.column} for {column_res.table}."
                        + f" Skipping validation {test}"
                    )

                for validation in test.expression:
                    validation.validate(profiler.results)
                    self.log_validation(name=test.name, validation=validation)

        return test_def

    def process(self, record: Table) -> ProfileAndTests:
        """
        Run the profiling and tests
        """

        # Convert entity to ORM. Fetch the db by ID to make sure we use the proper db name
        database = self.metadata.get_by_id(
            entity=Database, entity_id=record.database.id
        )
        orm_table = ometa_to_orm(table=record, database=database)

        entity_profile = self.profile_entity(orm_table, record)

        entity_validations = None
        if self.config.tests:
            entity_validations = self.validate_entity(orm_table, entity_profile)

        return ProfileAndTests(
            profile=entity_profile,
            test=entity_validations,
        )

    def close(self):
        """
        Close all connections
        """
        self.metadata.close()
        self.session.close()

    def get_status(self) -> OrmProfilerStatus:
        return self.status
