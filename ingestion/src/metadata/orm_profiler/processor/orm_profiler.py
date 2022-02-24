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
from metadata.generated.schema.entity.data.table import Table, TableProfile
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.processor import Processor, ProcessorStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.orm_profiler.api.models import ProfileAndTests, ProfilerProcessorConfig
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.orm.converter import ometa_to_orm
from metadata.orm_profiler.profiles.core import Profiler
from metadata.orm_profiler.profiles.default import DefaultProfiler
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

    def build_profiler(self, orm) -> Profiler:
        """
        Given a column from the entity, build the profiler

        table is of type DeclarativeMeta
        """
        if not self.config.profiler:
            return DefaultProfiler(session=self.session, table=orm)

        # Here we will need to add the logic to pass kwargs to the metrics
        metrics = [Metrics.get(name) for name in self.config.profiler.metrics]

        return Profiler(
            *metrics,
            session=self.session,
            table=orm,
        )

    def profile_entity(self, orm, table: Table) -> TableProfile:
        """
        Given a table, we will prepare the profiler for
        all its columns and return all the run profilers
        in a Dict in the shape {col_name: Profiler}

        Type of entity is DeclarativeMeta
        """
        if not isinstance(orm, DeclarativeMeta):
            raise ValueError(f"Entity {orm} should be a DeclarativeMeta.")

        # Prepare the profilers for all table columns
        profiler = self.build_profiler(orm)

        logger.info(f"Executing profilers for {table.fullyQualifiedName}...")
        profiler.execute()

        self.status.processed(table.fullyQualifiedName)
        return profiler.get_profile()

    def log_validation(self, name: str, validation: Validation) -> None:
        """
        Log validation results
        """
        self.status.tested(name)
        if not validation.valid:
            self.status.failure(
                f"{name}: Expected value {validation.value} vs. Real value {validation.computed_metric}"
            )

    def validate_entity(self, orm, profiler_results: TableProfile) -> TestDef:
        """
        Given a table, check if it has any tests pending.

        If so, run the Validations against the profiler_results
        and return the computed Validations.

        The result will have the shape {test_name: Validation}

        Type of entity is DeclarativeMeta
        """
        if not isinstance(orm, DeclarativeMeta):
            raise ValueError(f"Entity {orm} should be a DeclarativeMeta.")

        logger.info(f"Checking validations for {orm}...")

        # We have all validations parsed at read-time
        test_def: TestDef = self.config.tests

        # Compute all validations against the profiler results
        for test in test_def.table_tests:
            for validation in test.expression:
                # Pass the whole dict, although we just want columnCount & rowCount
                validation.validate(profiler_results.dict())
                self.log_validation(name=test.name, validation=validation)

        for column_res in test_def.column_tests:
            for test in column_res.columns:
                col_profiler_res = next(
                    iter(
                        col_profiler
                        for col_profiler in profiler_results.columnProfile
                        if col_profiler.name == test.column
                    ),
                    None,
                )
                if col_profiler_res is None:
                    self.status.warning(
                        f"Cannot find a profiler that computed the column {test.column} for {column_res.table}."
                        + f" Skipping validation {test}"
                    )

                for validation in test.expression:
                    validation.validate(col_profiler_res.dict())
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

        res = ProfileAndTests(
            table=record,
            profile=entity_profile,
            tests=entity_validations,
        )

        return res

    def close(self):
        """
        Close all connections
        """
        self.metadata.close()
        self.session.close()

    def get_status(self) -> OrmProfilerStatus:
        return self.status
