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
from typing import Dict, Iterable, List, Optional, Union

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    DataModel,
    ModelType,
    Table,
)
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
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
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils import fqn
from metadata.utils.elasticsearch import get_entity_from_es_result
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DBTMixin:

    """
    Class defines method to extract metadata from DBT
    """

    metadata: OpenMetadata

    def get_data_model(self, table_fqn: str) -> Optional[DataModel]:
        return self.data_models.get(table_fqn.lower())

    def get_dbt_owner(self, mnode: dict, cnode: dict) -> Optional[str]:
        """
        Returns dbt owner
        """
        owner = None
        if mnode and cnode:
            dbt_owner = mnode["meta"].get("owner") or cnode["metadata"].get("owner")
            if dbt_owner:
                owner_name = f"*{dbt_owner}*"
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

    def _parse_data_model(self):
        """
        Get all the DBT information and feed it to the Table Entity
        """
        if (
            self.source_config.dbtConfigSource
            and self.dbt_manifest
            and self.dbt_catalog
        ):
            logger.info("Parsing Data Models")
            self.manifest_entities = {
                **self.dbt_manifest["nodes"],
                **self.dbt_manifest["sources"],
            }
            self.catalog_entities = {
                **self.dbt_catalog["nodes"],
                **self.dbt_catalog["sources"],
            }
            for key, mnode in self.manifest_entities.items():
                try:
                    model_name = (
                        mnode["alias"] if "alias" in mnode.keys() else mnode["name"]
                    )
                    cnode = self.catalog_entities.get(key)
                    columns = (
                        self._parse_data_model_columns(model_name, mnode, cnode)
                        if cnode
                        else []
                    )

                    if mnode["resource_type"] == "test":
                        self.dbt_tests[key] = mnode
                        continue
                    if mnode["resource_type"] == "analysis":
                        continue
                    upstream_nodes = self._parse_data_model_upstream(mnode)
                    database = mnode["database"] if mnode["database"] else "default"
                    schema = mnode["schema"] if mnode["schema"] else "default"
                    dbt_table_tags_list = None
                    if mnode.get("tags"):
                        dbt_table_tags_list = [
                            TagLabel(
                                tagFQN=fqn.build(
                                    self.metadata,
                                    entity_type=Tag,
                                    tag_category_name="DBTTags",
                                    tag_name=tag,
                                ),
                                labelType=LabelType.Automated,
                                state=State.Confirmed,
                                source=TagSource.Tag,
                            )
                            for tag in mnode.get("tags")
                        ] or None

                    dbt_compiled_query = self.get_dbt_compiled_query(mnode)
                    dbt_raw_query = self.get_dbt_raw_query(mnode)

                    model = DataModel(
                        modelType=ModelType.DBT,
                        description=mnode.get("description")
                        if mnode.get("description")
                        else None,
                        path=f"{mnode['root_path']}/{mnode['original_file_path']}",
                        rawSql=dbt_raw_query if dbt_raw_query else "",
                        sql=dbt_compiled_query if dbt_compiled_query else "",
                        columns=columns,
                        upstream=upstream_nodes,
                        owner=self.get_dbt_owner(mnode=mnode, cnode=cnode),
                        tags=dbt_table_tags_list,
                    )
                    model_fqn = fqn.build(
                        self.metadata,
                        entity_type=DataModel,
                        service_name=self.config.serviceName,
                        database_name=database,
                        schema_name=schema,
                        model_name=model_name,
                    ).lower()
                    self.data_models[model_fqn] = model
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Unexpected exception parsing data model: {exc}")

    def _parse_data_model_upstream(self, mnode):
        upstream_nodes = []
        if "depends_on" in mnode and "nodes" in mnode["depends_on"]:
            for node in mnode["depends_on"]["nodes"]:
                try:
                    parent_node = self.manifest_entities[node]
                    parent_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.config.serviceName,
                        database_name=parent_node["database"]
                        if parent_node["database"]
                        else "default",
                        schema_name=parent_node["schema"]
                        if parent_node["schema"]
                        else "default",
                        table_name=parent_node["name"],
                    )
                    if parent_fqn:
                        upstream_nodes.append(parent_fqn)
                except Exception as exc:  # pylint: disable=broad-except
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Failed to parse the node {node} to capture lineage: {exc}"
                    )
                    continue
        return upstream_nodes

    def _parse_data_model_columns(
        self, _: str, mnode: Dict, cnode: Dict
    ) -> List[Column]:
        columns = []
        catalogue_columns = cnode.get("columns", {})
        manifest_columns = mnode.get("columns", {})
        for key in catalogue_columns:
            ccolumn = catalogue_columns[key]
            try:
                ctype = ccolumn["type"]
                description = manifest_columns.get(key.lower(), {}).get("description")
                if description is None:
                    description = ccolumn.get("comment")
                dbt_column_tags = manifest_columns.get(key.lower(), {}).get("tags")
                dbt_column_tags_list = None
                if dbt_column_tags:
                    dbt_column_tags_list = [
                        TagLabel(
                            tagFQN=fqn.build(
                                self.metadata,
                                entity_type=Tag,
                                tag_category_name="DBTTags",
                                tag_name=tag,
                            ),
                            labelType=LabelType.Automated,
                            state=State.Confirmed,
                            source=TagSource.Tag,
                        )
                        for tag in dbt_column_tags
                    ] or None

                col = Column(
                    name=ccolumn["name"].lower(),
                    description=description if description else None,
                    dataType=ColumnTypeParser.get_column_type(ctype),
                    dataLength=1,
                    ordinalPosition=ccolumn["index"],
                    tags=dbt_column_tags_list,
                )
                columns.append(col)
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(f"Failed to parse column {ccolumn['name']}: {exc}")

        return columns

    def process_dbt_lineage_and_descriptions(
        self,
    ) -> Iterable[AddLineageRequest]:
        """
        After everything has been processed, add the lineage info
        """
        logger.info("Processing DBT lineage and Descriptions")
        for data_model_name, data_model in self.data_models.items():
            to_es_result = self.metadata.es_search_from_fqn(
                entity_type=Table,
                fqn_search_string=data_model_name,
            )
            to_entity: Optional[Union[Table, List[Table]]] = get_entity_from_es_result(
                entity_list=to_es_result, fetch_multiple_entities=False
            )
            if to_entity:
                try:
                    # Patch table descriptions from DBT
                    if data_model.description:
                        self.metadata.patch_description(
                            entity=Table,
                            entity_id=to_entity.id,
                            description=data_model.description.__root__,
                            force=self.source_config.dbtConfigSource.dbtUpdateDescriptions,
                        )

                    # Patch column descriptions from DBT
                    for column in data_model.columns:
                        if column.description:
                            self.metadata.patch_column_description(
                                entity_id=to_entity.id,
                                column_name=column.name.__root__,
                                description=column.description.__root__,
                                force=self.source_config.dbtConfigSource.dbtUpdateDescriptions,
                            )
                except Exception as exc:  # pylint: disable=broad-except
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Failed to parse the node {upstream_node} to update dbt desctiption: {exc}"
                    )

            # Create Lineage from DBT Files
            for upstream_node in data_model.upstream:
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

            # Create Lineage from DBT Queries
            try:
                service_database_schema_table = fqn.split(data_model_name)
                target_table_fqn = ".".join(service_database_schema_table[1:])
                query = f"create table {target_table_fqn} as {data_model.sql.__root__}"
                lineages = get_lineage_by_query(
                    self.metadata,
                    query=query,
                    service_name=service_database_schema_table[0],
                    database_name=service_database_schema_table[1],
                    schema_name=service_database_schema_table[2],
                )
                for lineage_request in lineages or []:
                    yield lineage_request
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Failed to parse the query {data_model.sql.__root__} to capture lineage: {exc}"
                )

    def create_dbt_tests_suite_definition(self):
        """
        After everything has been processed, add the tests suite and test definitions
        """
        try:
            if (
                self.source_config.dbtConfigSource
                and self.dbt_manifest
                and self.dbt_catalog
                and self.dbt_run_results
            ):
                logger.info("Processing DBT Tests Suites and Test Definitions")
                for _, dbt_test in self.dbt_tests.items():
                    test_suite_name = dbt_test["meta"].get(
                        "test_suite_name", "DBT_TEST_SUITE"
                    )
                    test_suite_desciption = dbt_test["meta"].get(
                        "test_suite_desciption", ""
                    )
                    check_test_suite_exists = self.metadata.get_by_name(
                        fqn=test_suite_name, entity=TestSuite
                    )
                    if not check_test_suite_exists:
                        test_suite = CreateTestSuiteRequest(
                            name=test_suite_name,
                            description=test_suite_desciption,
                        )
                        yield test_suite
                    check_test_definition_exists = self.metadata.get_by_name(
                        fqn=dbt_test["name"],
                        entity=TestDefinition,
                    )
                    if not check_test_definition_exists:
                        column_name = dbt_test.get("column_name")
                        if column_name:
                            entity_type = EntityType.COLUMN
                        else:
                            entity_type = EntityType.TABLE
                        test_definition = CreateTestDefinitionRequest(
                            name=dbt_test["name"],
                            description=dbt_test["description"],
                            entityType=entity_type,
                            testPlatforms=[TestPlatform.DBT],
                            parameterDefinition=self.create_test_case_parameter_definitions(
                                dbt_test
                            ),
                        )
                        yield test_definition
        except Exception as err:  # pylint: disable=broad-except
            logger.error(f"Failed to parse the node to capture tests {err}")

    def create_dbt_test_cases(self):
        """
        After test suite and test definitions have been processed, add the tests cases info
        """
        if (
            self.source_config.dbtConfigSource
            and self.dbt_manifest
            and self.dbt_catalog
            and self.dbt_run_results
        ):
            logger.info("Processing DBT Tests Cases")
            for key, dbt_test in self.dbt_tests.items():
                try:
                    entity_link_list = self.generate_entity_link(dbt_test)
                    for entity_link in entity_link_list:
                        test_suite_name = dbt_test["meta"].get(
                            "test_suite_name", "DBT_TEST_SUITE"
                        )
                        test_case = CreateTestCaseRequest(
                            name=dbt_test["name"],
                            description=dbt_test["description"],
                            testDefinition=EntityReference(
                                id=self.metadata.get_by_name(
                                    fqn=dbt_test["name"],
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
                        yield test_case
                except Exception as err:  # pylint: disable=broad-except
                    logger.error(
                        f"Failed to parse the node {key} to capture tests {err}"
                    )
            self.update_dbt_test_result()

    def update_dbt_test_result(self):
        """
        After test cases has been processed, add the tests results info
        """
        if self.dbt_run_results:
            logger.info("Processing DBT Tests Results")
            for dbt_test_result in self.dbt_run_results.get("results"):
                try:
                    # Process the Test Status
                    test_case_status = TestCaseStatus.Aborted
                    test_result_value = 0
                    if dbt_test_result.get("status") in {"success", "pass"}:
                        test_case_status = TestCaseStatus.Success
                        test_result_value = 1
                    elif dbt_test_result.get("status") in {"failure", "fail"}:
                        test_case_status = TestCaseStatus.Failed
                        test_result_value = 0

                    # Process the Test Timings
                    dbt_test_timings = dbt_test_result["timing"]
                    dbt_test_completed_at = None
                    for dbt_test_timing in dbt_test_timings:
                        if dbt_test_timing.get("name", "") == "execute":
                            dbt_test_completed_at = dbt_test_timing.get("completed_at")
                    dbt_timestamp = None
                    if dbt_test_completed_at:
                        dbt_timestamp = datetime.strptime(
                            dbt_test_completed_at, "%Y-%m-%dT%H:%M:%S.%fZ"
                        ).replace(microsecond=0)
                        dbt_timestamp = dbt_timestamp.timestamp()

                    test_case_result = TestCaseResult(
                        timestamp=dbt_timestamp,
                        testCaseStatus=test_case_status,
                        testResultValue=[
                            TestResultValue(
                                name=dbt_test_result.get("unique_id"),
                                value=str(test_result_value),
                            )
                        ],
                    )

                    dbt_test_node = self.dbt_tests.get(dbt_test_result["unique_id"])
                    if dbt_test_node:
                        nodes = dbt_test_node["depends_on"]["nodes"]
                        for node in nodes:
                            model = self.manifest_entities.get(node)
                            test_case_fqn = fqn.build(
                                self.metadata,
                                entity_type=TestCase,
                                service_name=self.config.serviceName,
                                database_name=model["database"]
                                if model["database"]
                                else "default",
                                schema_name=model["schema"]
                                if model["schema"]
                                else "default",
                                table_name=model.get("name"),
                                column_name=dbt_test_node.get("column_name"),
                                test_case_name=self.dbt_tests.get(
                                    dbt_test_result["unique_id"]
                                )["name"],
                            )
                            self.metadata.add_test_case_results(
                                test_results=test_case_result,
                                test_case_fqn=test_case_fqn,
                            )
                except Exception as err:  # pylint: disable=broad-except
                    logger.error(f"Failed capture tests results {err}")

    def create_test_case_parameter_definitions(self, dbt_test):
        test_case_param_definition = [
            {
                "name": dbt_test["test_metadata"]["name"],
                "displayName": dbt_test["test_metadata"]["name"],
                "required": False,
            }
        ]
        return test_case_param_definition

    def create_test_case_parameter_values(self, dbt_test):
        values = dbt_test["test_metadata"]["kwargs"].get("values")
        dbt_test_values = ""
        if values:
            dbt_test_values = ",".join(values)
        test_case_param_values = [
            {"name": dbt_test["test_metadata"]["name"], "value": dbt_test_values}
        ]
        return test_case_param_values

    def generate_entity_link(self, dbt_test):
        """
        Method returns entity link
        """
        nodes = dbt_test["depends_on"]["nodes"]
        entity_link_list = []
        for node in nodes:
            model = self.manifest_entities.get(node)
            table_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=self.config.serviceName,
                database_name=model["database"] if model["database"] else "default",
                schema_name=model["schema"] if model["schema"] else "default",
                table_name=model.get("name"),
            )
            column_name = dbt_test.get("column_name")
            if column_name:
                entity_link = (
                    f"<#E::table::" f"{table_fqn}" f"::columns::" f"{column_name}>"
                )
            else:
                entity_link = f"<#E::table::" f"{table_fqn}>"
            entity_link_list.append(entity_link)
        return entity_link_list

    def get_dbt_compiled_query(self, mnode) -> Optional[str]:
        dbt_query_key_names = ["compiled_sql", "compiled_code"]
        for key_name in dbt_query_key_names:
            query = mnode.get(key_name)
            if query:
                return query
        logger.debug(
            f"Unable to get DBT compiled query for node - {mnode.get('name','unknown')}"
        )
        return None

    def get_dbt_raw_query(self, mnode) -> Optional[str]:
        dbt_query_key_names = ["raw_sql", "raw_code"]
        for key_name in dbt_query_key_names:
            query = mnode.get(key_name)
            if query:
                return query
        logger.debug(
            f"Unable to get DBT raw query for node - {mnode.get('name','unknown')}"
        )
        return None
