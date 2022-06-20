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

import csv
import json
import os
import sys
import traceback
import uuid
from collections import namedtuple
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Union

from pydantic import ValidationError

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.api.tests.createColumnTest import CreateColumnTestRequest
from metadata.generated.schema.api.tests.createTableTest import CreateTableTestRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.location import Location, LocationType
from metadata.generated.schema.entity.data.mlmodel import (
    FeatureSource,
    MlFeature,
    MlHyperParameter,
    MlStore,
)
from metadata.generated.schema.entity.data.pipeline import Pipeline, PipelineStatus
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.policies.policy import Policy
from metadata.generated.schema.entity.services.connections.database.sampleDataConnection import (
    SampleDataConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.columnTest import ColumnTestCase
from metadata.generated.schema.tests.tableTest import TableTestCase
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.models.table_tests import OMetaTableTest
from metadata.ingestion.models.user import OMetaUserProfile
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.helpers import (
    get_chart_entities_from_id,
    get_standard_chart_type,
    get_storage_service_or_create,
)
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
    fqn = edge["fqn"]
    if edge["type"] == "table":
        table = metadata.get_by_name(entity=Table, fqn=fqn)
        if not table:
            return
        return EntityReference(id=table.id, type="table")
    elif edge["type"] == "pipeline":
        pipeline = metadata.get_by_name(entity=Pipeline, fqn=fqn)
        if not pipeline:
            return
        return EntityReference(id=pipeline.id, type="pipeline")
    elif edge["type"] == "dashboard":
        dashboard = metadata.get_by_name(entity=Dashboard, fqn=fqn)
        if not dashboard:
            return
        return EntityReference(id=dashboard.id, type="dashboard")


def get_table_key(row: Dict[str, Any]) -> Union[TableKey, None]:
    """
    Table key consists of schema and table name
    :param row:
    :return:
    """
    return TableKey(schema=row["schema"], table_name=row["table_name"])


@dataclass
class SampleDataSourceStatus(SourceStatus):
    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def scanned(self, entity_type: str, entity_name: str) -> None:
        self.success.append(entity_name)
        logger.info("{} Scanned: {}".format(entity_type, entity_name))

    def filtered(self, entity_type: str, entity_name: str, err: str) -> None:
        self.warnings.append(entity_name)
        logger.warning("Dropped {} {} due to {}".format(entity_type, entity_name, err))


class TableSchema:
    def __init__(self, filename):
        # error if the file is not csv file
        if not filename.endswith(".csv"):
            raise Exception("Input file should be a csv file")

        # file name is assumed to be the table name
        basename = os.path.basename(filename)
        self.table_name = os.path.splitext(basename)[0]

        with open(filename, "r") as fin:
            self.columns = [dict(i) for i in csv.DictReader(fin)]

    def primary_keys(self):
        return [c[COLUMN_NAME] for c in self.columns if c[KEY_TYPE] == "PK"]

    def foreign_keys(self):
        return [c[COLUMN_NAME] for c in self.columns if c[KEY_TYPE] == "FK"]

    def get_name(self):
        return self.table_name

    def get_schema(self):
        return self.columns

    def get_column_names(self):
        return [c[COLUMN_NAME] for c in self.columns]


class SampleTableMetadataGenerator:
    def __init__(self, table_to_df_dict, table_to_schema_map):
        self.table_to_df_dict = table_to_df_dict
        self.table_to_schema_map = table_to_schema_map
        self.sample_user = None
        self.sample_table = None
        self.sample_table_owner = None
        self.sample_table_last_updated = None

    def get_empty_dict_with_cols(self, columns):
        data = {}
        for c in columns:
            data[c] = []
        return data


class SampleDataSource(Source[Entity]):
    """
    Loads JSON data and prepares the required
    python objects to be sent to the Sink.
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.status = SampleDataSourceStatus()
        self.config = config
        self.service_connection = config.serviceConnection.__root__.config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.list_policies = []

        self.storage_service_json = json.load(
            open(
                self.service_connection.sampleDataFolder + "/locations/service.json",
                "r",
            )
        )
        self.locations = json.load(
            open(
                self.service_connection.sampleDataFolder + "/locations/locations.json",
                "r",
            )
        )
        self.storage_service = get_storage_service_or_create(
            service_json=self.storage_service_json,
            metadata_config=metadata_config,
        )
        self.glue_storage_service_json = json.load(
            open(
                self.service_connection.sampleDataFolder + "/glue/storage_service.json",
                "r",
            )
        )
        self.glue_database_service_json = json.load(
            open(
                self.service_connection.sampleDataFolder
                + "/glue/database_service.json",
                "r",
            )
        )
        self.glue_database = json.load(
            open(self.service_connection.sampleDataFolder + "/glue/database.json", "r")
        )
        self.glue_database_schema = json.load(
            open(
                self.service_connection.sampleDataFolder + "/glue/database_schema.json",
                "r",
            )
        )
        self.glue_tables = json.load(
            open(self.service_connection.sampleDataFolder + "/glue/tables.json", "r")
        )
        self.glue_database_service = self.metadata.get_service_or_create(
            entity=DatabaseService,
            config=WorkflowSource(**self.glue_database_service_json),
        )
        self.glue_storage_service = get_storage_service_or_create(
            self.glue_storage_service_json,
            metadata_config,
        )
        self.database_service_json = json.load(
            open(
                self.service_connection.sampleDataFolder + "/datasets/service.json", "r"
            )
        )
        self.database = json.load(
            open(
                self.service_connection.sampleDataFolder + "/datasets/database.json",
                "r",
            )
        )
        self.database_schema = json.load(
            open(
                self.service_connection.sampleDataFolder
                + "/datasets/database_schema.json",
                "r",
            )
        )
        self.tables = json.load(
            open(
                self.service_connection.sampleDataFolder + "/datasets/tables.json", "r"
            )
        )
        self.database_service_json = json.load(
            open(
                self.service_connection.sampleDataFolder + "/datasets/service.json", "r"
            )
        )
        self.database_service = self.metadata.get_service_or_create(
            entity=DatabaseService, config=WorkflowSource(**self.database_service_json)
        )

        self.kafka_service_json = json.load(
            open(self.service_connection.sampleDataFolder + "/topics/service.json", "r")
        )
        self.topics = json.load(
            open(self.service_connection.sampleDataFolder + "/topics/topics.json", "r")
        )

        self.kafka_service = self.metadata.get_service_or_create(
            entity=MessagingService, config=WorkflowSource(**self.kafka_service_json)
        )

        self.dashboard_service_json = json.load(
            open(
                self.service_connection.sampleDataFolder + "/dashboards/service.json",
                "r",
            )
        )
        self.charts = json.load(
            open(
                self.service_connection.sampleDataFolder + "/dashboards/charts.json",
                "r",
            )
        )
        self.dashboards = json.load(
            open(
                self.service_connection.sampleDataFolder
                + "/dashboards/dashboards.json",
                "r",
            )
        )
        self.dashboard_service = self.metadata.get_service_or_create(
            entity=DashboardService,
            config=WorkflowSource(**self.dashboard_service_json),
        )

        self.pipeline_service_json = json.load(
            open(
                self.service_connection.sampleDataFolder + "/pipelines/service.json",
                "r",
            )
        )
        self.pipelines = json.load(
            open(
                self.service_connection.sampleDataFolder + "/pipelines/pipelines.json",
                "r",
            )
        )
        self.pipeline_service = self.metadata.get_service_or_create(
            entity=PipelineService, config=WorkflowSource(**self.pipeline_service_json)
        )
        self.lineage = json.load(
            open(
                self.service_connection.sampleDataFolder + "/lineage/lineage.json", "r"
            )
        )
        self.users = json.load(
            open(self.service_connection.sampleDataFolder + "/users/users.json", "r")
        )
        self.model_service_json = json.load(
            open(
                self.service_connection.sampleDataFolder + "/models/service.json",
                "r",
            )
        )
        self.model_service = self.metadata.get_service_or_create(
            entity=MlModelService,
            config=WorkflowSource(**self.model_service_json),
        )
        self.models = json.load(
            open(self.service_connection.sampleDataFolder + "/models/models.json", "r")
        )
        self.user_entity = {}
        self.table_tests = json.load(
            open(
                self.service_connection.sampleDataFolder + "/datasets/tableTests.json",
                "r",
            )
        )
        self.pipeline_status = json.load(
            open(
                self.service_connection.sampleDataFolder
                + "/pipelines/pipelineStatus.json",
                "r",
            )
        )

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SampleDataConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SampleDataConnection):
            raise InvalidSourceException(
                f"Expected SampleDataConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Entity]:
        yield from self.ingest_users()
        yield from self.ingest_locations()
        yield from self.ingest_glue()
        yield from self.ingest_tables()
        yield from self.ingest_table_tests()
        yield from self.ingest_topics()
        yield from self.ingest_charts()
        yield from self.ingest_dashboards()
        yield from self.ingest_pipelines()
        yield from self.ingest_lineage()
        yield from self.ingest_pipeline_status()
        yield from self.ingest_mlmodels()

    def ingest_locations(self) -> Iterable[Location]:
        for location in self.locations["locations"]:
            location_ev = Location(
                id=uuid.uuid4(),
                name=location["name"],
                path=location["path"],
                displayName=location["displayName"],
                description=location["description"],
                locationType=location["locationType"],
                service=EntityReference(
                    id=self.storage_service.id, type="storageService"
                ),
            )
            yield location_ev

    def ingest_glue(self) -> Iterable[OMetaDatabaseAndTable]:
        db = Database(
            id=uuid.uuid4(),
            name=self.glue_database["name"],
            description=self.glue_database["description"],
            service=EntityReference(
                id=self.glue_database_service.id,
                type=self.glue_database_service.serviceType.value,
            ),
        )
        db_schema = DatabaseSchema(
            id=uuid.uuid4(),
            name=self.glue_database_schema["name"],
            description=self.glue_database_schema["description"],
            service=EntityReference(
                id=self.glue_database_service.id,
                type=self.glue_database_service.serviceType.value,
            ),
            database=EntityReference(id=db.id, type="database"),
        )
        for table in self.glue_tables["tables"]:
            table["id"] = uuid.uuid4()
            parameters = table.get("Parameters")
            table = {key: val for key, val in table.items() if key != "Parameters"}
            table_metadata = Table(**table)
            location_type = LocationType.Table
            if parameters:
                location_type = (
                    location_type
                    if parameters.get("table_type") != "ICEBERG"
                    else LocationType.Iceberg
                )
            location_metadata = Location(
                id=uuid.uuid4(),
                name=table["name"],
                path="s3://glue_bucket/dwh/schema/" + table["name"],
                description=table["description"],
                locationType=location_type,
                service=EntityReference(
                    id=self.glue_storage_service.id, type="storageService"
                ),
            )
            db_table_location = OMetaDatabaseAndTable(
                database=db,
                table=table_metadata,
                location=location_metadata,
                database_schema=db_schema,
            )
            self.status.scanned("table", table_metadata.name.__root__)
            yield db_table_location

    def ingest_tables(self) -> Iterable[OMetaDatabaseAndTable]:
        db = Database(
            id=uuid.uuid4(),
            name=self.database["name"],
            description=self.database["description"],
            service=EntityReference(
                id=self.database_service.id, type=self.service_connection.type.value
            ),
        )
        schema = DatabaseSchema(
            id=uuid.uuid4(),
            name=self.database_schema["name"],
            description=self.database_schema["description"],
            service=EntityReference(
                id=self.database_service.id, type=self.service_connection.type.value
            ),
            database=EntityReference(id=db.id, type="database"),
        )
        resp = self.metadata.list_entities(entity=User, limit=5)
        self.user_entity = resp.entities
        for table in self.tables["tables"]:
            table_metadata = Table(**table)
            table_and_db = OMetaDatabaseAndTable(
                table=table_metadata, database=db, database_schema=schema
            )
            self.status.scanned("table", table_metadata.name.__root__)
            yield table_and_db

    def ingest_topics(self) -> Iterable[CreateTopicRequest]:
        for topic in self.topics["topics"]:
            topic["service"] = EntityReference(
                id=self.kafka_service.id, type="messagingService"
            )
            create_topic = Topic(**topic)
            self.status.scanned("topic", create_topic.name.__root__)
            yield create_topic

    def ingest_charts(self) -> Iterable[CreateChartRequest]:
        for chart in self.charts["charts"]:
            try:
                chart_ev = CreateChartRequest(
                    name=chart["name"],
                    displayName=chart["displayName"],
                    description=chart["description"],
                    chartType=get_standard_chart_type(chart["chartType"]).value,
                    chartUrl=chart["chartUrl"],
                    service=EntityReference(
                        id=self.dashboard_service.id, type="dashboardService"
                    ),
                )
                self.status.scanned("chart", chart_ev.name)
                yield chart_ev
            except ValidationError as err:
                logger.error(err)

    def ingest_dashboards(self) -> Iterable[CreateDashboardRequest]:
        for dashboard in self.dashboards["dashboards"]:
            dashboard_ev = CreateDashboardRequest(
                name=dashboard["name"],
                displayName=dashboard["displayName"],
                description=dashboard["description"],
                dashboardUrl=dashboard["dashboardUrl"],
                charts=get_chart_entities_from_id(
                    dashboard["charts"],
                    self.metadata,
                    self.dashboard_service.name.__root__,
                ),
                service=EntityReference(
                    id=self.dashboard_service.id, type="dashboardService"
                ),
            )
            self.status.scanned("dashboard", dashboard_ev.name.__root__)
            yield dashboard_ev

    def ingest_pipelines(self) -> Iterable[Pipeline]:
        for pipeline in self.pipelines["pipelines"]:
            pipeline_ev = Pipeline(
                id=uuid.uuid4(),
                name=pipeline["name"],
                displayName=pipeline["displayName"],
                description=pipeline["description"],
                pipelineUrl=pipeline["pipelineUrl"],
                tasks=pipeline["tasks"],
                service=EntityReference(
                    id=self.pipeline_service.id, type="pipelineService"
                ),
            )
            yield pipeline_ev

    def ingest_lineage(self) -> Iterable[AddLineageRequest]:
        for edge in self.lineage:
            from_entity_ref = get_lineage_entity_ref(edge["from"], self.metadata_config)
            to_entity_ref = get_lineage_entity_ref(edge["to"], self.metadata_config)
            lineage = AddLineageRequest(
                edge=EntitiesEdge(fromEntity=from_entity_ref, toEntity=to_entity_ref)
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
        from metadata.generated.schema.entity.data.dashboard import Dashboard

        for model in self.models:
            try:
                # Fetch linked dashboard ID from name
                mlmodel_fqn = model["dashboard"]
                dashboard = self.metadata.get_by_name(entity=Dashboard, fqn=mlmodel_fqn)

                if not dashboard:
                    raise InvalidSampleDataException(
                        f"Cannot find {mlmodel_fqn} in Sample Dashboards"
                    )

                dashboard_id = str(dashboard.id.__root__)

                model_ev = CreateMlModelRequest(
                    name=model["name"],
                    displayName=model["displayName"],
                    description=model["description"],
                    algorithm=model["algorithm"],
                    dashboard=EntityReference(id=dashboard_id, type="dashboard"),
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
                    service=EntityReference(
                        id=self.model_service.id,
                        type="mlmodelService",
                    ),
                )
                yield model_ev
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(err)

    def ingest_users(self) -> Iterable[OMetaUserProfile]:
        try:
            for user in self.users["users"]:
                teams = [
                    CreateTeamRequest(
                        name=user["teams"],
                        displayName=user["teams"],
                        description=f"This is {user['teams']} description.",
                    )
                ]
                if not self.list_policies:
                    self.list_policies = self.metadata.list_entities(entity=Policy)
                    role_ref_id = self.list_policies.entities[0].id.__root__
                roles = (
                    [
                        CreateRoleRequest(
                            name=role,
                            description=f"This is {role} description.",
                            policies=[EntityReference(id=role_ref_id, type="policies")],
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
        except Exception as err:
            logger.error(err)
            logger.debug(traceback.format_exc())
            logger.debug(sys.exc_info()[2])

    def ingest_table_tests(self) -> Iterable[OMetaTableTest]:
        """
        Iterate over all tables and fetch
        the sample test data. For each table test and column
        test, prepare all TestCaseResults
        """
        try:
            for test_def in self.table_tests:
                table_name = test_def["table"]

                for table_test in test_def["tableTests"]:
                    create_table_test = CreateTableTestRequest(
                        description=table_test.get("description"),
                        testCase=TableTestCase.parse_obj(table_test["testCase"]),
                        executionFrequency=table_test["executionFrequency"],
                        result=TestCaseResult.parse_obj(table_test["result"]),
                    )
                    yield OMetaTableTest(
                        table_name=table_name, table_test=create_table_test
                    )

                for col_test in test_def["columnTests"]:
                    create_column_test = CreateColumnTestRequest(
                        description=col_test.get("description"),
                        columnName=col_test["columnName"],
                        testCase=ColumnTestCase.parse_obj(col_test["testCase"]),
                        executionFrequency=col_test["executionFrequency"],
                        result=TestCaseResult.parse_obj(col_test["result"]),
                    )
                    yield OMetaTableTest(
                        table_name=table_name, column_test=create_column_test
                    )
        except Exception as err:  # pylint: disable=broad-except
            logger.error(err)

    def close(self):
        pass

    def get_status(self):
        return self.status

    def test_connection(self) -> None:
        pass
