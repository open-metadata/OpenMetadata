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

from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyNode,
    create_source_context,
)
from abc import ABC, abstractmethod
from typing import Iterable, List, Optional, Set, Tuple, Any
from pydantic import BaseModel
from metadata.utils.dbt_config import get_dbt_details
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.tests.basic import TestCaseResult

from metadata.utils.logger import ingestion_logger
logger = ingestion_logger()

class DbtFiles(BaseModel):
    dbt_catalog: Optional[dict]
    dbt_manifest: Optional[dict]
    dbt_run_results: Optional[dict]

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
                type_=OMetaTagAndCategory,
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
        children=["process_dbt_entities", "process_dbt_tests"],
    )
    process_dbt_entities = TopologyNode(
        producer="get_data_model",
        stages=[
            NodeStage(
                type_=DataModelLink,
                processor="create_dbt_lineage",
                ack_sink=False,
            ),
            NodeStage(
                type_=DataModelLink,
                processor="process_dbt_descriptions",
                ack_sink=False,
                nullable=True
            ),
        ]
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
            )
        ]
    )
class DbtServiceSource(
    TopologyRunnerMixin, Source, ABC
):  # pylint: disable=too-many-public-methods
    topology = DbtServiceTopology()
    context = create_source_context(topology)
    
    def get_dbt_files(self) -> DbtFiles:
        dbt_details = get_dbt_details(self.source_config.dbtConfigSource)
        dbt_files = DbtFiles(
                dbt_catalog=dbt_details[0],
                dbt_manifest=dbt_details[1],
                dbt_run_results=dbt_details[2]
            )
        yield dbt_files

    @abstractmethod
    def yield_dbt_tags(self, dbt_files: DbtFiles) -> Iterable[OMetaTagAndCategory]:
        """
        From topology. To be run for each schema
        """

    @abstractmethod
    def yield_data_models(self, dbt_files: DbtFiles) -> DataModelLink:
        """
        Prepares the database name to be sent to stage.
        Filtering happens here.
        """
    
    def get_data_model(self) -> DataModelLink:
        """
        Prepares the database name to be sent to stage.
        Filtering happens here.
        """
        for data_model_link in self.context.data_model_links:
            yield data_model_link

    @abstractmethod
    def create_dbt_lineage(self, data_model_link: DataModelLink) -> AddLineageRequest:
        """
        Prepares the database name to be sent to stage.
        Filtering happens here.
        """

    @abstractmethod
    def process_dbt_descriptions(self, data_model_link: DataModelLink):
        """
        Prepares the database name to be sent to stage.
        Filtering happens here.
        """
    
    def get_dbt_tests(self) -> dict:
        """
        Prepares the database name to be sent to stage.
        Filtering happens here.
        """
        for _, dbt_test in self.context.dbt_tests.items():
            yield dbt_test
    
    @abstractmethod
    def create_dbt_tests_suite(self, dbt_test: dict) -> CreateTestSuiteRequest:
        """
        After everything has been processed, add the tests suite and test definitions
        """
    
    @abstractmethod
    def create_dbt_tests_suite_definition(self, dbt_test: dict) -> CreateTestDefinitionRequest:
        """
        After everything has been processed, add the tests suite and test definitions
        """

    @abstractmethod
    def create_dbt_test_case(self, dbt_test: dict) -> CreateTestCaseRequest:
        """
        After test suite and test definitions have been processed, add the tests cases info
        """

    @abstractmethod
    def update_dbt_test_result(self, dbt_test: dict):
        """
        After test suite and test definitions have been processed, add the tests cases info
        """
