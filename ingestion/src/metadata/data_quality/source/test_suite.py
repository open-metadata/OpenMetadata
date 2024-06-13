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
Test Suite Workflow Source

The main goal is to get the configured table from the API.
"""
import itertools
from typing import Iterable, List, Optional, cast

from metadata.data_quality.api.models import TableAndTests
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import entity_link, fqn
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class TestSuiteSource(Source):
    """
    Gets the ingredients required to run the tests
    """

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
    ):
        super().__init__()

        self.config = config
        self.metadata = metadata

        self.source_config: TestSuitePipeline = self.config.source.sourceConfig.config

        self.test_connection()

    @property
    def name(self) -> str:
        return "OpenMetadata"

    def _get_table_entity(self) -> Optional[Table]:
        """given an entity fqn return the table entity

        Args:
            entity_fqn: entity fqn for the test case
        """
        if self.source_config.entityFullyQualifiedName is None:
            return None
        table: Table = self.metadata.get_by_name(
            entity=Table,
            fqn=self.source_config.entityFullyQualifiedName.root,
            fields=["tableProfilerConfig", "testSuite"],
        )

        return table

    def _get_test_cases_from_test_suite(
        self, test_suite: Optional[TestSuite]
    ) -> Optional[List[TestCase]]:
        """Return test cases if the test suite exists and has them"""
        if test_suite:
            test_cases = self.metadata.list_all_entities(
                entity=TestCase,
                fields=["testSuite", "entityLink", "testDefinition"],
                params={"testSuiteId": test_suite.id.root},
            )
            test_cases = cast(List[TestCase], test_cases)  # satisfy type checker

            return test_cases

        return None

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        self.metadata.health_check()

    def _iter(self) -> Iterable[Either[TableAndTests]]:
        table: Table = self._get_table_entity()

        if table:
            yield from self._process_table_suite(table)

        else:
            yield from self._process_logical_suite()

    def _process_table_suite(self, table: Table) -> Iterable[Either[TableAndTests]]:
        """
        Check that the table has the proper test suite built in
        """
        # If there is no executable test suite yet for the table, we'll need to create one
        if not table.testSuite:
            executable_test_suite = CreateTestSuiteRequest(
                name=fqn.build(
                    None,
                    TestSuite,
                    table_fqn=self.source_config.entityFullyQualifiedName.root,
                ),
                displayName=f"{self.source_config.entityFullyQualifiedName.root} Test Suite",
                description="Test Suite created from YAML processor config file",
                owner=None,
                executableEntityReference=self.source_config.entityFullyQualifiedName.root,
            )
            yield Either(
                right=TableAndTests(
                    executable_test_suite=executable_test_suite,
                    service_type=self.config.source.serviceConnection.root.config.type.value,
                )
            )

        test_suite: Optional[TestSuite] = None
        if table.testSuite:
            test_suite = self.metadata.get_by_id(
                entity=TestSuite, entity_id=table.testSuite.id.root
            )

        if test_suite and not test_suite.executable:
            yield Either(
                left=StackTraceError(
                    name="Non-executable Test Suite",
                    error=f"The table {self.source_config.entityFullyQualifiedName.root} "
                    "has a test suite that is not executable.",
                )
            )

        else:
            test_suite_cases = self._get_test_cases_from_test_suite(test_suite)

            yield Either(
                right=TableAndTests(
                    table=table,
                    test_cases=test_suite_cases,
                    service_type=self.config.source.serviceConnection.root.config.type.value,
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

    def close(self) -> None:
        """Nothing to close"""

    def _process_logical_suite(self):
        """Process logical test suite, collect all test cases and yield them in batches by table"""
        test_suite = self.metadata.get_by_name(
            entity=TestSuite, fqn=self.config.source.serviceName
        )
        if test_suite is None:
            yield Either(
                left=StackTraceError(
                    name="Test Suite not found",
                    error=f"Test Suite with name {self.config.source.serviceName} not found",
                )
            )
        test_cases: List[TestCase] = list(
            self.metadata.list_all_entities(
                TestCase, params={"testSuiteId": test_suite.id.root}
            )
        )
        grouped_by_table = itertools.groupby(
            test_cases, key=lambda t: entity_link.get_table_fqn(t.entityLink.root)
        )
        for table_fqn, group in grouped_by_table:
            table_entity: Table = self.metadata.get_by_name(Table, table_fqn)
            if table_entity is None:
                yield Either(
                    left=StackTraceError(
                        name="Table not found",
                        error=f"Table with fqn {table_fqn} not found for test suite {test_suite.name.root}",
                    )
                )
                continue
            yield Either(
                right=TableAndTests(
                    table=table_entity,
                    test_cases=list(group),
                    service_type=self.config.source.serviceConnection.root.config.type.value,
                )
            )
