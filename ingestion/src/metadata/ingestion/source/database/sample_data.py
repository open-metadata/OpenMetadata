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
Sample Data source ingestion
"""
import json
import random
import traceback
from collections import namedtuple
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Union

from pydantic import ValidationError

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.mlmodel import (
    FeatureSource,
    MlFeature,
    MlHyperParameter,
    MlStore,
)
from metadata.generated.schema.entity.data.pipeline import Pipeline, PipelineStatus
from metadata.generated.schema.entity.data.table import (
    ColumnProfile,
    SystemProfile,
    Table,
    TableProfile,
)
from metadata.generated.schema.entity.policies.policy import Policy
from metadata.generated.schema.entity.services.connections.database.customDatabaseConnection import (
    CustomDatabaseConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestResultValue
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.schema import Topic
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.models.profile_data import OMetaTableProfileSampleData
from metadata.ingestion.models.tests_data import (
    OMetaTestCaseResultsSample,
    OMetaTestCaseSample,
    OMetaTestSuiteSample,
)
from metadata.ingestion.models.user import OMetaUserProfile
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.parsers.schema_parsers import (
    InvalidSchemaTypeException,
    schema_parser_config_registry,
)
from metadata.utils import fqn
from metadata.utils.constants import UTF_8
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

COLUMN_NAME = "Column"
KEY_TYPE = "Key type"
DATA_TYPE = "Data type"
COL_DESCRIPTION = "Description"
TableKey = namedtuple("TableKey", ["schema", "table_name"])


class InvalidSampleDataException(Exception):
    """
    Sample data is not valid to be ingested
    """


def get_lineage_entity_ref(edge, metadata_config) -> EntityReference:
    metadata = OpenMetadata(metadata_config)
    edge_fqn = edge["fqn"]
    if edge["type"] == "table":
        table = metadata.get_by_name(entity=Table, fqn=edge_fqn)
        if table:
            return EntityReference(id=table.id, type="table")
    if edge["type"] == "pipeline":
        pipeline = metadata.get_by_name(entity=Pipeline, fqn=edge_fqn)
        if pipeline:
            return EntityReference(id=pipeline.id, type="pipeline")
    if edge["type"] == "dashboard":
        dashboard = metadata.get_by_name(entity=Dashboard, fqn=edge_fqn)
        if dashboard:
            return EntityReference(id=dashboard.id, type="dashboard")
    if edge["type"] == "dashboardDataModel":
        data_model = metadata.get_by_name(entity=DashboardDataModel, fqn=edge_fqn)
        if data_model:
            return EntityReference(id=data_model.id, type="dashboardDataModel")
    return None


def get_table_key(row: Dict[str, Any]) -> Union[TableKey, None]:
    """
    Table key consists of schema and table name
    :param row:
    :return:
    """
    return TableKey(schema=row["schema"], table_name=row["table_name"])


class SampleDataSource(
    Source[Entity]
):  # pylint: disable=too-many-instance-attributes,too-many-public-methods
    """
    Loads JSON data and prepares the required
    python objects to be sent to the Sink.
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.config = config
        self.service_connection = config.serviceConnection.__root__.config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.list_policies = []

        sample_data_folder = self.service_connection.connectionOptions.__root__.get(
            "sampleDataFolder"
        )
        if not sample_data_folder:
            raise InvalidSampleDataException(
                "Cannot get sampleDataFolder from connection options"
            )
        self.glue_database_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/glue/database_service.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.glue_database = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/glue/database.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.glue_database_schema = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/glue/database_schema.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.glue_tables = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/glue/tables.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.glue_database_service = self.metadata.get_service_or_create(
            entity=DatabaseService,
            config=WorkflowSource(**self.glue_database_service_json),
        )
        self.database_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/datasets/service.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.database = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/datasets/database.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.database_schema = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/datasets/database_schema.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.tables = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/datasets/tables.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.database_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/datasets/service.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.database_service = self.metadata.get_service_or_create(
            entity=DatabaseService, config=WorkflowSource(**self.database_service_json)
        )

        self.kafka_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/topics/service.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.topics = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/topics/topics.json",
                "r",
                encoding=UTF_8,
            )
        )

        self.kafka_service = self.metadata.get_service_or_create(
            entity=MessagingService, config=WorkflowSource(**self.kafka_service_json)
        )

        self.dashboard_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/dashboards/service.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.charts = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/dashboards/charts.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.data_models = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/dashboards/dashboardDataModels.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.dashboards = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/dashboards/dashboards.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.dashboard_service = self.metadata.get_service_or_create(
            entity=DashboardService,
            config=WorkflowSource(**self.dashboard_service_json),
        )

        self.pipeline_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/pipelines/service.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.pipelines = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/pipelines/pipelines.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.pipeline_service = self.metadata.get_service_or_create(
            entity=PipelineService, config=WorkflowSource(**self.pipeline_service_json)
        )
        self.lineage = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/lineage/lineage.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.teams = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/teams/teams.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.users = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/users/users.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.model_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/models/service.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.model_service = self.metadata.get_service_or_create(
            entity=MlModelService,
            config=WorkflowSource(**self.model_service_json),
        )

        self.storage_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/storage/service.json",
                "r",
                encoding=UTF_8,
            )
        )

        self.storage_service = self.metadata.get_service_or_create(
            entity=StorageService,
            config=WorkflowSource(**self.storage_service_json),
        )

        self.models = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/models/models.json",
                "r",
                encoding=UTF_8,
            )
        )

        self.containers = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/storage/containers.json",
                "r",
                encoding=UTF_8,
            )
        )

        self.user_entity = {}
        self.table_tests = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/datasets/tableTests.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.pipeline_status = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/pipelines/pipelineStatus.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.profiles = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/profiler/tableProfile.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.tests_suites = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/tests/testSuites.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.tests_case_results = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/tests/testCaseResults.json",
                "r",
                encoding=UTF_8,
            )
        )

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: CustomDatabaseConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, CustomDatabaseConnection):
            raise InvalidSourceException(
                f"Expected CustomDatabaseConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Entity]:
        yield from self.ingest_teams()
        yield from self.ingest_users()
        yield from self.ingest_glue()
        yield from self.ingest_tables()
        yield from self.ingest_topics()
        yield from self.ingest_charts()
        yield from self.ingest_data_models()
        yield from self.ingest_dashboards()
        yield from self.ingest_pipelines()
        yield from self.ingest_lineage()
        yield from self.ingest_pipeline_status()
        yield from self.ingest_mlmodels()
        yield from self.ingest_containers()
        yield from self.ingest_profiles()
        yield from self.ingest_test_suite()
        yield from self.ingest_test_case()
        yield from self.ingest_test_case_results()

    def ingest_teams(self):
        """
        Ingest sample teams
        """
        for team in self.teams["teams"]:
            team_to_ingest = CreateTeamRequest(
                name=team["name"], teamType=team["teamType"]
            )
            if team["parent"] is not None:
                parent_list_id = []
                for parent in team["parent"]:
                    tries = 3
                    parent_object = self.metadata.get_by_name(entity=Team, fqn=parent)
                    while not parent_object and tries > 0:
                        logger.info(f"Trying to GET {parent} Parent Team")
                        parent_object = self.metadata.get_by_name(
                            entity=Team,
                            fqn=parent,
                        )
                        tries -= 1

                    if parent_object:
                        parent_list_id.append(parent_object.id)

                team_to_ingest.parents = parent_list_id

            yield team_to_ingest

    def ingest_glue(self):
        """
        Ingest Sample Data for glue database source
        """
        db = CreateDatabaseRequest(
            name=self.database["name"],
            description=self.database["description"],
            service=self.database_service.fullyQualifiedName,
        )

        yield db

        database_entity = fqn.build(
            self.metadata,
            entity_type=Database,
            service_name=self.database_service.name.__root__,
            database_name=db.name.__root__,
        )

        database_object = self.metadata.get_by_name(
            entity=Database, fqn=database_entity
        )
        schema = CreateDatabaseSchemaRequest(
            name=self.database_schema["name"],
            description=self.database_schema["description"],
            database=database_object.fullyQualifiedName,
        )
        yield schema

        database_schema_entity = fqn.build(
            self.metadata,
            entity_type=DatabaseSchema,
            service_name=self.database_service.name.__root__,
            database_name=db.name.__root__,
            schema_name=schema.name.__root__,
        )

        database_schema_object = self.metadata.get_by_name(
            entity=DatabaseSchema, fqn=database_schema_entity
        )

        for table in self.glue_tables["tables"]:
            table_request = CreateTableRequest(
                name=table["name"],
                description=table["description"],
                columns=table["columns"],
                databaseSchema=database_schema_object.fullyQualifiedName,
                tableConstraints=table.get("tableConstraints"),
                tableType=table["tableType"],
            )
            self.status.scanned(f"Table Scanned: {table_request.name.__root__}")
            yield table_request

    def ingest_tables(self):
        """
        Ingest Sample Tables
        """

        db = CreateDatabaseRequest(
            name=self.database["name"],
            description=self.database["description"],
            service=self.database_service.fullyQualifiedName.__root__,
        )
        yield db

        database_entity = fqn.build(
            self.metadata,
            entity_type=Database,
            service_name=self.database_service.name.__root__,
            database_name=db.name.__root__,
        )

        database_object = self.metadata.get_by_name(
            entity=Database, fqn=database_entity
        )

        schema = CreateDatabaseSchemaRequest(
            name=self.database_schema["name"],
            description=self.database_schema["description"],
            database=database_object.fullyQualifiedName,
        )
        yield schema

        database_schema_entity = fqn.build(
            self.metadata,
            entity_type=DatabaseSchema,
            service_name=self.database_service.name.__root__,
            database_name=db.name.__root__,
            schema_name=schema.name.__root__,
        )

        database_schema_object = self.metadata.get_by_name(
            entity=DatabaseSchema, fqn=database_schema_entity
        )

        resp = self.metadata.list_entities(entity=User, limit=5)
        self.user_entity = resp.entities

        for table in self.tables["tables"]:
            table_and_db = CreateTableRequest(
                name=table["name"],
                description=table["description"],
                columns=table["columns"],
                databaseSchema=database_schema_object.fullyQualifiedName,
                tableType=table["tableType"],
                tableConstraints=table.get("tableConstraints"),
                tags=table["tags"],
            )

            self.status.scanned(f"Table Scanned: {table_and_db.name}")
            yield table_and_db

    def ingest_topics(self) -> Iterable[CreateTopicRequest]:
        """
        Ingest Sample Topics
        """
        for topic in self.topics["topics"]:
            topic["service"] = EntityReference(
                id=self.kafka_service.id, type="messagingService"
            )
            create_topic = CreateTopicRequest(
                name=topic["name"],
                description=topic["description"],
                partitions=topic["partitions"],
                retentionSize=topic["retentionSize"],
                replicationFactor=topic["replicationFactor"],
                maximumMessageSize=topic["maximumMessageSize"],
                cleanupPolicies=topic["cleanupPolicies"],
                service=self.kafka_service.fullyQualifiedName,
            )

            if "schemaType" in topic:
                schema_type = topic["schemaType"].lower()
                load_parser_fn = schema_parser_config_registry.registry.get(schema_type)
                if not load_parser_fn:
                    raise InvalidSchemaTypeException(
                        f"Cannot find {schema_type} in parser providers registry."
                    )
                schema_fields = load_parser_fn(topic["name"], topic["schemaText"])

                create_topic.messageSchema = Topic(
                    schemaText=topic["schemaText"],
                    schemaType=topic["schemaType"],
                    schemaFields=schema_fields,
                )

            self.status.scanned(f"Topic Scanned: {create_topic.name.__root__}")
            yield create_topic

    def ingest_charts(self) -> Iterable[CreateChartRequest]:
        for chart in self.charts["charts"]:
            try:
                chart_ev = CreateChartRequest(
                    name=chart["name"],
                    displayName=chart["displayName"],
                    description=chart["description"],
                    chartType=get_standard_chart_type(chart["chartType"]),
                    chartUrl=chart["chartUrl"],
                    service=self.dashboard_service.fullyQualifiedName,
                )
                self.status.scanned(f"Chart Scanned: {chart_ev.name.__root__}")
                yield chart_ev
            except ValidationError as err:
                logger.debug(traceback.format_exc())
                logger.warning(f"Unexpected exception ingesting chart [{chart}]: {err}")

    def ingest_data_models(self) -> Iterable[CreateDashboardDataModelRequest]:
        for data_model in self.data_models["datamodels"]:
            try:
                data_model_ev = CreateDashboardDataModelRequest(
                    name=data_model["name"],
                    displayName=data_model["displayName"],
                    description=data_model["description"],
                    columns=data_model["columns"],
                    dataModelType=data_model["dataModelType"],
                    sql=data_model["sql"],
                    serviceType=data_model["serviceType"],
                    service=self.dashboard_service.fullyQualifiedName,
                )
                self.status.scanned(
                    f"Data Model Scanned: {data_model_ev.name.__root__}"
                )
                yield data_model_ev
            except ValidationError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unexpected exception ingesting chart [{data_model}]: {err}"
                )

    def ingest_dashboards(self) -> Iterable[CreateDashboardRequest]:
        for dashboard in self.dashboards["dashboards"]:
            dashboard_ev = CreateDashboardRequest(
                name=dashboard["name"],
                displayName=dashboard["displayName"],
                description=dashboard["description"],
                dashboardUrl=dashboard["dashboardUrl"],
                charts=dashboard["charts"],
                dataModels=dashboard.get("dataModels", None),
                service=self.dashboard_service.fullyQualifiedName,
            )
            self.status.scanned(f"Dashboard Scanned: {dashboard_ev.name.__root__}")
            yield dashboard_ev

    def ingest_pipelines(self) -> Iterable[Pipeline]:
        for pipeline in self.pipelines["pipelines"]:
            pipeline_ev = CreatePipelineRequest(
                name=pipeline["name"],
                displayName=pipeline["displayName"],
                description=pipeline["description"],
                pipelineUrl=pipeline["pipelineUrl"],
                tasks=pipeline["tasks"],
                service=self.pipeline_service.fullyQualifiedName,
            )
            yield pipeline_ev

    def ingest_lineage(self) -> Iterable[AddLineageRequest]:
        for edge in self.lineage:
            from_entity_ref = get_lineage_entity_ref(edge["from"], self.metadata_config)
            to_entity_ref = get_lineage_entity_ref(edge["to"], self.metadata_config)
            edge_entity_ref = get_lineage_entity_ref(
                edge["edge_meta"], self.metadata_config
            )
            lineage_details = (
                LineageDetails(pipeline=edge_entity_ref, sqlQuery=edge.get("sql_query"))
                if edge_entity_ref
                else None
            )
            lineage = AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=from_entity_ref,
                    toEntity=to_entity_ref,
                    lineageDetails=lineage_details,
                )
            )
            yield lineage

    def ingest_pipeline_status(self) -> Iterable[OMetaPipelineStatus]:
        """
        Ingest sample pipeline status
        """
        for status_data in self.pipeline_status:
            pipeline_fqn = status_data["pipeline"]
            for status in status_data["pipelineStatus"]:
                yield OMetaPipelineStatus(
                    pipeline_fqn=pipeline_fqn,
                    pipeline_status=PipelineStatus(**status),
                )

    def get_ml_feature_sources(self, feature: dict) -> List[FeatureSource]:
        """
        Build FeatureSources from sample data
        """
        return [
            FeatureSource(
                name=source["name"],
                dataType=source["dataType"],
                dataSource=self.metadata.get_entity_reference(
                    entity=Table, fqn=source["dataSource"]
                ),
            )
            for source in feature.get("featureSources", [])
        ]

    def get_ml_features(self, model: dict) -> List[MlFeature]:
        """
        Build MlFeatures from sample data
        """
        return [
            MlFeature(
                name=feature["name"],
                dataType=feature["dataType"],
                description=feature.get("description"),
                featureAlgorithm=feature.get("featureAlgorithm"),
                featureSources=self.get_ml_feature_sources(feature),
            )
            for feature in model.get("mlFeatures", [])
        ]

    def ingest_mlmodels(self) -> Iterable[CreateMlModelRequest]:
        """
        Convert sample model data into a Model Entity
        to feed the metastore
        """

        for model in self.models:
            try:
                # Fetch linked dashboard ID from name
                mlmodel_fqn = model["dashboard"]
                dashboard = self.metadata.get_by_name(entity=Dashboard, fqn=mlmodel_fqn)

                if not dashboard:
                    raise InvalidSampleDataException(
                        f"Cannot find {mlmodel_fqn} in Sample Dashboards"
                    )

                model_ev = CreateMlModelRequest(
                    name=model["name"],
                    displayName=model["displayName"],
                    description=model["description"],
                    algorithm=model["algorithm"],
                    dashboard=dashboard.fullyQualifiedName.__root__,
                    mlStore=MlStore(
                        storage=model["mlStore"]["storage"],
                        imageRepository=model["mlStore"]["imageRepository"],
                    )
                    if model.get("mlStore")
                    else None,
                    server=model.get("server"),
                    target=model.get("target"),
                    mlFeatures=self.get_ml_features(model),
                    mlHyperParameters=[
                        MlHyperParameter(name=param["name"], value=param["value"])
                        for param in model.get("mlHyperParameters", [])
                    ],
                    service=self.model_service.fullyQualifiedName,
                )
                yield model_ev
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error ingesting MlModel [{model}]: {exc}")

    def ingest_containers(self) -> Iterable[CreateContainerRequest]:
        """
        Convert sample containers data into a Container Entity
        to feed the metastore
        """

        for container in self.containers:
            try:
                # Fetch linked dashboard ID from name
                parent_container_fqn = container.get("parent")
                parent_container = None
                if parent_container_fqn:
                    parent_container = self.metadata.get_by_name(
                        entity=Container, fqn=parent_container_fqn
                    )
                    if not parent_container:
                        raise InvalidSampleDataException(
                            f"Cannot find {parent_container_fqn} in Sample Containers"
                        )

                container_request = CreateContainerRequest(
                    name=container["name"],
                    displayName=container["displayName"],
                    description=container["description"],
                    parent=EntityReference(id=parent_container.id, type="container")
                    if parent_container_fqn
                    else None,
                    prefix=container["prefix"],
                    dataModel=container.get("dataModel"),
                    numberOfObjects=container.get("numberOfObjects"),
                    size=container.get("size"),
                    fileFormats=container.get("fileFormats"),
                    service=self.storage_service.fullyQualifiedName,
                )
                yield container_request
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error ingesting Container [{container}]: {exc}")

    def ingest_users(self) -> Iterable[OMetaUserProfile]:
        """
        Ingest Sample User data
        """
        try:
            for user in self.users["users"]:
                teams = [
                    CreateTeamRequest(
                        name=user["teams"],
                        displayName=user["teams"],
                        description=f"This is {user['teams']} description.",
                        teamType=user["teamType"],
                    )
                ]
                if not self.list_policies:
                    self.list_policies = self.metadata.list_entities(entity=Policy)
                    role_name = self.list_policies.entities[0].name
                roles = (
                    [
                        CreateRoleRequest(
                            name=role,
                            description=f"This is {role} description.",
                            policies=[role_name],
                        )
                        for role in user["roles"]
                    ]
                    if "roles" in user
                    else []
                )
                user_metadata = CreateUserRequest(
                    name=user["name"],
                    displayName=user["displayName"],
                    email=user["email"],
                )

                yield OMetaUserProfile(user=user_metadata, teams=teams, roles=roles)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Error ingesting users: {exc}")

    def ingest_profiles(self) -> Iterable[OMetaTableProfileSampleData]:
        """Iterate over all the profile data and ingest them"""
        for table_profile in self.profiles["profiles"]:
            table = self.metadata.get_by_name(
                entity=Table,
                fqn=table_profile["fqn"],
            )
            for days, profile in enumerate(table_profile["profile"]):
                yield OMetaTableProfileSampleData(
                    table=table,
                    profile=CreateTableProfileRequest(
                        tableProfile=TableProfile(
                            columnCount=profile["columnCount"],
                            rowCount=profile["rowCount"],
                            timestamp=(
                                datetime.now(tz=timezone.utc) - timedelta(days=days)
                            ).timestamp(),
                        ),
                        columnProfile=[
                            ColumnProfile(
                                timestamp=(
                                    datetime.now(tz=timezone.utc) - timedelta(days=days)
                                ).timestamp(),
                                **col_profile,
                            )
                            for col_profile in profile["columnProfile"]
                        ],
                        systemProfile=[
                            SystemProfile(
                                timestamp=int(
                                    (
                                        datetime.now(tz=timezone.utc)
                                        - timedelta(
                                            days=days, hours=random.randint(0, 24)
                                        )
                                    ).timestamp()
                                    * 1000
                                ),
                                **system_profile,
                            )
                            for system_profile in profile["systemProfile"]
                        ],
                    ),
                )

    def ingest_test_suite(self) -> Iterable[OMetaTestSuiteSample]:
        """Iterate over all the testSuite and testCase and ingest them"""
        for test_suite in self.tests_suites["tests"]:
            yield OMetaTestSuiteSample(
                test_suite=CreateTestSuiteRequest(
                    name=test_suite["testSuiteName"],
                    description=test_suite["testSuiteDescription"],
                )
            )

    def ingest_test_case(self) -> Iterable[OMetaTestCaseSample]:
        for test_suite in self.tests_suites["tests"]:
            suite = self.metadata.get_by_name(
                fqn=test_suite["testSuiteName"], entity=TestSuite
            )
            for test_case in test_suite["testCases"]:
                yield OMetaTestCaseSample(
                    test_case=CreateTestCaseRequest(
                        name=test_case["name"],
                        description=test_case["description"],
                        testDefinition=test_case["testDefinitionName"],
                        entityLink=test_case["entityLink"],
                        testSuite=suite.fullyQualifiedName.__root__,
                        parameterValues=[
                            TestCaseParameterValue(**param_values)
                            for param_values in test_case["parameterValues"]
                        ],
                    )
                )

    def ingest_test_case_results(self) -> Iterable[OMetaTestCaseResultsSample]:
        """Iterate over all the testSuite and testCase and ingest them"""
        for test_case_results in self.tests_case_results["testCaseResults"]:
            case = self.metadata.get_by_name(
                TestCase,
                f"sample_data.ecommerce_db.shopify.dim_address.{test_case_results['name']}",
                fields=["testSuite", "testDefinition"],
            )
            if case:
                for days, result in enumerate(test_case_results["results"]):
                    yield OMetaTestCaseResultsSample(
                        test_case_results=TestCaseResult(
                            timestamp=(
                                datetime.now() - timedelta(days=days)
                            ).timestamp(),
                            testCaseStatus=result["testCaseStatus"],
                            result=result["result"],
                            testResultValue=[
                                TestResultValue.parse_obj(res_value)
                                for res_value in result["testResultValues"]
                            ],
                        ),
                        test_case_name=case.fullyQualifiedName.__root__,
                    )

    def close(self):
        pass

    def test_connection(self) -> None:
        pass
