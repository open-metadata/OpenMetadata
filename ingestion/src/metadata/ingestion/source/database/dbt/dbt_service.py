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
DBT service Topology.
"""

from abc import ABC, abstractmethod
from typing import Iterable

from dbt_artifacts_parser.parser import parse_catalog, parse_manifest, parse_run_results

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.ingestion.api.source import Source
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyNode,
    create_source_context,
)
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.utils.dbt_config import DbtFiles, DbtObjects, get_dbt_details
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DbtServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Database Services.
    service -> db -> schema -> table.

    We could have a topology validator. We can only consume
    data that has been produced by any parent node.
    """

    root = TopologyNode(
        producer="get_dbt_files",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                processor="validate_dbt_files",
                ack_sink=False,
                nullable=True,
            )
        ],
        children=[
            "process_dbt_data_model",
            "process_dbt_entities",
            "process_dbt_tests",
        ],
    )
    process_dbt_data_model = TopologyNode(
        producer="get_dbt_objects",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_dbt_tags",
                ack_sink=False,
                nullable=True,
                cache_all=True,
            ),
            NodeStage(
                type_=DataModelLink,
                processor="yield_data_models",
                ack_sink=False,
                nullable=True,
            ),
        ],
    )
    process_dbt_entities = TopologyNode(
        producer="get_data_model",
        stages=[
            NodeStage(
                type_=AddLineageRequest,
                processor="create_dbt_lineage",
                ack_sink=False,
            ),
            NodeStage(
                type_=AddLineageRequest,
                processor="create_dbt_query_lineage",
                ack_sink=False,
            ),
            NodeStage(
                type_=DataModelLink,
                processor="process_dbt_descriptions",
                ack_sink=False,
                nullable=True,
            ),
        ],
    )
    process_dbt_tests = TopologyNode(
        producer="get_dbt_tests",
        stages=[
            NodeStage(
                type_=CreateTestSuiteRequest,
                processor="create_dbt_tests_suite",
                ack_sink=False,
            ),
            NodeStage(
                type_=CreateTestDefinitionRequest,
                processor="create_dbt_tests_suite_definition",
                ack_sink=False,
            ),
            NodeStage(
                type_=CreateTestCaseRequest,
                processor="create_dbt_test_case",
                ack_sink=False,
            ),
            NodeStage(
                type_=TestCaseResult,
                processor="update_dbt_test_result",
                ack_sink=False,
                nullable=True,
            ),
        ],
    )


class DbtServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Class for defining the topology of the DBT source
    """

    topology = DbtServiceTopology()
    context = create_source_context(topology)

    def get_dbt_files(self) -> DbtFiles:
        dbt_files = get_dbt_details(
            self.source_config.dbtConfigSource  # pylint: disable=no-member
        )

        self.context.dbt_files = dbt_files
        yield dbt_files

    def get_dbt_objects(self) -> DbtObjects:
        dbt_objects = DbtObjects(
            dbt_catalog=parse_catalog(self.context.dbt_files.dbt_catalog)
            if self.context.dbt_files.dbt_catalog
            else None,
            dbt_manifest=parse_manifest(self.context.dbt_files.dbt_manifest),
            dbt_run_results=parse_run_results(self.context.dbt_files.dbt_run_results)
            if self.context.dbt_files.dbt_run_results
            else None,
        )
        yield dbt_objects

    @abstractmethod
    def validate_dbt_files(self, dbt_files: DbtFiles):
        """
        Method to validate DBT files
        """

    @abstractmethod
    def yield_dbt_tags(
        self, dbt_objects: DbtObjects
    ) -> Iterable[OMetaTagAndClassification]:
        """
        Create and yeild tags from DBT
        """

    @abstractmethod
    def yield_data_models(self, dbt_objects: DbtObjects) -> DataModelLink:
        """
        Yield the data models
        """

    def get_data_model(self) -> DataModelLink:
        """
        Prepare the data models
        """
        for data_model_link in self.context.data_model_links:
            yield data_model_link

    @abstractmethod
    def create_dbt_lineage(self, data_model_link: DataModelLink) -> AddLineageRequest:
        """
        Method to process DBT lineage from upstream nodes
        """

    @abstractmethod
    def create_dbt_query_lineage(
        self, data_model_link: DataModelLink
    ) -> AddLineageRequest:
        """
        Method to process DBT lineage from queries
        """

    @abstractmethod
    def process_dbt_descriptions(self, data_model_link: DataModelLink):
        """
        Method to process DBT descriptions using patch APIs
        """

    def get_dbt_tests(self) -> dict:
        """
        Prepare the DBT tests
        """
        for _, dbt_test in self.context.dbt_tests.items():
            yield dbt_test

    @abstractmethod
    def create_dbt_tests_suite(self, dbt_test: dict) -> CreateTestSuiteRequest:
        """
        Method to add the DBT tests suites
        """

    @abstractmethod
    def create_dbt_tests_suite_definition(
        self, dbt_test: dict
    ) -> CreateTestDefinitionRequest:
        """
        Method to add DBT test definitions
        """

    @abstractmethod
    def create_dbt_test_case(self, dbt_test: dict) -> CreateTestCaseRequest:
        """
        After test suite and test definitions have been processed, add the tests cases info
        """

    @abstractmethod
    def update_dbt_test_result(self, dbt_test: dict):
        """
        After test cases has been processed, add the tests results info
        """
