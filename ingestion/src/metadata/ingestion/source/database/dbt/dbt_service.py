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
from typing import Iterable, List

from collate_dbt_artifacts_parser.parser import (
    parse_catalog,
    parse_manifest,
    parse_run_results,
    parse_sources,
)
from pydantic import Field
from typing_extensions import Annotated

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.metadataIngestion.dbtPipeline import DbtPipeline
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Source
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyContextManager,
    TopologyNode,
)
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.ingestion.source.database.dbt.constants import (
    REQUIRED_CONSTRAINT_KEYS,
    REQUIRED_NODE_KEYS,
    REQUIRED_RESULTS_KEYS,
)
from metadata.ingestion.source.database.dbt.dbt_config import get_dbt_details
from metadata.ingestion.source.database.dbt.models import (
    DbtFiles,
    DbtFilteredModel,
    DbtObjects,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DbtServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in dbt Services.
    dbt files -> dbt tags -> data models -> descriptions -> lineage -> tests.
    """

    root: Annotated[
        TopologyNode, Field(description="Root node for the topology")
    ] = TopologyNode(
        producer="get_dbt_files",
        stages=[
            NodeStage(
                type_=DbtFiles,
                processor="validate_dbt_files",
                nullable=True,
            )
        ],
        children=[
            "process_dbt_data_model",
            "process_dbt_entities",
            "process_dbt_tests",
        ],
    )
    process_dbt_data_model: Annotated[
        TopologyNode, Field(description="Process dbt data models")
    ] = TopologyNode(
        producer="get_dbt_objects",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_dbt_tags",
                nullable=True,
                store_all_in_context=True,
            ),
            NodeStage(
                type_=DataModelLink,
                processor="yield_data_models",
                nullable=True,
                consumer=["validate_dbt_files"],
            ),
        ],
    )
    process_dbt_entities: Annotated[
        TopologyNode, Field(description="Process dbt entities")
    ] = TopologyNode(
        producer="get_data_model",
        stages=[
            NodeStage(
                type_=AddLineageRequest,
                processor="create_dbt_lineage",
                consumer=["yield_data_models"],
            ),
            NodeStage(
                type_=AddLineageRequest,
                processor="create_dbt_query_lineage",
            ),
            NodeStage(
                type_=DataModelLink,
                processor="process_dbt_descriptions",
                nullable=True,
            ),
            NodeStage(
                type_=DataModelLink,
                processor="process_dbt_owners",
                nullable=True,
            ),
        ],
    )
    process_dbt_tests: Annotated[
        TopologyNode, Field(description="Process dbt tests")
    ] = TopologyNode(
        producer="get_dbt_tests",
        stages=[
            NodeStage(
                type_=CreateTestDefinitionRequest,
                processor="create_dbt_tests_definition",
                consumer=["yield_data_models"],
            ),
            NodeStage(
                type_=CreateTestCaseRequest,
                processor="create_dbt_test_case",
            ),
            NodeStage(
                type_=TestCaseResult,
                processor="add_dbt_test_result",
                nullable=True,
            ),
        ],
    )


class DbtServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Class for defining the topology of the DBT source
    """

    topology = DbtServiceTopology()
    context = TopologyContextManager(topology)
    source_config: DbtPipeline

    @property
    def name(self) -> str:
        return "dbt"

    def remove_manifest_non_required_keys(self, manifest_dict: dict):
        """
        Method to remove the non required keys from manifest file
        """
        # To ensure smooth ingestion of data,
        # we are selectively processing the metadata, nodes, and sources from the manifest file
        # while trimming out any other irrelevant data that might be present.
        # This step is necessary as the manifest file may not always adhere to the schema definition
        # and the presence of other nodes can hinder the ingestion process from progressing any further.
        # Therefore, we are only retaining the essential data for further processing.
        required_manifest_keys = {"nodes", "sources", "metadata"}
        manifest_dict.update(
            {
                key: {}
                for key in manifest_dict
                if key.lower() not in required_manifest_keys
            }
        )

        for field in ["nodes", "sources"]:
            for node, value in manifest_dict.get(  # pylint: disable=unused-variable
                field
            ).items():
                keys_to_delete = [
                    key for key in value if key.lower() not in REQUIRED_NODE_KEYS
                ]
                for key in keys_to_delete:
                    del value[key]
                if value.get("columns"):
                    for col_name, value in value[
                        "columns"
                    ].items():  # pylint: disable=unused-variable
                        if value.get("constraints"):
                            keys_to_delete = [
                                key
                                for key in value
                                if key.lower() not in REQUIRED_CONSTRAINT_KEYS
                            ]
                            for key in keys_to_delete:
                                del value[key]
                        else:
                            value["constraints"] = None

    def remove_run_result_non_required_keys(self, run_results: List[dict]):
        """
        Method to remove the non required keys from run results file
        """
        for run_result in run_results:
            for result in run_result.get("results"):
                keys_to_delete = [
                    key for key in result if key.lower() not in REQUIRED_RESULTS_KEYS
                ]
                for key in keys_to_delete:
                    del result[key]

    def get_dbt_files(self) -> Iterable[DbtFiles]:
        dbt_files = get_dbt_details(self.source_config.dbtConfigSource)
        for dbt_file in dbt_files:
            self.context.get().dbt_file = dbt_file
            yield dbt_file

    def get_dbt_objects(self) -> Iterable[DbtObjects]:
        self.remove_manifest_non_required_keys(
            manifest_dict=self.context.get().dbt_file.dbt_manifest
        )
        if self.context.get().dbt_file.dbt_run_results:
            self.remove_run_result_non_required_keys(
                run_results=self.context.get().dbt_file.dbt_run_results
            )

        dbt_objects = DbtObjects(
            dbt_catalog=parse_catalog(self.context.get().dbt_file.dbt_catalog)
            if self.context.get().dbt_file.dbt_catalog
            else None,
            dbt_manifest=parse_manifest(self.context.get().dbt_file.dbt_manifest),
            dbt_sources=parse_sources(self.context.get().dbt_file.dbt_sources)
            if self.context.get().dbt_file.dbt_sources
            else None,
            dbt_run_results=[
                parse_run_results(run_result_file)
                for run_result_file in self.context.get().dbt_file.dbt_run_results
            ]
            if self.context.get().dbt_file.dbt_run_results
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
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Create and yield tags from DBT
        """

    @abstractmethod
    def yield_data_models(self, dbt_objects: DbtObjects) -> DataModelLink:
        """
        Yield the data models
        """

    def get_data_model(self) -> Iterable[DataModelLink]:
        """
        Prepare the data models
        """
        yield from self.context.get().data_model_links

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

    @abstractmethod
    def process_dbt_owners(self, data_model_link: DataModelLink):
        """
        Method to process DBT owners using patch APIs
        """

    def get_dbt_tests(self) -> dict:
        """
        Prepare the DBT tests
        """
        for _, dbt_test in self.context.get().dbt_tests.items():
            yield dbt_test

    @abstractmethod
    def create_dbt_tests_definition(
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
    def add_dbt_test_result(self, dbt_test: dict):
        """
        After test cases has been processed, add the tests results info
        """

    def is_filtered(
        self, database_name: str, schema_name: str, table_name: str
    ) -> DbtFilteredModel:
        """
        Function used to identify the filtered models
        """
        # pylint: disable=protected-access
        model_fqn = fqn._build(str(database_name), str(schema_name), str(table_name))
        is_filtered = False
        reason = None
        message = None

        if filter_by_table(self.source_config.tableFilterPattern, table_name):
            reason = "table"
            is_filtered = True
        if filter_by_schema(self.source_config.schemaFilterPattern, schema_name):
            reason = "schema"
            is_filtered = True
        if filter_by_database(self.source_config.databaseFilterPattern, database_name):
            reason = "database"
            is_filtered = True
        if is_filtered:
            message = f"Model Filtered due to {reason} filter pattern"
        return DbtFilteredModel(
            is_filtered=is_filtered, message=message, model_fqn=model_fqn
        )
