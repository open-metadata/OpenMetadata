#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Sample Data source ingestion
"""
# pylint: disable=too-many-lines,too-many-statements
import json
import random
import string
import time
import traceback
from collections import namedtuple
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Union

from pydantic import ValidationError

from metadata.generated.schema.analytics.reportData import ReportData, ReportDataType
from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.api.data.createAPIEndpoint import (
    CreateAPIEndpointRequest,
)
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
from metadata.generated.schema.api.data.createDataContract import (
    CreateDataContractRequest,
)
from metadata.generated.schema.api.data.createDirectory import CreateDirectoryRequest
from metadata.generated.schema.api.data.createFile import CreateFileRequest
from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.data.createSearchIndex import (
    CreateSearchIndexRequest,
)
from metadata.generated.schema.api.data.createSpreadsheet import (
    CreateSpreadsheetRequest,
)
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.data.createWorksheet import CreateWorksheetRequest
from metadata.generated.schema.api.domains.createDomain import CreateDomainRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.services.createDriveService import (
    CreateDriveServiceRequest,
)
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.api.tests.createCustomMetric import (
    CreateCustomMetricRequest,
)
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestCaseResolutionStatus import (
    CreateTestCaseResolutionStatus,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.dataContract import DataContract
from metadata.generated.schema.entity.data.mlmodel import (
    FeatureSource,
    MlFeature,
    MlHyperParameter,
    MlStore,
)
from metadata.generated.schema.entity.data.pipeline import Pipeline, PipelineStatus
from metadata.generated.schema.entity.data.storedProcedure import (
    StoredProcedure,
    StoredProcedureCode,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnProfile,
    DataType,
    SystemProfile,
    Table,
    TableData,
    TableProfile,
)
from metadata.generated.schema.entity.data.topic import Topic, TopicSampleData
from metadata.generated.schema.entity.datacontract.dataContractResult import (
    DataContractResult,
)
from metadata.generated.schema.entity.policies.policy import Policy
from metadata.generated.schema.entity.services.apiService import ApiService
from metadata.generated.schema.entity.services.connections.database.customDatabaseConnection import (
    CustomDatabaseConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.driveService import DriveService
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.services.searchService import SearchService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.tests.assigned import Assigned
from metadata.generated.schema.tests.basic import TestCaseResult, TestResultValue
from metadata.generated.schema.tests.resolved import Resolved, TestCaseFailureReasonType
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Timestamp
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.lifeCycle import AccessDetails, LifeCycle
from metadata.generated.schema.type.schema import Topic as TopicSchema
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.models.data_insight import OMetaDataInsightSample
from metadata.ingestion.models.life_cycle import OMetaLifeCycleData
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.models.profile_data import OMetaTableProfileSampleData
from metadata.ingestion.models.table_metadata import ColumnDescription
from metadata.ingestion.models.tests_data import (
    OMetaLogicalTestSuiteSample,
    OMetaTestCaseResolutionStatus,
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
from metadata.sampler.models import SampleData, SamplerResponse
from metadata.utils import entity_link, fqn
from metadata.utils.constants import UTF_8
from metadata.utils.fqn import FQN_SEPARATOR
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import datetime_to_timestamp

logger = ingestion_logger()

COLUMN_NAME = "Column"
KEY_TYPE = "Key type"
DATA_TYPE = "Data type"
COL_DESCRIPTION = "Description"
NUM_SERVICES = 1
DATABASES_PER_SERVICE = 5
SCHEMAS_PER_DATABASE = 5
TABLES_PER_SCHEMA = 3000
COLUMNS_PER_TABLE = 2000
NUM_THREADS = 10
BATCH_SIZE = 10
COLUMNS = [
    Column(name=f"column_{i}", dataType=DataType.STRING)
    for i in range(COLUMNS_PER_TABLE)
]
TableKey = namedtuple("TableKey", ["schema", "table_name"])


class InvalidSampleDataException(Exception):
    """
    Sample data is not valid to be ingested
    """


def get_lineage_entity_ref(edge, metadata: OpenMetadata) -> Optional[EntityReference]:
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
    Source
):  # pylint: disable=too-many-instance-attributes,too-many-public-methods
    """
    Loads JSON data and prepares the required
    python objects to be sent to the Sink.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.service_connection = config.serviceConnection.root.config
        self.metadata = metadata
        self.list_policies = []

        sample_data_folder = self.service_connection.connectionOptions.root.get(
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

        # MYSQL service for er diagrams
        self.mysql_database_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/mysql/database_service.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.mysql_database = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/mysql/database.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.mysql_database_schema = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/mysql/database_schema.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.mysql_tables = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/mysql/tables.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.mysql_database_service = self.metadata.get_service_or_create(
            entity=DatabaseService,
            config=WorkflowSource(**self.mysql_database_service_json),
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
        self.stored_procedures = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/datasets/stored_procedures.json",
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

        self.glue_database_service = self.metadata.get_service_or_create(
            entity=DatabaseService,
            config=WorkflowSource(**self.glue_database_service_json),
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

        with open(
            sample_data_folder + "/looker/service.json",
            "r",
            encoding=UTF_8,
        ) as file:
            self.looker_service = self.metadata.get_service_or_create(
                entity=DashboardService,
                config=WorkflowSource(**json.load(file)),
            )

        with open(
            sample_data_folder + "/looker/charts.json",
            "r",
            encoding=UTF_8,
        ) as file:
            self.looker_charts = json.load(file)

        with open(
            sample_data_folder + "/looker/dashboards.json",
            "r",
            encoding=UTF_8,
        ) as file:
            self.looker_dashboards = json.load(file)

        with open(
            sample_data_folder + "/looker/dashboardDataModels.json",
            "r",
            encoding=UTF_8,
        ) as file:
            self.looker_models = json.load(file)

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

        self.logical_test_suites = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/tests/logicalTestSuites.json",
                "r",
                encoding=UTF_8,
            )
        )

        self.storage_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/storage/service.json",
                "r",
                encoding=UTF_8,
            )
        )

        self.search_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/searchIndexes/service.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.search_service = self.metadata.get_service_or_create(
            entity=SearchService,
            config=WorkflowSource(**self.search_service_json),
        )

        self.search_indexes = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/searchIndexes/searchIndexes.json",
                "r",
                encoding=UTF_8,
            )
        )

        self.life_cycle_data = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/lifecycle/lifeCycle.json",
                "r",
                encoding=UTF_8,
            )
        )

        self.data_insight_data = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/data_insights/data_insights.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.api_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/api_service/service.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.api_service = self.metadata.get_service_or_create(
            entity=ApiService,
            config=WorkflowSource(**self.api_service_json),
        )
        self.api_collection = json.load(
            open(
                sample_data_folder + "/api_service/api_collection.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.api_endpoint = json.load(
            open(
                sample_data_folder + "/api_service/api_endpoint.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.ometa_api_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/ometa_api_service/service.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.ometa_api_service = self.metadata.get_service_or_create(
            entity=ApiService,
            config=WorkflowSource(**self.ometa_api_service_json),
        )
        self.ometa_api_collection = json.load(
            open(
                sample_data_folder + "/ometa_api_service/ometa_api_collection.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.ometa_api_endpoint = json.load(
            open(
                sample_data_folder + "/ometa_api_service/ometa_api_endpoint.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.domain = json.load(
            open(
                sample_data_folder + "/domains/domain.json",
                "r",
                encoding=UTF_8,
            )
        )

        # Load data contracts sample data
        try:
            self.data_contracts = json.load(
                open(
                    sample_data_folder + "/dataContracts/dataContracts.json",
                    "r",
                    encoding=UTF_8,
                )
            )
            self.data_contract_results = json.load(
                open(
                    sample_data_folder + "/dataContracts/dataContractResults.json",
                    "r",
                    encoding=UTF_8,
                )
            )
        except FileNotFoundError:
            logger.warning("Data contracts sample data not found, skipping...")
            self.data_contracts = {"dataContracts": []}
            self.data_contract_results = {"dataContractResults": []}

        # Load drive sample data
        try:
            logger.info(f"Loading drive sample data from {sample_data_folder}/drives/")
            self.drive_service_json = json.load(
                open(  # pylint: disable=consider-using-with
                    sample_data_folder + "/drives/service.json",
                    "r",
                    encoding=UTF_8,
                )
            )
            logger.info(f"Drive service JSON: {self.drive_service_json}")
            logger.info("Creating drive service...")

            # Check if service already exists
            try:
                self.drive_service = self.metadata.get_by_name(
                    entity=DriveService, fqn=self.drive_service_json["name"]
                )
                logger.info(f"Drive service already exists: {self.drive_service.name}")
            except Exception:
                # Create the service using direct API call
                drive_service_request = CreateDriveServiceRequest(
                    **self.drive_service_json
                )

                # Use the direct API endpoint
                resp = self.metadata.client.put(
                    path="/services/driveServices",
                    data=drive_service_request.model_dump_json(),
                )

                self.drive_service = DriveService(**resp)
                logger.info(f"Created drive service: {self.drive_service.name}")
            self.directories = json.load(
                open(  # pylint: disable=consider-using-with
                    sample_data_folder + "/drives/directories.json",
                    "r",
                    encoding=UTF_8,
                )
            )
            self.files = json.load(
                open(  # pylint: disable=consider-using-with
                    sample_data_folder + "/drives/files.json",
                    "r",
                    encoding=UTF_8,
                )
            )
            self.spreadsheets = json.load(
                open(  # pylint: disable=consider-using-with
                    sample_data_folder + "/drives/spreadsheets.json",
                    "r",
                    encoding=UTF_8,
                )
            )
            self.worksheets = json.load(
                open(  # pylint: disable=consider-using-with
                    sample_data_folder + "/drives/worksheets.json",
                    "r",
                    encoding=UTF_8,
                )
            )
            self.has_drive_data = True
            logger.info(
                f"Successfully loaded drive data: {len(self.directories)} directories, {len(self.files)} files, {len(self.spreadsheets)} spreadsheets, {len(self.worksheets)} worksheets"
            )
        except Exception as exc:
            import traceback

            logger.warning(f"Drive sample data not found: {exc}")
            logger.debug(f"Traceback: {traceback.format_exc()}")
            self.has_drive_data = False

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: CustomDatabaseConnection = config.serviceConnection.root.config
        if not isinstance(connection, CustomDatabaseConnection):
            raise InvalidSourceException(
                f"Expected CustomDatabaseConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def _iter(self, *_, **__) -> Iterable[Entity]:
        yield from self.ingest_domains()
        yield from self.ingest_teams()
        yield from self.ingest_users()
        yield from self.ingest_drives()
        yield from self.ingest_tables()
        yield from self.ingest_glue()
        yield from self.ingest_mysql()
        yield from self.ingest_stored_procedures()
        yield from self.ingest_topics()
        yield from self.ingest_charts()
        yield from self.ingest_data_models()
        yield from self.ingest_dashboards()
        yield from self.ingest_looker()
        yield from self.ingest_pipelines()
        yield from self.ingest_lineage()
        yield from self.ingest_pipeline_status()
        yield from self.ingest_mlmodels()
        yield from self.ingest_containers()
        yield from self.ingest_search_indexes()
        yield from self.ingest_profiles()
        yield from self.ingest_test_suite()
        yield from self.ingest_test_case()
        yield from self.ingest_test_case_results()
        yield from self.ingest_incidents()
        yield from self.ingest_logical_test_suite()
        yield from self.ingest_data_insights()
        yield from self.ingest_life_cycle()
        yield from self.ingest_api_service()
        yield from self.ingest_ometa_api_service()
        self.modify_column_descriptions()
        yield from self.process_service_batch()
        yield from self.ingest_data_contracts()

    def ingest_domains(self):

        domain_request = CreateDomainRequest(**self.domain)
        yield Either(right=domain_request)

    def ingest_data_contracts(self) -> Iterable[Either[CreateDataContractRequest]]:
        """
        Ingest sample data contracts and their results
        """
        try:
            for contract_data in self.data_contracts.get("dataContracts", []):
                try:
                    # Create the data contract request
                    table_fqn = contract_data.pop("tableFQN", None)
                    contract_data["entity"] = {
                        "id": self.metadata.get_by_name(
                            entity=Table, fqn=table_fqn
                        ).id.root,
                        "type": "table",
                    }
                    quality_expectations = contract_data.pop(
                        "qualityExpectations", None
                    )
                    if quality_expectations:
                        contract_data["qualityExpectations"] = [
                            {
                                "id": self.metadata.get_by_name(
                                    entity=TestCase, fqn=expectation, fields=["*"]
                                ).id.root,
                                "type": "testCase",
                            }
                            for expectation in quality_expectations
                        ]
                    data_contract_request = CreateDataContractRequest(**contract_data)
                    yield Either(right=data_contract_request)

                    # Ingest associated results
                    yield from self._ingest_data_contract_results(table_fqn)

                except ValidationError as err:
                    logger.warning(
                        f"Failed to create data contract {contract_data.get('name', 'unknown')}: {err}"
                    )
                    yield Either(
                        left=StackTraceError(
                            name="DataContract",
                            error=f"Failed to create data contract: {err}",
                            stackTrace=traceback.format_exc(),
                        )
                    )
                except Exception as err:
                    logger.warning(
                        f"Unexpected error creating data contract {contract_data.get('name', 'unknown')}: {err}"
                    )
                    yield Either(
                        left=StackTraceError(
                            name="DataContract",
                            error=f"Unexpected error: {err}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

        except Exception as err:
            logger.warning(f"Failed to ingest data contracts: {err}")
            yield Either(
                left=StackTraceError(
                    name="DataContract",
                    error=f"Failed to ingest data contracts: {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _ingest_data_contract_results(self, table_fqn: str):
        """
        Ingest results for a specific data contract following test case results pattern
        """
        try:
            # Find contract results by name
            contract_results_data = None
            for contract_result in self.data_contract_results.get(
                "dataContractResults", []
            ):
                if contract_result.get("table_fqn") == table_fqn:
                    contract_results_data = contract_result
                    break

            if not contract_results_data:
                logger.debug(f"No results found for contract {table_fqn}")
                return

            table_fqn = contract_results_data.pop("table_fqn")
            contract_fqn = contract_results_data.pop("dataContractFQN")
            try:
                contract = self.metadata.get_by_name(
                    entity=DataContract, fqn=contract_fqn
                )
                if not contract:
                    logger.warning(f"Could not find data contract {contract_fqn}")
                    return
            except Exception as e:
                logger.warning(f"Could not retrieve data contract {contract_fqn}: {e}")
                return

            # Create results with timestamps going back in time (similar to test case results)
            for days, result_data in enumerate(
                contract_results_data.get("results", [])
            ):
                try:
                    # Generate timestamp going back in days
                    timestamp = Timestamp(
                        int((datetime.now() - timedelta(days=days)).timestamp() * 1000)
                    )

                    # Create the DataContractResult with generated timestamp and contract FQN
                    result = DataContractResult(
                        dataContractFQN=contract_fqn,
                        timestamp=timestamp,
                        contractExecutionStatus=result_data["contractExecutionStatus"],
                        result=result_data["result"],
                        executionTime=result_data.get("executionTime"),
                        schemaValidation=result_data.get("schemaValidation"),
                        semanticsValidation=result_data.get("semanticsValidation"),
                        qualityValidation=result_data.get("qualityValidation"),
                    )

                    yield Either(right=result)

                except ValidationError as err:
                    logger.warning(
                        f"Failed to create data contract result for {table_fqn}: {err}"
                    )
                except Exception as err:
                    logger.warning(
                        f"Unexpected error creating data contract result for {table_fqn}: {err}"
                    )

        except Exception as err:
            logger.warning(f"Failed to ingest results for contract {table_fqn}: {err}")

    def modify_column_descriptions(self):
        """
        Modify column descriptions to include the table name
        """
        table: Table = self.metadata.get_by_name(
            entity=Table, fqn="mysql_sample.default.posts_db.Tags"
        )
        col_desc_list = []
        for column in table.columns:
            column.description = f"{table.name} - {column.name}"
            col_desc_list.append(
                ColumnDescription(
                    column_fqn=column.fullyQualifiedName.root,
                    description=column.description,
                )
            )

        self.metadata.patch_column_descriptions(
            table=table,
            column_descriptions=col_desc_list,
        )
        self.metadata.patch_column_descriptions(
            table=table,
            column_descriptions=[
                ColumnDescription(
                    column_fqn=column.fullyQualifiedName.root, description=None
                )
                for column in table.columns
            ],
        )
        self.metadata.patch_column_descriptions(
            table=table,
            column_descriptions=col_desc_list,
        )

    def ingest_teams(self) -> Iterable[Either[CreateTeamRequest]]:
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

            yield Either(right=team_to_ingest)

    def ingest_drives(self) -> Iterable[Either[Entity]]:
        """Ingest Sample Drive data"""
        logger.info(
            f"Starting drive ingestion, has_drive_data: {getattr(self, 'has_drive_data', False)}"
        )
        if not getattr(self, "has_drive_data", False):
            logger.warning("No drive data to ingest")
            return
            yield  # Make this a generator that yields nothing

        # Create directories first, building references as we go
        directory_refs = {}

        for directory_data in self.directories:
            directory_request = CreateDirectoryRequest(
                name=directory_data["name"],
                displayName=directory_data.get("displayName"),
                description=directory_data.get("description"),
                service=self.drive_service.fullyQualifiedName.root,
                path=directory_data.get("path"),
                directoryType=directory_data.get("directoryType"),
                isShared=directory_data.get("isShared", False),
                numberOfFiles=directory_data.get("numberOfFiles"),
                numberOfSubDirectories=directory_data.get("numberOfSubDirectories"),
                totalSize=directory_data.get("totalSize"),
                tags=directory_data.get("tags", []),
                owners=directory_data.get("owners", []),
            )

            # Handle parent directory reference
            if directory_data.get("parent"):
                parent_name = directory_data["parent"]
                if parent_name in directory_refs:
                    directory_request.parent = FullyQualifiedEntityName(
                        root=directory_refs[parent_name]
                    )
                else:
                    directory_request.parent = FullyQualifiedEntityName(
                        f"{self.drive_service.fullyQualifiedName.root}.{parent_name}"
                    )

            # Use direct API call instead of yielding since suffix mapping is missing
            try:
                resp = self.metadata.client.put(
                    path="/drives/directories", data=directory_request.model_dump_json()
                )
                logger.debug(f"Created directory: {directory_data['name']}")
            except Exception as e:
                logger.warning(
                    f"Failed to create directory {directory_data['name']}: {e}"
                )

            # Store the FQN for later reference
            # Build FQN manually since Directory FQN builder is not implemented
            if directory_data.get("parent"):
                parent_path = directory_data["parent"].replace(".", "/")
                directory_fqn = f"{self.drive_service.fullyQualifiedName.root}.{parent_path}.{directory_data['name']}"
            else:
                directory_fqn = f"{self.drive_service.fullyQualifiedName.root}.{directory_data['name']}"
            directory_refs[directory_data["name"]] = directory_fqn

        # Create files
        for file_data in self.files:
            file_request = CreateFileRequest(
                name=file_data["name"],
                displayName=file_data.get("displayName"),
                description=file_data.get("description"),
                service=self.drive_service.fullyQualifiedName.root,
                directory=directory_refs.get(file_data["directory"])
                if file_data.get("directory")
                else None,
                fileType=file_data.get("fileType"),
                mimeType=file_data.get("mimeType"),
                fileExtension=file_data.get("fileExtension"),
                path=file_data.get("path"),
                size=file_data.get("size"),
                checksum=file_data.get("checksum"),
                webViewLink=file_data.get("webViewLink"),
                downloadLink=file_data.get("downloadLink"),
                isShared=file_data.get("isShared", False),
                fileVersion=file_data.get("fileVersion"),
                sourceUrl=file_data.get("webViewLink"),
                tags=file_data.get("tags", []),
                owners=file_data.get("owners", []),
            )

            # Use direct API call instead of yielding since suffix mapping is missing
            try:
                resp = self.metadata.client.put(
                    path="/drives/files", data=file_request.model_dump_json()
                )
                logger.debug(f"Created file: {file_data['name']}")
            except Exception as e:
                logger.warning(f"Failed to create file {file_data['name']}: {e}")

        # Create spreadsheets
        spreadsheet_refs = {}

        for spreadsheet_data in self.spreadsheets:
            # Build the request without parent first
            spreadsheet_request_dict = {
                "name": spreadsheet_data["name"],
                "displayName": spreadsheet_data.get("displayName"),
                "description": spreadsheet_data.get("description"),
                "service": self.drive_service.fullyQualifiedName,
                "path": spreadsheet_data.get("path"),
                "size": spreadsheet_data.get("size"),
                "sourceUrl": spreadsheet_data.get("sourceUrl"),
                "tags": spreadsheet_data.get("tags", []),
                "owners": spreadsheet_data.get("owners", []),
            }

            # Skip parent for now as it requires entity reference
            # TODO: Add parent reference once directories are created and we can get their IDs

            spreadsheet_request = CreateSpreadsheetRequest(**spreadsheet_request_dict)

            # Use direct API call instead of yielding since suffix mapping is missing
            try:
                resp = self.metadata.client.put(
                    path="/drives/spreadsheets",
                    data=spreadsheet_request.model_dump_json(),
                )
                logger.debug(f"Created spreadsheet: {spreadsheet_data['name']}")
            except Exception as e:
                logger.warning(
                    f"Failed to create spreadsheet {spreadsheet_data['name']}: {e}"
                )

            # Store FQN for worksheet references
            # Build FQN manually - spreadsheets use simple FQN without directory path
            spreadsheet_fqn = f"{self.drive_service.fullyQualifiedName.root}.{spreadsheet_data['name']}"
            spreadsheet_refs[spreadsheet_data["name"]] = spreadsheet_fqn
            logger.debug(
                f"Stored spreadsheet ref: {spreadsheet_data['name']} -> {spreadsheet_fqn}"
            )

        # Create worksheets
        for worksheet_data in self.worksheets:
            spreadsheet_fqn = spreadsheet_refs.get(worksheet_data["spreadsheet"])
            logger.debug(
                f"Creating worksheet {worksheet_data['name']} for spreadsheet {worksheet_data['spreadsheet']} -> {spreadsheet_fqn}"
            )

            if not spreadsheet_fqn:
                logger.warning(
                    f"Spreadsheet {worksheet_data['spreadsheet']} not found in refs"
                )
                continue

            worksheet_request = CreateWorksheetRequest(
                name=worksheet_data["name"],
                displayName=worksheet_data.get("displayName"),
                description=worksheet_data.get("description"),
                spreadsheet=spreadsheet_fqn,
                columns=worksheet_data.get("columns", []),
                isHidden=worksheet_data.get("isHidden", False),
                tags=worksheet_data.get("tags", []),
            )

            # Use direct API call instead of yielding since suffix mapping is missing
            try:
                resp = self.metadata.client.put(
                    path="/drives/worksheets", data=worksheet_request.model_dump_json()
                )
                logger.debug(f"Created worksheet: {worksheet_data['name']}")
            except Exception as e:
                logger.warning(
                    f"Failed to create worksheet {worksheet_data['name']}: {e}"
                )

    def ingest_mysql(self) -> Iterable[Either[Entity]]:
        """Ingest Sample Data for mysql database source including ER diagrams metadata"""

        db = CreateDatabaseRequest(
            name=self.mysql_database["name"],
            service=self.mysql_database_service.fullyQualifiedName,
            sourceUrl=self.mysql_database.get("sourceUrl"),
        )

        yield Either(right=db)

        database_entity = fqn.build(
            self.metadata,
            entity_type=Database,
            service_name=self.mysql_database_service.fullyQualifiedName.root,
            database_name=db.name.root,
        )

        database_object = self.metadata.get_by_name(
            entity=Database, fqn=database_entity
        )
        schema = CreateDatabaseSchemaRequest(
            name=self.mysql_database_schema["name"],
            database=database_object.fullyQualifiedName,
            sourceUrl=self.mysql_database_schema.get("sourceUrl"),
        )
        yield Either(right=schema)

        database_schema_entity = fqn.build(
            self.metadata,
            entity_type=DatabaseSchema,
            service_name=self.mysql_database_service.fullyQualifiedName.root,
            database_name=db.name.root,
            schema_name=schema.name.root,
        )

        database_schema_object = self.metadata.get_by_name(
            entity=DatabaseSchema, fqn=database_schema_entity
        )

        for table in self.mysql_tables["tables"]:
            table_request = CreateTableRequest(
                name=table["name"],
                description=table["description"],
                columns=table["columns"],
                databaseSchema=database_schema_object.fullyQualifiedName,
                tableConstraints=table.get("tableConstraints"),
                tableType=table["tableType"],
                sourceUrl=table.get("sourceUrl"),
                domains=["TestDomain"],
            )
            yield Either(right=table_request)

    def ingest_glue(self) -> Iterable[Either[Entity]]:
        """Ingest Sample Data for glue database source"""

        db = CreateDatabaseRequest(
            name=self.glue_database["name"],
            description=self.glue_database["description"],
            service=self.glue_database_service.fullyQualifiedName,
            sourceUrl=self.glue_database.get("sourceUrl"),
        )

        yield Either(right=db)

        database_entity = fqn.build(
            self.metadata,
            entity_type=Database,
            service_name=self.glue_database_service.fullyQualifiedName.root,
            database_name=db.name.root,
        )

        database_object = self.metadata.get_by_name(
            entity=Database, fqn=database_entity
        )
        schema = CreateDatabaseSchemaRequest(
            name=self.glue_database_schema["name"],
            description=self.glue_database_schema["description"],
            database=database_object.fullyQualifiedName,
            sourceUrl=self.glue_database_schema.get("sourceUrl"),
        )
        yield Either(right=schema)

        database_schema_entity = fqn.build(
            self.metadata,
            entity_type=DatabaseSchema,
            service_name=self.glue_database_service.fullyQualifiedName.root,
            database_name=db.name.root,
            schema_name=schema.name.root,
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
                sourceUrl=table.get("sourceUrl"),
            )
            yield Either(right=table_request)

        database_schema_entity = fqn.build(
            self.metadata,
            entity_type=DatabaseSchema,
            service_name=self.database_service.fullyQualifiedName.root,
            database_name=self.database["name"],
            schema_name=self.database_schema["name"],
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
                sourceUrl=table.get("sourceUrl"),
            )
            yield Either(right=table_request)

    def ingest_tables(self) -> Iterable[Either[Entity]]:
        """Ingest Sample Tables"""

        db = CreateDatabaseRequest(
            name=self.database["name"],
            description=self.database["description"],
            service=FullyQualifiedEntityName(
                self.database_service.fullyQualifiedName.root
            ),
        )
        yield Either(right=db)

        database_entity = fqn.build(
            self.metadata,
            entity_type=Database,
            service_name=self.database_service.name.root,
            database_name=db.name.root,
        )

        database_object = self.metadata.get_by_name(
            entity=Database, fqn=database_entity
        )

        schema = CreateDatabaseSchemaRequest(
            name=self.database_schema["name"],
            description=self.database_schema["description"],
            database=database_object.fullyQualifiedName,
            sourceUrl=self.database_schema.get("sourceUrl"),
        )
        yield Either(right=schema)

        database_schema_entity = fqn.build(
            self.metadata,
            entity_type=DatabaseSchema,
            service_name=self.database_service.name.root,
            database_name=db.name.root,
            schema_name=schema.name.root,
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
                schemaDefinition=table.get("schemaDefinition"),
                sourceUrl=table.get("sourceUrl"),
                tablePartition=table.get("tablePartition"),
            )

            yield Either(right=table_and_db)

            if table.get("sampleData"):
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.database_service.name.root,
                    database_name=db.name.root,
                    schema_name=schema.name.root,
                    table_name=table_and_db.name.root,
                )

                table_entity = self.metadata.get_by_name(entity=Table, fqn=table_fqn)

                self.metadata.ingest_table_sample_data(
                    table_entity,
                    sample_data=SamplerResponse(
                        table=table_entity,
                        sample_data=SampleData(
                            data=TableData(
                                rows=table["sampleData"]["rows"],
                                columns=table["sampleData"]["columns"],
                            ),
                            store=True,
                        ),
                    ).sample_data.data,
                )

            if table.get("customMetrics"):
                for custom_metric in table["customMetrics"]:
                    self.metadata.create_or_update_custom_metric(
                        CreateCustomMetricRequest(**custom_metric),
                        table_entity.id.root,
                    )

            for column in table.get("columns"):
                if column.get("customMetrics"):
                    for custom_metric in column["customMetrics"]:
                        self.metadata.create_or_update_custom_metric(
                            CreateCustomMetricRequest(**custom_metric),
                            table_entity.id.root,
                        )

    def ingest_stored_procedures(self) -> Iterable[Either[Entity]]:
        """Ingest Sample Stored Procedures"""

        db = CreateDatabaseRequest(
            name=self.database["name"],
            description=self.database["description"],
            service=FullyQualifiedEntityName(
                self.database_service.fullyQualifiedName.root
            ),
        )
        yield Either(right=db)

        database_entity = fqn.build(
            self.metadata,
            entity_type=Database,
            service_name=self.database_service.name.root,
            database_name=db.name.root,
        )

        database_object = self.metadata.get_by_name(
            entity=Database, fqn=database_entity
        )

        schema = CreateDatabaseSchemaRequest(
            name=self.database_schema["name"],
            description=self.database_schema["description"],
            database=database_object.fullyQualifiedName,
            sourceUrl=self.database_schema.get("sourceUrl"),
        )
        yield Either(right=schema)

        database_schema_entity = fqn.build(
            self.metadata,
            entity_type=DatabaseSchema,
            service_name=self.database_service.name.root,
            database_name=db.name.root,
            schema_name=schema.name.root,
        )

        database_schema_object = self.metadata.get_by_name(
            entity=DatabaseSchema, fqn=database_schema_entity
        )

        resp = self.metadata.list_entities(entity=User, limit=5)
        self.user_entity = resp.entities

        for stored_procedure in self.stored_procedures["storedProcedures"]:
            stored_procedure = CreateStoredProcedureRequest(
                name=stored_procedure["name"],
                description=stored_procedure["description"],
                storedProcedureCode=StoredProcedureCode(
                    **stored_procedure["storedProcedureCode"]
                ),
                databaseSchema=database_schema_object.fullyQualifiedName,
                tags=stored_procedure["tags"],
                sourceUrl=stored_procedure.get("sourceUrl"),
            )

            yield Either(right=stored_procedure)

        # Create table and stored procedure lineage
        for lineage_entities in self.stored_procedures["lineage"]:
            from_table = self.metadata.get_by_name(
                entity=Table, fqn=lineage_entities["from_table_fqn"]
            )
            stored_procedure_entity = self.metadata.get_by_name(
                entity=StoredProcedure, fqn=lineage_entities["stored_procedure_fqn"]
            )
            to_table = self.metadata.get_by_name(
                entity=Table, fqn=lineage_entities["to_table_fqn"]
            )
            yield Either(
                right=AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(id=from_table.id.root, type="table"),
                        toEntity=EntityReference(id=to_table.id.root, type="table"),
                        lineageDetails=LineageDetails(
                            pipeline=EntityReference(
                                id=stored_procedure_entity.id.root,
                                type="storedProcedure",
                            )
                        ),
                    )
                )
            )

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

                create_topic.messageSchema = TopicSchema(
                    schemaText=topic["schemaText"],
                    schemaType=topic["schemaType"],
                    schemaFields=schema_fields,
                )

            yield Either(right=create_topic)

            if topic.get("sampleData"):
                topic_fqn = fqn.build(
                    self.metadata,
                    entity_type=Topic,
                    service_name=self.kafka_service.name.root,
                    topic_name=topic["name"],
                )

                topic_entity = self.metadata.get_by_name(entity=Topic, fqn=topic_fqn)

                self.metadata.ingest_topic_sample_data(
                    topic=topic_entity,
                    sample_data=TopicSampleData(messages=topic["sampleData"]),
                )

    def ingest_search_indexes(self) -> Iterable[Either[CreateSearchIndexRequest]]:
        """Ingest Sample SearchIndexes"""

        for search_index in self.search_indexes["searchIndexes"]:
            search_index["service"] = EntityReference(
                id=self.search_service.id, type="searchService"
            )
            create_search_index = CreateSearchIndexRequest(
                name=search_index["name"],
                description=search_index["description"],
                displayName=search_index["displayName"],
                tags=search_index["tags"],
                fields=search_index["fields"],
                service=self.search_service.fullyQualifiedName,
            )

            yield Either(right=create_search_index)

    def ingest_looker(self) -> Iterable[Either[Entity]]:
        """Looker sample data"""

        for data_model in self.looker_models:
            try:
                data_model_ev = CreateDashboardDataModelRequest(
                    name=data_model["name"],
                    displayName=data_model["displayName"],
                    description=data_model["description"],
                    columns=data_model["columns"],
                    dataModelType=data_model["dataModelType"],
                    sql=data_model["sql"],
                    serviceType=data_model["serviceType"],
                    service=self.looker_service.fullyQualifiedName,
                )
                yield Either(right=data_model_ev)
            except ValidationError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unexpected exception ingesting chart [{data_model}]: {err}"
                )

        for chart in self.looker_charts:
            try:
                chart_ev = CreateChartRequest(
                    name=chart["name"],
                    displayName=chart["displayName"],
                    description=chart["description"],
                    chartType=get_standard_chart_type(chart["chartType"]),
                    sourceUrl=chart["sourceUrl"],
                    service=self.looker_service.fullyQualifiedName,
                )
                yield Either(right=chart_ev)
            except ValidationError as err:
                logger.debug(traceback.format_exc())
                logger.warning(f"Unexpected exception ingesting chart [{chart}]: {err}")

        for dashboard in self.looker_dashboards:
            try:
                dashboard_ev = CreateDashboardRequest(
                    name=dashboard["name"],
                    displayName=dashboard["displayName"],
                    description=dashboard["description"],
                    sourceUrl=dashboard["sourceUrl"],
                    charts=dashboard["charts"],
                    dataModels=dashboard.get("dataModels", None),
                    service=self.looker_service.fullyQualifiedName,
                )
                yield Either(right=dashboard_ev)
            except ValidationError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unexpected exception ingesting dashboard [{dashboard}]: {err}"
                )

        orders_view = self.metadata.get_by_name(
            entity=DashboardDataModel, fqn="sample_looker.model.orders_view"
        )
        operations_view = self.metadata.get_by_name(
            entity=DashboardDataModel, fqn="sample_looker.model.operations_view"
        )
        orders_explore = self.metadata.get_by_name(
            entity=DashboardDataModel, fqn="sample_looker.model.orders"
        )
        orders_dashboard = self.metadata.get_by_name(
            entity=Dashboard, fqn="sample_looker.orders"
        )

        yield Either(
            right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(
                        id=orders_view.id.root, type="dashboardDataModel"
                    ),
                    toEntity=EntityReference(
                        id=orders_explore.id.root, type="dashboardDataModel"
                    ),
                )
            )
        )

        yield Either(
            right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(
                        id=operations_view.id.root, type="dashboardDataModel"
                    ),
                    toEntity=EntityReference(
                        id=orders_explore.id.root, type="dashboardDataModel"
                    ),
                )
            )
        )

        yield Either(
            right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(
                        id=orders_explore.id.root, type="dashboardDataModel"
                    ),
                    toEntity=EntityReference(
                        id=orders_dashboard.id.root, type="dashboard"
                    ),
                )
            )
        )

    def ingest_charts(self) -> Iterable[CreateChartRequest]:
        for chart in self.charts["charts"]:
            try:
                chart_ev = CreateChartRequest(
                    name=chart["name"],
                    displayName=chart["displayName"],
                    description=chart["description"],
                    chartType=get_standard_chart_type(chart["chartType"]),
                    sourceUrl=chart["sourceUrl"],
                    service=self.dashboard_service.fullyQualifiedName,
                )
                yield Either(right=chart_ev)
            except ValidationError as err:
                logger.debug(traceback.format_exc())
                logger.warning(f"Unexpected exception ingesting chart [{chart}]: {err}")

    def ingest_data_models(self) -> Iterable[Either[CreateDashboardDataModelRequest]]:
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
                yield Either(right=data_model_ev)
            except ValidationError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unexpected exception ingesting chart [{data_model}]: {err}"
                )

    def ingest_dashboards(self) -> Iterable[Either[CreateDashboardRequest]]:
        for dashboard in self.dashboards["dashboards"]:
            dashboard_ev = CreateDashboardRequest(
                name=dashboard["name"],
                displayName=dashboard["displayName"],
                description=dashboard["description"],
                sourceUrl=dashboard["sourceUrl"],
                charts=dashboard["charts"],
                dataModels=dashboard.get("dataModels", None),
                service=self.dashboard_service.fullyQualifiedName,
            )
            yield Either(right=dashboard_ev)

    def ingest_pipelines(self) -> Iterable[Either[Pipeline]]:
        for pipeline in self.pipelines["pipelines"]:
            owners = None
            if pipeline.get("owner"):
                owners = self.metadata.get_reference_by_email(
                    email=pipeline.get("owners")
                )
            pipeline_ev = CreatePipelineRequest(
                name=pipeline["name"],
                displayName=pipeline["displayName"],
                description=pipeline["description"],
                sourceUrl=pipeline["sourceUrl"],
                tasks=pipeline["tasks"],
                service=self.pipeline_service.fullyQualifiedName,
                owners=owners,
                scheduleInterval=pipeline.get("scheduleInterval"),
            )
            yield Either(right=pipeline_ev)

    def ingest_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        for edge in self.lineage:
            from_entity_ref = get_lineage_entity_ref(edge["from"], self.metadata)
            to_entity_ref = get_lineage_entity_ref(edge["to"], self.metadata)
            edge_entity_ref = get_lineage_entity_ref(edge["edge_meta"], self.metadata)
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
            yield Either(right=lineage)

    def ingest_pipeline_status(self) -> Iterable[Either[OMetaPipelineStatus]]:
        """Ingest sample pipeline status"""

        for status_data in self.pipeline_status:
            pipeline_fqn = status_data["pipeline"]
            for status in status_data["pipelineStatus"]:
                status["timestamp"] = time.time_ns() // 1_000_000
                yield Either(
                    right=OMetaPipelineStatus(
                        pipeline_fqn=pipeline_fqn,
                        pipeline_status=PipelineStatus(**status),
                    )
                )

    def get_ml_feature_sources(self, feature: dict) -> List[FeatureSource]:
        """Build FeatureSources from sample data"""

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
        """Build MlFeatures from sample data"""

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

    def ingest_mlmodels(self) -> Iterable[Either[CreateMlModelRequest]]:
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
                    dashboard=dashboard.fullyQualifiedName.root,
                    mlStore=(
                        MlStore(
                            storage=model["mlStore"]["storage"],
                            imageRepository=model["mlStore"]["imageRepository"],
                        )
                        if model.get("mlStore")
                        else None
                    ),
                    server=model.get("server"),
                    target=model.get("target"),
                    mlFeatures=self.get_ml_features(model),
                    mlHyperParameters=[
                        MlHyperParameter(name=param["name"], value=param["value"])
                        for param in model.get("mlHyperParameters", [])
                    ],
                    service=self.model_service.fullyQualifiedName,
                )
                yield Either(right=model_ev)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error ingesting MlModel [{model}]: {exc}")

    def ingest_containers(self) -> Iterable[Either[CreateContainerRequest]]:
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
                    parent=(
                        EntityReference(id=parent_container.id, type="container")
                        if parent_container_fqn
                        else None
                    ),
                    prefix=container["prefix"],
                    dataModel=container.get("dataModel"),
                    numberOfObjects=container.get("numberOfObjects"),
                    size=container.get("size"),
                    fileFormats=container.get("fileFormats"),
                    service=self.storage_service.fullyQualifiedName,
                )
                yield Either(right=container_request)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error ingesting Container [{container}]: {exc}")

        # Create a very nested container structure:
        try:
            long_base_name = (
                "".join(random.choice(string.ascii_letters) for _ in range(100))
                + "{suffix}"
            )
            for base_name in ("deep_nested_container_{suffix}", long_base_name):
                parent_container_fqns = []
                # We cannot go deeper than this
                for i in range(1, 6):
                    parent_container: Container = (
                        self.metadata.get_by_name(
                            entity=Container,
                            fqn=self.storage_service.fullyQualifiedName.root
                            + FQN_SEPARATOR
                            + FQN_SEPARATOR.join(parent_container_fqns),
                        )
                        if parent_container_fqns
                        else None
                    )
                    name = base_name.format(suffix=i)
                    parent_container_fqns.append(name)
                    yield Either(
                        right=CreateContainerRequest(
                            name=name,
                            parent=(
                                EntityReference(
                                    id=parent_container.id, type="container"
                                )
                                if parent_container
                                else None
                            ),
                            service=self.storage_service.fullyQualifiedName,
                        )
                    )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error ingesting nested containers: {exc}")

    def ingest_users(self) -> Iterable[Either[OMetaUserProfile]]:
        """Ingest Sample User data"""

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

                yield Either(
                    right=OMetaUserProfile(user=user_metadata, teams=teams, roles=roles)
                )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Error ingesting users: {exc}")

    def ingest_profiles(self) -> Iterable[Either[OMetaTableProfileSampleData]]:
        """Iterate over all the profile data and ingest them"""
        for table_profile in self.profiles["profiles"]:
            table = self.metadata.get_by_name(
                entity=Table,
                fqn=table_profile["fqn"],
            )
            for days, profile in enumerate(table_profile["profile"]):
                table_profile = OMetaTableProfileSampleData(
                    table=table,
                    profile=CreateTableProfileRequest(
                        tableProfile=TableProfile(
                            columnCount=profile["columnCount"],
                            rowCount=profile["rowCount"],
                            createDateTime=profile.get("createDateTime"),
                            sizeInByte=profile.get("sizeInByte"),
                            customMetrics=profile.get("customMetrics"),
                            timestamp=Timestamp(
                                int(
                                    (datetime.now() - timedelta(days=days)).timestamp()
                                    * 1000
                                )
                            ),
                        ),
                        columnProfile=[
                            ColumnProfile(
                                timestamp=Timestamp(
                                    int(
                                        (
                                            datetime.now() - timedelta(days=days)
                                        ).timestamp()
                                        * 1000
                                    )
                                ),
                                **col_profile,
                            )
                            for col_profile in profile["columnProfile"]
                        ],
                        systemProfile=[
                            SystemProfile(
                                timestamp=Timestamp(
                                    int(
                                        (
                                            datetime.now()
                                            - timedelta(
                                                days=days, hours=random.randint(0, 24)
                                            )
                                        ).timestamp()
                                        * 1000
                                    )
                                ),
                                **system_profile,
                            )
                            for system_profile in profile["systemProfile"]
                        ],
                    ),
                )
                yield Either(right=table_profile)

    def ingest_test_suite(self) -> Iterable[Either[OMetaTestSuiteSample]]:
        """Iterate over all the testSuite and testCase and ingest them"""
        for test_suite in self.tests_suites["tests"]:
            yield Either(
                right=OMetaTestSuiteSample(
                    test_suite=CreateTestSuiteRequest(
                        name=test_suite["testSuiteName"],
                        description=test_suite["testSuiteDescription"],
                        basicEntityReference=test_suite["executableEntityReference"],
                    )
                )
            )

    def ingest_logical_test_suite(
        self,
    ) -> Iterable[Either[OMetaLogicalTestSuiteSample]]:
        """Iterate over all the logical testSuite and testCase and ingest them"""
        for logical_test_suite in self.logical_test_suites["tests"]:
            test_suite = CreateTestSuiteRequest(
                name=logical_test_suite["testSuiteName"],
                description=logical_test_suite["testSuiteDescription"],
            )  # type: ignore
            test_cases: List[TestCase] = []
            for test_case in logical_test_suite["testCases"]:
                test_case = self.metadata.get_by_name(
                    entity=TestCase,
                    fqn=test_case["fqn"],
                    fields=["testSuite", "testDefinition"],
                )
                if test_case:
                    test_cases.append(test_case)

            yield Either(
                right=OMetaLogicalTestSuiteSample(
                    test_suite=test_suite, test_cases=test_cases
                )
            )

    def ingest_test_case(self) -> Iterable[Either[OMetaTestCaseSample]]:
        """Ingest test cases"""
        for test_suite in self.tests_suites["tests"]:
            suite = self.metadata.get_by_name(
                fqn=test_suite["testSuiteName"], entity=TestSuite
            )
            for test_case in test_suite["testCases"]:
                test_case_req = OMetaTestCaseSample(
                    test_case=CreateTestCaseRequest(
                        name=test_case["name"],
                        description=test_case["description"],
                        testDefinition=test_case["testDefinitionName"],
                        entityLink=test_case["entityLink"],
                        parameterValues=[
                            TestCaseParameterValue(**param_values)
                            for param_values in test_case["parameterValues"]
                        ],
                        useDynamicAssertion=test_case.get("useDynamicAssertion", False),
                    )  # type: ignore
                )
                yield Either(right=test_case_req)

    def ingest_incidents(self) -> Iterable[Either[OMetaTestCaseResolutionStatus]]:
        """
        Ingest incidents after the first test failures have been added.

        The test failure already creates the incident with NEW, so we
        start always from ACK in the sample flows.
        """
        for test_suite in self.tests_suites["tests"]:
            for test_case in test_suite["testCases"]:
                test_case_fqn = f"{entity_link.get_table_or_column_fqn(test_case['entityLink'])}.{test_case['name']}"

                for _, resolutions in test_case["resolutions"].items():
                    for resolution in resolutions:
                        create_test_case_resolution = CreateTestCaseResolutionStatus(
                            testCaseResolutionStatusType=resolution[
                                "testCaseResolutionStatusType"
                            ],
                            testCaseReference=test_case_fqn,
                            severity=resolution["severity"],
                        )

                        if resolution["testCaseResolutionStatusType"] == "Assigned":
                            user: User = self.metadata.get_by_name(
                                User, fqn=resolution["assignee"]
                            )
                            create_test_case_resolution.testCaseResolutionStatusDetails = Assigned(
                                assignee=EntityReference(
                                    id=user.id.root,
                                    type="user",
                                    name=user.name.root,
                                    fullyQualifiedName=user.fullyQualifiedName.root,
                                )
                            )
                        if resolution["testCaseResolutionStatusType"] == "Resolved":
                            user: User = self.metadata.get_by_name(
                                User, fqn=resolution["resolver"]
                            )
                            create_test_case_resolution.testCaseResolutionStatusDetails = Resolved(
                                resolvedBy=EntityReference(
                                    id=user.id.root,
                                    type="user",
                                    name=user.name.root,
                                    fullyQualifiedName=user.fullyQualifiedName.root,
                                ),
                                testCaseFailureReason=random.choice(
                                    list(TestCaseFailureReasonType)
                                ),
                                testCaseFailureComment="Resolution comment",
                            )

                        yield Either(
                            right=OMetaTestCaseResolutionStatus(
                                test_case_resolution=create_test_case_resolution
                            )
                        )

    def ingest_test_case_results(self) -> Iterable[Either[OMetaTestCaseResultsSample]]:
        """Iterate over all the testSuite and testCase and ingest them"""
        for test_case_results in self.tests_case_results["testCaseResults"]:
            case = self.metadata.get_by_name(
                TestCase,
                f"sample_data.ecommerce_db.shopify.dim_address.{test_case_results['name']}",
                fields=["testSuite", "testDefinition"],
            )
            if case:
                for days, result in enumerate(test_case_results["results"]):
                    test_case_result_req = OMetaTestCaseResultsSample(
                        test_case_results=TestCaseResult(
                            timestamp=Timestamp(
                                int(
                                    (datetime.now() - timedelta(days=days)).timestamp()
                                    * 1000
                                )
                            ),
                            testCaseStatus=result["testCaseStatus"],
                            result=result["result"],
                            testResultValue=[
                                TestResultValue.model_validate(res_value)
                                for res_value in result["testResultValues"]
                            ],
                            minBound=result.get("minBound"),
                            maxBound=result.get("maxBound"),
                        ),
                        test_case_name=case.fullyQualifiedName.root,
                    )
                    yield Either(right=test_case_result_req)
            if test_case_results.get("failedRowsSample"):
                self.metadata.ingest_failed_rows_sample(
                    case,
                    TableData(
                        rows=test_case_results["failedRowsSample"]["rows"],
                        columns=test_case_results["failedRowsSample"]["columns"],
                    ),
                    validate=test_case_results["failedRowsSample"].get(
                        "validate", True
                    ),
                )
            if test_case_results.get("inspectionQuery"):
                self.metadata.ingest_inspection_query(
                    case,
                    test_case_results["inspectionQuery"],
                )

    def ingest_data_insights(self) -> Iterable[Either[OMetaDataInsightSample]]:
        """Iterate over all the data insights and ingest them"""
        data: Dict[str, List] = self.data_insight_data["reports"]

        for report_type, report_data in data.items():
            i = 0
            for report_datum in report_data:
                if report_type == ReportDataType.rawCostAnalysisReportData.value:
                    start_ts = int(
                        (datetime.now(timezone.utc) - timedelta(days=60)).timestamp()
                        * 1000
                    )
                    end_ts = int(datetime.now(timezone.utc).timestamp() * 1000)
                    tmstp = random.randint(start_ts, end_ts)
                    report_datum["data"]["lifeCycle"]["accessed"]["timestamp"] = tmstp
                record = OMetaDataInsightSample(
                    record=ReportData(
                        id=report_datum["id"],
                        reportDataType=report_datum["reportDataType"],
                        timestamp=Timestamp(
                            root=int(
                                (datetime.now() - timedelta(days=i)).timestamp() * 1000
                            )
                        ),
                        data=report_datum["data"],
                    )
                )
                i += 1
                yield Either(left=None, right=record)

    def ingest_life_cycle(self) -> Iterable[Either[OMetaLifeCycleData]]:
        """Iterate over all the life cycle data and ingest them"""
        for table_life_cycle in self.life_cycle_data["lifeCycleData"]:
            life_cycle = table_life_cycle["lifeCycle"]
            life_cycle_data = LifeCycle()
            life_cycle_data.created = AccessDetails(
                timestamp=Timestamp(
                    int(
                        datetime_to_timestamp(
                            datetime_value=datetime.now()
                            - timedelta(days=life_cycle["created"]["days"]),
                            milliseconds=True,
                        )
                    )
                ),
                accessedByAProcess=life_cycle["created"].get("accessedByAProcess"),
            )

            life_cycle_data.updated = AccessDetails(
                timestamp=Timestamp(
                    int(
                        datetime_to_timestamp(
                            datetime_value=datetime.now()
                            - timedelta(days=life_cycle["updated"]["days"]),
                            milliseconds=True,
                        )
                    ),
                ),
                accessedByAProcess=life_cycle["updated"].get("accessedByAProcess"),
            )

            life_cycle_data.accessed = AccessDetails(
                timestamp=Timestamp(
                    int(
                        datetime_to_timestamp(
                            datetime_value=datetime.now()
                            - timedelta(days=life_cycle["accessed"]["days"]),
                            milliseconds=True,
                        )
                    ),
                ),
                accessedByAProcess=life_cycle["accessed"].get("accessedByAProcess"),
            )

            if life_cycle["created"].get("accessedBy"):
                life_cycle_data.created.accessedBy = self.get_accessed_by(
                    life_cycle["created"]["accessedBy"]["name"]
                )

            if life_cycle["updated"].get("accessedBy"):
                life_cycle_data.updated.accessedBy = self.get_accessed_by(
                    life_cycle["updated"]["accessedBy"]["name"]
                )

            if life_cycle["accessed"].get("accessedBy"):
                life_cycle_data.accessed.accessedBy = self.get_accessed_by(
                    life_cycle["accessed"]["accessedBy"]["name"]
                )

            life_cycle_request = OMetaLifeCycleData(
                entity=Table,
                entity_fqn=table_life_cycle["fqn"],
                life_cycle=life_cycle_data,
            )
            yield Either(right=life_cycle_request)

    def get_accessed_by(self, accessed_by) -> EntityReference:
        return self.metadata.get_entity_reference(entity=User, fqn=accessed_by)

    def close(self):
        """Nothing to close"""

    def test_connection(self) -> None:
        """Custom sources don't support testing connections"""

    def ingest_api_service(self) -> Iterable[Either[Entity]]:
        """Ingest API services"""

        collection_request = CreateAPICollectionRequest(**self.api_collection)
        yield Either(right=collection_request)

        for endpoint in self.api_endpoint.get("endpoints"):
            endpoint_request = CreateAPIEndpointRequest(**endpoint)
            yield Either(right=endpoint_request)

    def ingest_ometa_api_service(self) -> Iterable[Either[Entity]]:
        """Ingest users & tables ometa API services"""

        for collection in self.ometa_api_collection.get("collections"):
            collection_request = CreateAPICollectionRequest(**collection)
            yield Either(right=collection_request)

        for endpoint in self.ometa_api_endpoint.get("endpoints"):
            endpoint_request = CreateAPIEndpointRequest(**endpoint)
            yield Either(right=endpoint_request)

    def create_database_service(self, service_idx: int) -> None:
        """Create a database service and its databases.

        Args:
            service_idx: Service index
        """
        service_name = f"openmetadata-{service_idx}"

        try:
            # Create minimal Snowflake connection
            connection = DatabaseConnection(
                config=SnowflakeConnection(
                    username="dummy",
                    password="dummy",  # This will be handled by the library
                    account="dummy",
                    database="dummy",
                    warehouse="dummy",
                )
            )

            # Create service with minimal required fields
            yield Either(
                right=CreateDatabaseServiceRequest(
                    name=service_name,
                    serviceType=DatabaseServiceType.Snowflake,
                    connection=connection,
                )
            )

            logger.info(f"Created database service {service_name} ({NUM_SERVICES})")
            tasks = []
            # Create databases sequentially
            for db_idx in range(DATABASES_PER_SERVICE):
                yield from self.create_database(service_name, db_idx)

        except Exception as e:
            logger.error(f"Failed to create database service {service_name}: {e}")

    def process_service_batch(self) -> None:
        """Process a batch of services.

        Args:
            start_idx: Start index of service batch
            end_idx: End index of service batch
        """

        services_per_thread = NUM_SERVICES // NUM_THREADS
        # Create tasks for each thread
        for service_idx in range(NUM_SERVICES):
            yield from self.create_database_service(service_idx)

        # create table and column lineage from the snowflake sample data to Mysql Table `Tags`
        yield from self.create_table_lineage()

    def create_table_lineage(self) -> None:
        """Create table lineage from the snowflake sample data to Mysql Table `Tags`"""
        source_table_list = list(
            self.metadata.list_entities(
                entity=Table,
                limit=5,
                params={"database": "openmetadata-0.openmetadata-db-0"},
            ).entities
        )
        destination_table = self.metadata.get_by_name(
            Table, "mysql_sample.default.posts_db.Tags"
        )

        for source_table in source_table_list:
            yield Either(
                right=AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(id=source_table.id, type="table"),
                        toEntity=EntityReference(id=destination_table.id, type="table"),
                        lineageDetails=LineageDetails(
                            columnsLineage=[
                                ColumnLineage(
                                    fromColumns=[
                                        from_column.fullyQualifiedName.root
                                        for from_column in source_table.columns
                                    ][:5],
                                    toColumn=to_column.fullyQualifiedName.root,
                                )
                                for to_column in destination_table.columns
                            ]
                        ),
                    )
                )
            )

    def create_database(self, service_name: str, db_idx: int) -> None:
        """Create a database.

        Args:
            service_name: Service name
            db_idx: Database index
        """
        db_name = f"openmetadata-db-{db_idx}"

        try:
            # Create with minimal required fields
            db_request = Either(
                right=CreateDatabaseRequest(name=db_name, service=service_name)
            )
            yield db_request
            database_fqn = f"{service_name}.{db_name}"

            # Create schemas sequentially to avoid overwhelming the API
            for schema_idx in range(SCHEMAS_PER_DATABASE):
                yield from self.create_schema(database_fqn, schema_idx)

        except Exception as e:
            logger.error(f"Failed to create database {db_name}: {e}")

    def create_schema(self, database_fqn: str, schema_idx: int) -> None:
        """Create a schema.

        Args:
            database_fqn: Database FQN
            schema_idx: Schema index
        """
        schema_name = f"openmetadata-schema-{schema_idx}"

        try:
            # Create with minimal required fields
            schema_request = Either(
                right=CreateDatabaseSchemaRequest(
                    name=schema_name, database=database_fqn
                )
            )
            yield schema_request
            schema_name = f"{database_fqn}.{schema_name}"
            # Create tables sequentially to avoid overwhelming the API
            yield from self.create_table(schema_name)

        except Exception as e:
            logger.error(f"Failed to create schema {schema_name}: {e}")

    def create_table(self, schema_fqn: str) -> None:
        """Create a batch of tables for a schema.

        Args:
            schema_fqn: Fully qualified schema name
        """
        # Create table requests
        for i in range(TABLES_PER_SCHEMA):
            table_name = f"openmetadata-table-{i}"

            # Create with minimal required fields
            try:
                owner = self.metadata.get_by_name(User, "admin")
                table_request = Either(
                    right=CreateTableRequest(
                        name=table_name,
                        databaseSchema=schema_fqn,
                        columns=COLUMNS,
                        description=random.choice(
                            [f"This is {table_name} description.", None]
                        ),
                        owners=random.choice(
                            [
                                EntityReferenceList(
                                    [EntityReference(id=owner.id, type="user")]
                                ),
                                None,
                            ] 
                        ) if owner else None,
                    )
                )
                yield table_request
            except Exception as e:
                logger.warning(f"Error creating table request: {e}")
