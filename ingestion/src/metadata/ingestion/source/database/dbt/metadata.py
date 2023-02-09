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
DBT source methods.
"""
import traceback
from enum import Enum
from typing import Iterable, List, Optional, Union

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import (
    Column,
    DataModel,
    ModelType,
    Table,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestDefinition,
    TestPlatform,
)
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.common_db_source import SQLSourceStatus
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.ingestion.source.database.dbt.dbt_service import (
    DbtFiles,
    DbtObjects,
    DbtServiceSource,
)
from metadata.utils import fqn
from metadata.utils.elasticsearch import get_entity_from_es_result
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Based on https://schemas.getdbt.com/dbt/manifest/v7/index.html
REQUIRED_MANIFEST_KEYS = ["name", "schema", "resource_type"]

# Based on https://schemas.getdbt.com/dbt/catalog/v1.json
REQUIRED_CATALOG_KEYS = ["name", "type", "index"]


class SkipResourceTypeEnum(Enum):
    """
    Enum for nodes to be skipped
    """

    ANALYSIS = "analysis"
    TEST = "test"


class CompiledQueriesEnum(Enum):
    """
    Enum for Compiled Queries
    """

    COMPILED_CODE = "compiled_code"
    COMPILED_SQL = "compiled_sql"


class RawQueriesEnum(Enum):
    """
    Enum for Raw Queries
    """

    RAW_CODE = "raw_code"
    RAW_SQL = "raw_sql"


class DbtTestSuccessEnum(Enum):
    """
    Enum for success messages of dbt tests
    """

    SUCCESS = "success"
    PASS = "pass"


class DbtTestFailureEnum(Enum):
    """
    Enum for failure message of dbt tests
    """

    FAILURE = "failure"
    FAIL = "fail"


class DbtCommonEnum(Enum):
    """
    Common enum for dbt
    """

    OWNER = "owner"
    NODES = "nodes"
    SOURCES = "sources"
    RESOURCETYPE = "resource_type"
    MANIFEST_NODE = "manifest_node"
    UPSTREAM = "upstream"
    RESULTS = "results"
    TEST_SUITE_NAME = "test_suite_name"
    DBT_TEST_SUITE = "DBT_TEST_SUITE"


class InvalidServiceException(Exception):
    """
    The service passed in config is not found
    """


class DbtSource(DbtServiceSource):  # pylint: disable=too-many-public-methods
    """
    Class defines method to extract metadata from DBT
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        self.config = config
        self.source_config = self.config.sourceConfig.config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.report = SQLSourceStatus()
        self.tag_classification_name = (
            self.source_config.dbtClassificationName
            if self.source_config.dbtClassificationName
            else "dbtTags"
        )

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        return cls(config, metadata_config)

    def get_status(self) -> SourceStatus:
        return self.report

    def test_connection(self) -> None:
        """
        DBT does not need to connect to any source to process information
        """

    def prepare(self):
        """
        By default for DBT nothing is required to be prepared
        """
        database_service = self.metadata.get_by_name(
            entity=DatabaseService, fqn=self.config.serviceName
        )
        if not database_service:
            raise InvalidServiceException(
                f"Service with name {self.config.serviceName} not found"
            )

    def get_dbt_owner(self, manifest_node: dict, catalog_node: dict) -> Optional[str]:
        """
        Returns dbt owner
        """
        owner = None
        dbt_owner = None
        if catalog_node:
            dbt_owner = catalog_node.metadata.owner
        if manifest_node:
            dbt_owner = manifest_node.meta.get(DbtCommonEnum.OWNER.value)
        if dbt_owner:
            owner_name = dbt_owner
            user_owner_fqn = fqn.build(
                self.metadata, entity_type=User, user_name=owner_name
            )
            if user_owner_fqn:
                owner = self.metadata.get_entity_reference(
                    entity=User, fqn=user_owner_fqn
                )
            else:
                team_owner_fqn = fqn.build(
                    self.metadata, entity_type=Team, team_name=owner_name
                )
                if team_owner_fqn:
                    owner = self.metadata.get_entity_reference(
                        entity=Team, fqn=team_owner_fqn
                    )
                else:
                    logger.warning(
                        "Unable to ingest owner from DBT since no user or"
                        f" team was found with name {dbt_owner}"
                    )
        return owner

    def get_dbt_tag_labels(self, dbt_tags_list):
        return [
            TagLabel(
                tagFQN=fqn.build(
                    self.metadata,
                    entity_type=Tag,
                    classification_name=self.tag_classification_name,
                    tag_name=tag.replace(".", ""),
                ),
                labelType=LabelType.Automated,
                state=State.Confirmed,
                source=TagSource.Tag,
            )
            for tag in dbt_tags_list
        ] or None

    def check_columns(self, catalog_node):
        for catalog_key, catalog_column in catalog_node.get("columns").items():
            if all(
                required_catalog_key in catalog_column
                for required_catalog_key in REQUIRED_CATALOG_KEYS
            ):
                logger.info(f"Successfully Validated DBT Column: {catalog_key}")
            else:
                logger.warning(
                    f"Error validating DBT Column: {catalog_key}\n"
                    f"Please check if following keys exist for the column node: {REQUIRED_CATALOG_KEYS}"
                )

    def validate_dbt_files(self, dbt_files: DbtFiles):
        """
        Method to validate DBT files
        """
        # Validate the Manifest File
        logger.info("Validating Manifest File")

        if self.source_config.dbtConfigSource and dbt_files.dbt_manifest:
            manifest_entities = {
                **dbt_files.dbt_manifest[DbtCommonEnum.NODES.value],
                **dbt_files.dbt_manifest[DbtCommonEnum.SOURCES.value],
            }
            if dbt_files.dbt_catalog:
                catalog_entities = {
                    **dbt_files.dbt_catalog[DbtCommonEnum.NODES.value],
                    **dbt_files.dbt_catalog[DbtCommonEnum.SOURCES.value],
                }
            for key, manifest_node in manifest_entities.items():
                if manifest_node[DbtCommonEnum.RESOURCETYPE.value] in [
                    item.value for item in SkipResourceTypeEnum
                ]:
                    continue

                # Validate if all the required keys are present in the manifest nodes
                if all(
                    required_key in manifest_node
                    for required_key in REQUIRED_MANIFEST_KEYS
                ):
                    logger.info(f"Successfully Validated DBT Node: {key}")
                else:
                    logger.warning(
                        f"Error validating DBT Node: {key}\n"
                        f"Please check if following keys exist for the node: {REQUIRED_MANIFEST_KEYS}"
                    )

                # Validate the catalog file if it is passed
                if dbt_files.dbt_catalog:
                    catalog_node = catalog_entities.get(key)
                    if catalog_node and "columns" in catalog_node:
                        self.check_columns(catalog_node=catalog_node)
                    else:
                        logger.warning(
                            f"Unable to find the node or columns in the catalog file for dbt node: {key}"
                        )

    def yield_dbt_tags(
        self, dbt_objects: DbtObjects
    ) -> Iterable[OMetaTagAndClassification]:
        """
        Create and yeild tags from DBT
        """
        if self.source_config.dbtConfigSource and dbt_objects.dbt_manifest:
            manifest_entities = {
                **dbt_objects.dbt_manifest.nodes,
                **dbt_objects.dbt_manifest.sources,
            }
            logger.info("Processing DBT Tags")
            dbt_tags_list = []
            for key, manifest_node in manifest_entities.items():
                try:
                    if manifest_node.resource_type in [
                        item.value for item in SkipResourceTypeEnum
                    ]:
                        continue

                    # Add the tags from the model
                    model_tags = manifest_node.tags
                    if model_tags:
                        dbt_tags_list.extend(model_tags)

                    # Add the tags from the columns
                    for _, column in manifest_node.columns.items():
                        column_tags = column.tags
                        if column_tags:
                            dbt_tags_list.extend(column_tags)
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Unable to process DBT tags for node: f{key} - {exc}"
                    )
            try:
                # Create all the tags added
                dbt_tag_labels = self.get_dbt_tag_labels(dbt_tags_list)
                for tag_label in dbt_tag_labels or []:
                    yield OMetaTagAndClassification(
                        classification_request=CreateClassificationRequest(
                            name=self.tag_classification_name,
                            description="dbt classification",
                        ),
                        tag_request=CreateTagRequest(
                            classification=self.tag_classification_name,
                            name=tag_label.tagFQN.__root__.split(fqn.FQN_SEPARATOR)[1],
                            description="dbt Tags",
                        ),
                    )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Unexpected exception creating DBT tags: {exc}")

    def add_dbt_tests(
        self, key: str, manifest_node, manifest_entities, dbt_objects: DbtObjects
    ) -> None:
        """
        Method to append dbt test cases for later procssing
        """
        self.context.dbt_tests[key] = {DbtCommonEnum.MANIFEST_NODE.value: manifest_node}
        self.context.dbt_tests[key][
            DbtCommonEnum.UPSTREAM.value
        ] = self.parse_upstream_nodes(manifest_entities, manifest_node)
        self.context.dbt_tests[key][DbtCommonEnum.RESULTS.value] = next(
            (
                item
                for item in dbt_objects.dbt_run_results.results
                if item.unique_id == key
            ),
            None,
        )

    def yield_data_models(self, dbt_objects: DbtObjects) -> Iterable[DataModelLink]:
        """
        Yield the data models
        """
        if self.source_config.dbtConfigSource and dbt_objects.dbt_manifest:
            logger.info("Parsing DBT Data Models")
            manifest_entities = {
                **dbt_objects.dbt_manifest.nodes,
                **dbt_objects.dbt_manifest.sources,
            }
            if dbt_objects.dbt_catalog:
                catalog_entities = {
                    **dbt_objects.dbt_catalog.nodes,
                    **dbt_objects.dbt_catalog.sources,
                }
            self.context.data_model_links = []
            self.context.dbt_tests = {}
            for key, manifest_node in manifest_entities.items():
                try:

                    # If the run_results file is passed then only DBT tests will be processed
                    if (
                        dbt_objects.dbt_run_results
                        and manifest_node.resource_type.value
                        == SkipResourceTypeEnum.TEST.value
                    ):
                        # Test nodes will be processed further in the topology
                        self.add_dbt_tests(
                            key,
                            manifest_node=manifest_node,
                            manifest_entities=manifest_entities,
                            dbt_objects=dbt_objects,
                        )
                        continue

                    # Skip the analysis and test nodes
                    if manifest_node.resource_type.value in [
                        item.value for item in SkipResourceTypeEnum
                    ]:
                        logger.info(f"Skipping DBT node: {key}.")
                        continue

                    model_name = (
                        manifest_node.alias
                        if hasattr(manifest_node, "alias") and manifest_node.alias
                        else manifest_node.name
                    )
                    logger.info(f"Processing DBT node: {model_name}")

                    catalog_node = None
                    if dbt_objects.dbt_catalog:
                        catalog_node = catalog_entities.get(key)

                    dbt_table_tags_list = None
                    dbt_model_tag_labels = manifest_node.tags
                    if dbt_model_tag_labels:
                        dbt_table_tags_list = self.get_dbt_tag_labels(
                            dbt_model_tag_labels
                        )

                    dbt_compiled_query = self.get_dbt_compiled_query(manifest_node)
                    dbt_raw_query = self.get_dbt_raw_query(manifest_node)

                    datamodel_path = None
                    if manifest_node.original_file_path:
                        if (
                            hasattr(manifest_node, "root_path")
                            and manifest_node.root_path
                        ):
                            datamodel_path = f"{manifest_node.root_path}/{manifest_node.original_file_path}"
                        else:
                            datamodel_path = manifest_node.original_file_path

                    data_model_link = DataModelLink(
                        fqn=fqn.build(
                            self.metadata,
                            entity_type=Table,
                            service_name=self.config.serviceName,
                            database_name=manifest_node.database,
                            schema_name=manifest_node.schema_,
                            table_name=model_name,
                        ),
                        datamodel=DataModel(
                            modelType=ModelType.DBT,
                            description=manifest_node.description
                            if manifest_node.description
                            else None,
                            path=datamodel_path,
                            rawSql=dbt_raw_query if dbt_raw_query else "",
                            sql=dbt_compiled_query if dbt_compiled_query else "",
                            columns=self.parse_data_model_columns(
                                manifest_node, catalog_node
                            ),
                            upstream=self.parse_upstream_nodes(
                                manifest_entities, manifest_node
                            ),
                            owner=self.get_dbt_owner(
                                manifest_node=manifest_node, catalog_node=catalog_node
                            ),
                            tags=dbt_table_tags_list,
                        ),
                    )
                    yield data_model_link
                    self.context.data_model_links.append(data_model_link)
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Unexpected exception parsing DBT node:{model_name} - {exc}"
                    )

    def parse_upstream_nodes(self, manifest_entities, dbt_node):
        """
        Method to fetch the upstream nodes
        """
        upstream_nodes = []
        if (
            hasattr(dbt_node, "depends_on")
            and dbt_node.depends_on
            and dbt_node.depends_on.nodes
        ):
            for node in dbt_node.depends_on.nodes:
                try:
                    parent_node = manifest_entities[node]
                    table_name = (
                        parent_node.alias
                        if hasattr(parent_node, "alias") and parent_node.alias
                        else parent_node.name
                    )
                    parent_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.config.serviceName,
                        database_name=parent_node.database,
                        schema_name=parent_node.schema_,
                        table_name=table_name,
                    )
                    if parent_fqn:
                        upstream_nodes.append(parent_fqn)
                except Exception as exc:  # pylint: disable=broad-except
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Failed to parse the DBT node {node} to get upstream nodes: {exc}"
                    )
                    continue
        return upstream_nodes

    def parse_data_model_columns(
        self, manifest_node: dict, catalog_node: dict
    ) -> List[Column]:
        """
        Method to parse the DBT columns
        """
        columns = []
        manifest_columns = manifest_node.columns
        for key, manifest_column in manifest_columns.items():
            try:
                logger.info(f"Processing DBT column: {key}")
                # If catalog file is passed pass the column information from catalog file
                catalog_column = None
                if catalog_node and catalog_node.columns:
                    catalog_column = catalog_node.columns.get(key)
                column_name = (
                    catalog_column.name if catalog_column else manifest_column.name
                )
                column_description = None
                if catalog_column and catalog_column.comment:
                    column_description = catalog_column.comment

                columns.append(
                    Column(
                        name=column_name,
                        description=manifest_column.description
                        if manifest_column.description
                        else column_description,
                        dataType=ColumnTypeParser.get_column_type(
                            catalog_column.type
                            if catalog_column
                            else manifest_column.data_type
                        ),
                        dataLength=1,
                        ordinalPosition=catalog_column.index
                        if catalog_column
                        else None,
                        tags=self.get_dbt_tag_labels(manifest_column.tags),
                    )
                )
                logger.info(f"Successfully processed DBT column: {key}")
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(f"Failed to parse DBT column {column_name}: {exc}")

        return columns

    def create_dbt_lineage(
        self, data_model_link: DataModelLink
    ) -> Iterable[AddLineageRequest]:
        """
        Method to process DBT lineage from upstream nodes
        """
        logger.info(f"Processing DBT lineage for: {data_model_link.fqn.__root__}")

        # Get the table entity from ES
        to_es_result = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=data_model_link.fqn.__root__,
        )
        to_entity: Optional[Union[Table, List[Table]]] = get_entity_from_es_result(
            entity_list=to_es_result, fetch_multiple_entities=False
        )
        for upstream_node in data_model_link.datamodel.upstream:
            try:
                from_es_result = self.metadata.es_search_from_fqn(
                    entity_type=Table,
                    fqn_search_string=upstream_node,
                )
                from_entity: Optional[
                    Union[Table, List[Table]]
                ] = get_entity_from_es_result(
                    entity_list=from_es_result, fetch_multiple_entities=False
                )
                if from_entity and to_entity:
                    yield AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=from_entity.id.__root__,
                                type="table",
                            ),
                            toEntity=EntityReference(
                                id=to_entity.id.__root__,
                                type="table",
                            ),
                        )
                    )

            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Failed to parse the node {upstream_node} to capture lineage: {exc}"
                )

    def create_dbt_query_lineage(
        self, data_model_link: DataModelLink
    ) -> Iterable[AddLineageRequest]:
        """
        Method to process DBT lineage from queries
        """
        table_fqn = data_model_link.fqn.__root__
        logger.info(f"Processing DBT Query lineage for: {table_fqn}")

        try:
            source_elements = fqn.split(table_fqn)
            # remove service name from fqn to make it parseable in format db.schema.table
            query_fqn = fqn._build(  # pylint: disable=protected-access
                *source_elements[-3:]
            )
            query = (
                f"create table {query_fqn} as {data_model_link.datamodel.sql.__root__}"
            )
            connection_type = str(
                self.config.serviceConnection.__root__.config.type.value
            )
            dialect = ConnectionTypeDialectMapper.dialect_of(connection_type)
            lineages = get_lineage_by_query(
                self.metadata,
                query=query,
                service_name=source_elements[0],
                database_name=source_elements[1],
                schema_name=source_elements[2],
                dialect=dialect,
            )
            for lineage_request in lineages or []:
                yield lineage_request

        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to parse the query {data_model_link.datamodel.sql.__root__} to capture lineage: {exc}"
            )

    def process_dbt_descriptions(self, data_model_link: DataModelLink):
        """
        Method to process DBT descriptions using patch APIs
        """
        logger.info(f"Processing DBT Descriptions for: {data_model_link.fqn.__root__}")

        # Get the table entity from ES
        to_es_result = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=data_model_link.fqn.__root__,
        )
        to_entity: Optional[Union[Table, List[Table]]] = get_entity_from_es_result(
            entity_list=to_es_result, fetch_multiple_entities=False
        )
        if to_entity:
            try:
                data_model = data_model_link.datamodel
                # Patch table descriptions from DBT
                if data_model.description:
                    self.metadata.patch_description(
                        entity=Table,
                        entity_id=to_entity.id,
                        description=data_model.description.__root__,
                        force=self.source_config.dbtUpdateDescriptions,
                    )

                # Patch column descriptions from DBT
                for column in data_model.columns:
                    if column.description:
                        self.metadata.patch_column_description(
                            entity_id=to_entity.id,
                            column_name=column.name.__root__,
                            description=column.description.__root__,
                            force=self.source_config.dbtUpdateDescriptions,
                        )
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Failed to parse the node {data_model_link.fqn.__root__} to update dbt desctiption: {exc}"
                )

    def create_dbt_tests_suite(
        self, dbt_test: dict
    ) -> Iterable[CreateTestSuiteRequest]:
        """
        Method to add the DBT tests suites
        """
        try:
            manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
            if manifest_node:
                test_name = manifest_node.name
                logger.info(f"Processing DBT Tests Suite for node: {test_name}")
                test_suite_name = manifest_node.meta.get(
                    DbtCommonEnum.TEST_SUITE_NAME.value,
                    DbtCommonEnum.DBT_TEST_SUITE.value,
                )
                test_suite_desciption = manifest_node.meta.get(
                    "test_suite_desciption", ""
                )
                check_test_suite_exists = self.metadata.get_by_name(
                    fqn=test_suite_name, entity=TestSuite
                )
                if not check_test_suite_exists:
                    yield CreateTestSuiteRequest(
                        name=test_suite_name,
                        description=test_suite_desciption,
                    )
        except Exception as err:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to parse the node to capture tests {err}")

    def create_dbt_tests_suite_definition(
        self, dbt_test: dict
    ) -> Iterable[CreateTestDefinitionRequest]:
        """
        A Method to add DBT test definitions
        """
        try:
            manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
            if manifest_node:
                logger.info(
                    f"Processing DBT Tests Suite Definition for node: {manifest_node.name}"
                )
                check_test_definition_exists = self.metadata.get_by_name(
                    fqn=manifest_node.name,
                    entity=TestDefinition,
                )
                if not check_test_definition_exists:
                    column_name = manifest_node.column_name
                    if column_name:
                        entity_type = EntityType.COLUMN
                    else:
                        entity_type = EntityType.TABLE
                    yield CreateTestDefinitionRequest(
                        name=manifest_node.name,
                        description=manifest_node.description,
                        entityType=entity_type,
                        testPlatforms=[TestPlatform.DBT],
                        parameterDefinition=self.create_test_case_parameter_definitions(
                            manifest_node
                        ),
                    )
        except Exception as err:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to parse the node to capture tests {err}")

    def create_dbt_test_case(self, dbt_test: dict) -> Iterable[CreateTestCaseRequest]:
        """
        After test suite and test definitions have been processed, add the tests cases info
        """
        try:
            manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
            if manifest_node:
                logger.info(
                    f"Processing DBT Test Case Definition for node: {manifest_node.name}"
                )
                entity_link_list = self.generate_entity_link(dbt_test)
                for entity_link in entity_link_list:
                    test_suite_name = manifest_node.meta.get(
                        DbtCommonEnum.TEST_SUITE_NAME.value,
                        DbtCommonEnum.DBT_TEST_SUITE.value,
                    )
                    yield CreateTestCaseRequest(
                        name=manifest_node.name,
                        description=manifest_node.description,
                        testDefinition=EntityReference(
                            id=self.metadata.get_by_name(
                                fqn=manifest_node.name,
                                entity=TestDefinition,
                            ).id.__root__,
                            type="testDefinition",
                        ),
                        entityLink=entity_link,
                        testSuite=EntityReference(
                            id=self.metadata.get_by_name(
                                fqn=test_suite_name, entity=TestSuite
                            ).id.__root__,
                            type="testSuite",
                        ),
                        parameterValues=self.create_test_case_parameter_values(
                            dbt_test
                        ),
                    )
        except Exception as err:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to parse the node {manifest_node.name} to capture tests {err}"
            )

    def update_dbt_test_result(self, dbt_test: dict):
        """
        After test cases has been processed, add the tests results info
        """
        try:
            # Process the Test Status
            manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
            if manifest_node:
                logger.info(
                    f"Processing DBT Test Case Results for node: {manifest_node.name}"
                )
                dbt_test_result = dbt_test.get(DbtCommonEnum.RESULTS.value)
                test_case_status = TestCaseStatus.Aborted
                test_result_value = 0
                if dbt_test_result.status.value in [
                    item.value for item in DbtTestSuccessEnum
                ]:
                    test_case_status = TestCaseStatus.Success
                    test_result_value = 1
                elif dbt_test_result.status.value in [
                    item.value for item in DbtTestFailureEnum
                ]:
                    test_case_status = TestCaseStatus.Failed
                    test_result_value = 0

                # Process the Test Timings
                dbt_test_timings = dbt_test_result.timing
                dbt_test_completed_at = None
                for dbt_test_timing in dbt_test_timings:
                    if dbt_test_timing.name == "execute":
                        dbt_test_completed_at = dbt_test_timing.completed_at
                dbt_timestamp = None
                if dbt_test_completed_at:
                    dbt_timestamp = dbt_test_completed_at.timestamp()

                # Create the test case result object
                test_case_result = TestCaseResult(
                    timestamp=dbt_timestamp,
                    testCaseStatus=test_case_status,
                    testResultValue=[
                        TestResultValue(
                            name=dbt_test_result.unique_id,
                            value=str(test_result_value),
                        )
                    ],
                )

                # Create the test case fqns and add the results
                for table_fqn in dbt_test.get(DbtCommonEnum.UPSTREAM.value):
                    source_elements = table_fqn.split(fqn.FQN_SEPARATOR)
                    test_case_fqn = fqn.build(
                        self.metadata,
                        entity_type=TestCase,
                        service_name=self.config.serviceName,
                        database_name=source_elements[1],
                        schema_name=source_elements[2],
                        table_name=source_elements[3],
                        column_name=manifest_node.column_name,
                        test_case_name=manifest_node.name,
                    )
                    self.metadata.add_test_case_results(
                        test_results=test_case_result,
                        test_case_fqn=test_case_fqn,
                    )
        except Exception as err:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to capture tests results for node: {manifest_node.name} {err}"
            )

    def create_test_case_parameter_definitions(self, dbt_test):
        test_case_param_definition = [
            {
                "name": dbt_test.test_metadata.name,
                "displayName": dbt_test.test_metadata.name,
                "required": False,
            }
        ]
        return test_case_param_definition

    def create_test_case_parameter_values(self, dbt_test):
        manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
        values = manifest_node.test_metadata.kwargs.get("values")
        dbt_test_values = ""
        if values:
            dbt_test_values = ",".join(values)
        test_case_param_values = [
            {"name": manifest_node.test_metadata.name, "value": dbt_test_values}
        ]
        return test_case_param_values

    def generate_entity_link(self, dbt_test):
        """
        Method returns entity link
        """
        manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
        entity_link_list = []
        for table_fqn in dbt_test[DbtCommonEnum.UPSTREAM.value]:
            column_name = manifest_node.column_name
            if column_name:
                entity_link = (
                    f"<#E::table::" f"{table_fqn}" f"::columns::" f"{column_name}>"
                )
            else:
                entity_link = f"<#E::table::" f"{table_fqn}>"
            entity_link_list.append(entity_link)
        return entity_link_list

    def get_dbt_compiled_query(self, mnode) -> Optional[str]:
        if (
            hasattr(mnode, CompiledQueriesEnum.COMPILED_CODE.value)
            and mnode.compiled_code
        ):
            return mnode.compiled_code
        if (
            hasattr(mnode, CompiledQueriesEnum.COMPILED_SQL.value)
            and mnode.compiled_sql
        ):
            return mnode.compiled_sql
        logger.debug(f"Unable to get DBT compiled query for node - {mnode.name}")
        return None

    def get_dbt_raw_query(self, mnode) -> Optional[str]:
        if hasattr(mnode, RawQueriesEnum.RAW_CODE.value) and mnode.raw_code:
            return mnode.raw_code
        if hasattr(mnode, RawQueriesEnum.RAW_SQL.value) and mnode.raw_sql:
            return mnode.raw_sql
        logger.debug(f"Unable to get DBT compiled query for node - {mnode.name}")
        return None
