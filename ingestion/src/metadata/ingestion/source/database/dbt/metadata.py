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
from datetime import datetime
from typing import Iterable, List, Optional, Union

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import (
    Column,
    DataModel,
    ModelType,
    Table,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
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
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.table_metadata import ColumnDescription
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.ingestion.source.database.dbt.constants import (
    DBT_RUN_RESULT_DATE_FORMAT,
    REQUIRED_CATALOG_KEYS,
    REQUIRED_MANIFEST_KEYS,
    DbtCommonEnum,
    DbtTestFailureEnum,
    DbtTestSuccessEnum,
    SkipResourceTypeEnum,
)
from metadata.ingestion.source.database.dbt.dbt_service import (
    DbtFiles,
    DbtObjects,
    DbtServiceSource,
)
from metadata.ingestion.source.database.dbt.dbt_utils import (
    check_ephemeral_node,
    check_or_create_test_suite,
    create_test_case_parameter_definitions,
    create_test_case_parameter_values,
    generate_entity_link,
    get_corrected_name,
    get_data_model_path,
    get_dbt_compiled_query,
    get_dbt_model_name,
    get_dbt_raw_query,
)
from metadata.utils import fqn
from metadata.utils.elasticsearch import get_entity_from_es_result
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels
from metadata.utils.time_utils import convert_timestamp_to_milliseconds

logger = ingestion_logger()


class InvalidServiceException(Exception):
    """
    The service passed in config is not found
    """


class DbtSource(DbtServiceSource):
    """
    Class defines method to extract metadata from DBT
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.source_config = self.config.sourceConfig.config
        self.metadata = metadata
        self.tag_classification_name = (
            self.source_config.dbtClassificationName
            if self.source_config.dbtClassificationName
            else "dbtTags"
        )

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        return cls(config, metadata)

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

    def get_dbt_owner(
        self, manifest_node: dict, catalog_node: Optional[dict]
    ) -> Optional[str]:
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

    def check_columns(self, catalog_node):
        for catalog_key, catalog_column in catalog_node.get("columns").items():
            if all(
                required_catalog_key in catalog_column
                for required_catalog_key in REQUIRED_CATALOG_KEYS
            ):
                logger.debug(f"Successfully Validated DBT Column: {catalog_key}")
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
        logger.debug("Validating Manifest File")

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
                    logger.debug(f"Successfully Validated DBT Node: {key}")
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
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Create and yield tags from DBT
        """
        if (
            self.source_config.dbtConfigSource
            and dbt_objects.dbt_manifest
            and self.source_config.includeTags
        ):
            manifest_entities = {
                **dbt_objects.dbt_manifest.nodes,
                **dbt_objects.dbt_manifest.sources,
            }
            logger.debug("Processing DBT Tags")
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
                    yield Either(
                        left=StackTraceError(
                            name=key,
                            error=f"Unable to process DBT tags for node: f{key} - {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )
            try:
                # Create all the tags added
                dbt_tag_labels = [
                    fqn.build(
                        self.metadata,
                        Tag,
                        classification_name=self.tag_classification_name,
                        tag_name=tag_name,
                    )
                    for tag_name in dbt_tags_list
                ]
                yield from get_ometa_tag_and_classification(
                    tags=[
                        tag_label.split(fqn.FQN_SEPARATOR)[1]
                        for tag_label in dbt_tag_labels
                    ],
                    classification_name=self.tag_classification_name,
                    tag_description="dbt Tags",
                    classification_description="dbt classification",
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Tags and Classification",
                        error=f"Unexpected exception creating DBT tags: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def add_dbt_tests(
        self, key: str, manifest_node, manifest_entities, dbt_objects: DbtObjects
    ) -> None:
        """
        Method to append dbt test cases for later processing
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

    # pylint: disable=too-many-locals, too-many-branches
    def yield_data_models(
        self, dbt_objects: DbtObjects
    ) -> Iterable[Either[DataModelLink]]:
        """
        Yield the data models
        """
        if self.source_config.dbtConfigSource and dbt_objects.dbt_manifest:
            logger.debug("Parsing DBT Data Models")
            manifest_entities = {
                **dbt_objects.dbt_manifest.sources,
                **dbt_objects.dbt_manifest.nodes,
            }
            if dbt_objects.dbt_catalog:
                catalog_entities = {
                    **dbt_objects.dbt_catalog.sources,
                    **dbt_objects.dbt_catalog.nodes,
                }
            self.context.data_model_links = []
            self.context.dbt_tests = {}
            self.context.run_results_generate_time = None
            if (
                dbt_objects.dbt_run_results
                and dbt_objects.dbt_run_results.metadata.generated_at
            ):
                self.context.run_results_generate_time = (
                    dbt_objects.dbt_run_results.metadata.generated_at
                )
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

                    # Skip the ephemeral nodes since it is not materialized
                    if check_ephemeral_node(manifest_node):
                        logger.debug(f"Skipping ephemeral DBT node: {key}.")
                        continue

                    # Skip the analysis and test nodes
                    if manifest_node.resource_type.value in [
                        item.value for item in SkipResourceTypeEnum
                    ]:
                        logger.debug(f"Skipping DBT node: {key}.")
                        continue

                    model_name = get_dbt_model_name(manifest_node)

                    # Filter the dbt models based on filter patterns
                    filter_model = self.is_filtered(
                        database_name=get_corrected_name(manifest_node.database),
                        schema_name=get_corrected_name(manifest_node.schema_),
                        table_name=model_name,
                    )
                    if filter_model.is_filtered:
                        self.status.filter(filter_model.model_fqn, filter_model.message)
                        continue

                    logger.debug(f"Processing DBT node: {model_name}")

                    catalog_node = None
                    if dbt_objects.dbt_catalog:
                        catalog_node = catalog_entities.get(key)

                    dbt_table_tags_list = None
                    if manifest_node.tags:
                        dbt_table_tags_list = get_tag_labels(
                            metadata=self.metadata,
                            tags=manifest_node.tags,
                            classification_name=self.tag_classification_name,
                            include_tags=self.source_config.includeTags,
                        )

                    dbt_compiled_query = get_dbt_compiled_query(manifest_node)
                    dbt_raw_query = get_dbt_raw_query(manifest_node)

                    # Get the table entity from ES
                    # TODO: Change to get_by_name once the postgres case sensitive calls is fixed
                    table_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.config.serviceName,
                        database_name=get_corrected_name(manifest_node.database),
                        schema_name=get_corrected_name(manifest_node.schema_),
                        table_name=model_name,
                    )

                    table_entity: Optional[
                        Union[Table, List[Table]]
                    ] = get_entity_from_es_result(
                        entity_list=self.metadata.es_search_from_fqn(
                            entity_type=Table,
                            fqn_search_string=table_fqn,
                            fields="sourceHash",
                        ),
                        fetch_multiple_entities=False,
                    )

                    if table_entity:
                        data_model_link = DataModelLink(
                            table_entity=table_entity,
                            datamodel=DataModel(
                                modelType=ModelType.DBT,
                                resourceType=manifest_node.resource_type.value,
                                description=manifest_node.description
                                if manifest_node.description
                                else None,
                                path=get_data_model_path(manifest_node=manifest_node),
                                rawSql=dbt_raw_query if dbt_raw_query else "",
                                sql=dbt_compiled_query if dbt_compiled_query else "",
                                columns=self.parse_data_model_columns(
                                    manifest_node, catalog_node
                                ),
                                upstream=self.parse_upstream_nodes(
                                    manifest_entities, manifest_node
                                ),
                                owner=self.get_dbt_owner(
                                    manifest_node=manifest_node,
                                    catalog_node=catalog_node,
                                ),
                                tags=dbt_table_tags_list,
                            ),
                        )
                        yield Either(right=data_model_link)
                        self.context.data_model_links.append(data_model_link)
                    else:
                        logger.warning(
                            f"Unable to find the table '{table_fqn}' in OpenMetadata"
                            "Please check if the table exists and is ingested in OpenMetadata"
                            "Also name, database, schema of the manifest node matches with the table present "
                            "in OpenMetadata"
                        )
                except Exception as exc:
                    yield Either(
                        left=StackTraceError(
                            name=key,
                            error=f"Unexpected exception parsing DBT node due to {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def parse_upstream_nodes(self, manifest_entities, dbt_node):
        """
        Method to fetch the upstream nodes
        """
        upstream_nodes = []
        if (
            hasattr(dbt_node, "depends_on")
            and hasattr(dbt_node.depends_on, "nodes")
            and dbt_node.depends_on
            and dbt_node.depends_on.nodes
        ):
            for node in dbt_node.depends_on.nodes:
                try:
                    parent_node = manifest_entities[node]
                    table_name = get_dbt_model_name(parent_node)

                    filter_model = self.is_filtered(
                        database_name=get_corrected_name(parent_node.database),
                        schema_name=get_corrected_name(parent_node.schema_),
                        table_name=table_name,
                    )
                    if filter_model.is_filtered:
                        continue

                    # check if the node is an ephemeral node
                    # Recursively store the upstream of the ephemeral node in the upstream list
                    if check_ephemeral_node(parent_node):
                        upstream_nodes.extend(
                            self.parse_upstream_nodes(manifest_entities, parent_node)
                        )
                    else:
                        parent_fqn = fqn.build(
                            self.metadata,
                            entity_type=Table,
                            service_name=self.config.serviceName,
                            database_name=get_corrected_name(parent_node.database),
                            schema_name=get_corrected_name(parent_node.schema_),
                            table_name=table_name,
                        )

                        # check if the parent table exists in OM before adding it to the upstream list
                        # TODO: Change to get_by_name once the postgres case sensitive calls is fixed
                        parent_table_entity: Optional[
                            Union[Table, List[Table]]
                        ] = get_entity_from_es_result(
                            entity_list=self.metadata.es_search_from_fqn(
                                entity_type=Table, fqn_search_string=parent_fqn
                            ),
                            fetch_multiple_entities=False,
                        )
                        if parent_table_entity:
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
                logger.debug(f"Processing DBT column: {key}")
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
                        tags=get_tag_labels(
                            metadata=self.metadata,
                            tags=manifest_column.tags,
                            classification_name=self.tag_classification_name,
                            include_tags=self.source_config.includeTags,
                        ),
                    )
                )
                logger.debug(f"Successfully processed DBT column: {key}")
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(f"Failed to parse DBT column {column_name}: {exc}")

        return columns

    def create_dbt_lineage(
        self, data_model_link: DataModelLink
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Method to process DBT lineage from upstream nodes
        """
        to_entity: Table = data_model_link.table_entity
        logger.debug(
            f"Processing DBT lineage for: {to_entity.fullyQualifiedName.__root__}"
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
                    yield Either(
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=from_entity.id.__root__,
                                    type="table",
                                ),
                                toEntity=EntityReference(
                                    id=to_entity.id.__root__,
                                    type="table",
                                ),
                                lineageDetails=LineageDetails(
                                    source=LineageSource.DbtLineage
                                ),
                            )
                        )
                    )

            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Failed to parse the node {upstream_node} to capture lineage: {exc}"
                )

    def create_dbt_query_lineage(
        self, data_model_link: DataModelLink
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Method to process DBT lineage from queries
        """
        to_entity: Table = data_model_link.table_entity
        logger.debug(
            f"Processing DBT Query lineage for: {to_entity.fullyQualifiedName.__root__}"
        )

        try:
            source_elements = fqn.split(to_entity.fullyQualifiedName.__root__)
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
                timeout_seconds=self.source_config.parsingTimeoutLimit,
                lineage_source=LineageSource.DbtLineage,
            )
            for lineage_request in lineages or []:
                yield lineage_request

        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name=data_model_link.datamodel.sql.__root__,
                    error=(
                        f"Failed to parse the query {data_model_link.datamodel.sql.__root__}"
                        f" to capture lineage: {exc}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )

    def process_dbt_descriptions(self, data_model_link: DataModelLink):
        """
        Method to process DBT descriptions using patch APIs
        """
        table_entity: Table = data_model_link.table_entity
        logger.debug(
            f"Processing DBT Descriptions for: {table_entity.fullyQualifiedName.__root__}"
        )
        if table_entity:
            try:

                service_name, database_name, schema_name, table_name = fqn.split(
                    table_entity.fullyQualifiedName.__root__
                )
                data_model = data_model_link.datamodel
                force_override = False
                if (
                    data_model.resourceType != DbtCommonEnum.SOURCE.value
                    and self.source_config.dbtUpdateDescriptions
                ):
                    force_override = True

                # Patch table descriptions from DBT
                if data_model.description:
                    self.metadata.patch_description(
                        entity=Table,
                        source=table_entity,
                        description=data_model.description.__root__,
                        force=force_override,
                    )

                # Patch column descriptions from DBT
                column_descriptions = []
                for column in data_model.columns:
                    if column.description:
                        column_descriptions.append(
                            ColumnDescription(
                                column_fqn=fqn.build(
                                    self.metadata,
                                    entity_type=Column,
                                    service_name=service_name,
                                    database_name=database_name,
                                    schema_name=schema_name,
                                    table_name=table_name,
                                    column_name=column.name.__root__,
                                ),
                                description=column.description,
                            )
                        )
                self.metadata.patch_column_descriptions(
                    table=table_entity,
                    column_descriptions=column_descriptions,
                    force=force_override,
                )
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Failed to parse the node {table_entity.fullyQualifiedName.__root__} "
                    f"to update dbt description: {exc}"
                )

    def create_dbt_tests_definition(
        self, dbt_test: dict
    ) -> Iterable[Either[CreateTestDefinitionRequest]]:
        """
        A Method to add DBT test definitions
        """
        try:
            manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
            if manifest_node:
                logger.debug(
                    f"Processing DBT Tests Definition for node: {manifest_node.name}"
                )
                check_test_definition_exists = self.metadata.get_by_name(
                    fqn=manifest_node.name,
                    entity=TestDefinition,
                )
                if not check_test_definition_exists:
                    entity_type = EntityType.TABLE
                    if (
                        hasattr(manifest_node, "column_name")
                        and manifest_node.column_name
                    ):
                        entity_type = EntityType.COLUMN
                    yield Either(
                        right=CreateTestDefinitionRequest(
                            name=manifest_node.name,
                            description=manifest_node.description,
                            entityType=entity_type,
                            testPlatforms=[TestPlatform.DBT],
                            parameterDefinition=create_test_case_parameter_definitions(
                                manifest_node
                            ),
                            displayName=None,
                            owner=None,
                        )
                    )
        except Exception as err:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name="Test Definition",
                    error=f"Failed to parse the node to capture tests {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def create_dbt_test_case(
        self, dbt_test: dict
    ) -> Iterable[Either[CreateTestCaseRequest]]:
        """
        After test suite and test definitions have been processed, add the tests cases info
        """
        try:
            manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
            if manifest_node:
                logger.debug(f"Processing DBT Test Case for node: {manifest_node.name}")
                entity_link_list = generate_entity_link(dbt_test)
                for entity_link_str in entity_link_list:
                    test_suite = check_or_create_test_suite(
                        self.metadata, entity_link_str
                    )
                    yield Either(
                        right=CreateTestCaseRequest(
                            name=manifest_node.name,
                            description=manifest_node.description,
                            testDefinition=FullyQualifiedEntityName(
                                __root__=manifest_node.name
                            ),
                            entityLink=entity_link_str,
                            testSuite=test_suite.fullyQualifiedName,
                            parameterValues=create_test_case_parameter_values(dbt_test),
                            displayName=None,
                            owner=None,
                        )
                    )
        except Exception as err:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name="Test Cases",
                    error=f"Failed to parse the node to capture tests {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def add_dbt_test_result(self, dbt_test: dict):
        """
        After test cases has been processed, add the tests results info
        """
        try:
            # Process the Test Status
            manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
            if manifest_node:
                logger.debug(
                    f"Adding DBT Test Case Results for node: {manifest_node.name}"
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
                    dbt_timestamp = dbt_test_completed_at
                elif self.context.run_results_generate_time:
                    dbt_timestamp = self.context.run_results_generate_time

                # check if the timestamp is a str type and convert accordingly
                if isinstance(dbt_timestamp, str):
                    dbt_timestamp = datetime.strptime(
                        dbt_timestamp, DBT_RUN_RESULT_DATE_FORMAT
                    )

                # Create the test case result object
                test_case_result = TestCaseResult(
                    timestamp=convert_timestamp_to_milliseconds(
                        dbt_timestamp.timestamp()
                    ),
                    testCaseStatus=test_case_status,
                    testResultValue=[
                        TestResultValue(
                            name=dbt_test_result.unique_id,
                            value=str(test_result_value),
                        )
                    ],
                    sampleData=None,
                    result=None,
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
                        column_name=manifest_node.column_name
                        if hasattr(manifest_node, "column_name")
                        else None,
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

    def close(self):
        self.metadata.close()
