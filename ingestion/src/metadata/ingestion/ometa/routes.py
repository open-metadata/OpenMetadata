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
OMeta API endpoints
"""
from metadata.generated.schema.analytics.webAnalyticEventData import (
    WebAnalyticEventData,
)
from metadata.generated.schema.api.automations.createWorkflow import (
    CreateWorkflowRequest,
)
from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.createBot import CreateBot
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
from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.data.createSearchIndex import (
    CreateSearchIndexRequest,
)
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.docStore.createDocument import CreateDocumentRequest
from metadata.generated.schema.api.domains.createDataProduct import (
    CreateDataProductRequest,
)
from metadata.generated.schema.api.domains.createDomain import CreateDomainRequest
from metadata.generated.schema.api.feed.createSuggestion import CreateSuggestionRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.policies.createPolicy import CreatePolicyRequest
from metadata.generated.schema.api.services.createApiService import (
    CreateApiServiceRequest,
)
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceRequest,
)
from metadata.generated.schema.api.services.createMetadataService import (
    CreateMetadataServiceRequest,
)
from metadata.generated.schema.api.services.createMlModelService import (
    CreateMlModelServiceRequest,
)
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceRequest,
)
from metadata.generated.schema.api.services.createSearchService import (
    CreateSearchServiceRequest,
)
from metadata.generated.schema.api.services.createStorageService import (
    CreateStorageServiceRequest,
)
from metadata.generated.schema.api.services.ingestionPipelines.createIngestionPipeline import (
    CreateIngestionPipelineRequest,
)
from metadata.generated.schema.api.teams.createPersona import CreatePersonaRequest
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.dataInsight.dataInsightChart import DataInsightChart
from metadata.generated.schema.dataInsight.kpi.kpi import Kpi
from metadata.generated.schema.entity.applications.app import App
from metadata.generated.schema.entity.applications.createAppRequest import (
    CreateAppRequest,
)
from metadata.generated.schema.entity.applications.marketplace.appMarketPlaceDefinition import (
    AppMarketPlaceDefinition,
)
from metadata.generated.schema.entity.applications.marketplace.createAppMarketPlaceDefinitionReq import (
    CreateAppMarketPlaceDefinitionRequest,
)
from metadata.generated.schema.entity.automations.workflow import Workflow
from metadata.generated.schema.entity.bot import Bot
from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.apiEndpoint import APIEndpoint
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.metric import Metric
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.entity.data.report import Report
from metadata.generated.schema.entity.data.searchIndex import SearchIndex
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.docStore.document import Document
from metadata.generated.schema.entity.domains.dataProduct import DataProduct
from metadata.generated.schema.entity.domains.domain import Domain
from metadata.generated.schema.entity.feed.suggestion import Suggestion
from metadata.generated.schema.entity.policies.policy import Policy
from metadata.generated.schema.entity.services.apiService import ApiService
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    TestConnectionDefinition,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.metadataService import MetadataService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.services.searchService import SearchService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.entity.teams.persona import Persona
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import AuthenticationMechanism, User
from metadata.generated.schema.settings.settings import Settings
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.generated.schema.tests.testSuite import TestSuite

ROUTES = {
    MlModel.__name__: "/mlmodels",
    CreateMlModelRequest.__name__: "/mlmodels",
    Chart.__name__: "/charts",
    CreateChartRequest.__name__: "/charts",
    DashboardDataModel.__name__: "/dashboard/datamodels",
    CreateDashboardDataModelRequest.__name__: "/dashboard/datamodels",
    Dashboard.__name__: "/dashboards",
    CreateDashboardRequest.__name__: "/dashboards",
    Database.__name__: "/databases",
    CreateDatabaseRequest.__name__: "/databases",
    DatabaseSchema.__name__: "/databaseSchemas",
    CreateDatabaseSchemaRequest.__name__: "/databaseSchemas",
    Pipeline.__name__: "/pipelines",
    CreatePipelineRequest.__name__: "/pipelines",
    Table.__name__: "/tables",
    CreateTableRequest.__name__: "/tables",
    Topic.__name__: "/topics",
    CreateTopicRequest.__name__: "/topics",
    Metric.__name__: "/metrics",
    CreateMetricRequest.__name__: "/metrics",
    AddLineageRequest.__name__: "/lineage",
    Report.__name__: "/reports",
    Query.__name__: "/queries",
    CreateQueryRequest.__name__: "/queries",
    Container.__name__: "/containers",
    CreateContainerRequest.__name__: "/containers",
    SearchIndex.__name__: "/searchIndexes",
    CreateSearchIndexRequest.__name__: "/searchIndexes",
    StoredProcedure.__name__: "/storedProcedures",
    CreateStoredProcedureRequest.__name__: "/storedProcedures",
    APIEndpoint.__name__: "/apiEndpoints",
    CreateAPIEndpointRequest.__name__: "/apiEndpoints",
    APICollection.__name__: "/apiCollections",
    CreateAPICollectionRequest.__name__: "/apiCollections",
    Document.__name__: "/docStore",
    CreateDocumentRequest.__name__: "/docStore",
    # Classifications
    Tag.__name__: "/tags",
    CreateTagRequest.__name__: "/tags",
    Classification.__name__: "/classifications",
    CreateClassificationRequest.__name__: "/classifications",
    # Glossaries
    Glossary.__name__: "/glossaries",
    CreateGlossaryRequest.__name__: "/glossaries",
    GlossaryTerm.__name__: "/glossaryTerms",
    CreateGlossaryTermRequest.__name__: "/glossaryTerms",
    # Users
    Team.__name__: "/teams",
    CreateTeamRequest.__name__: "/teams",
    User.__name__: "/users",
    CreateUserRequest.__name__: "/users",
    Persona.__name__: "/personas",
    CreatePersonaRequest.__name__: "/personas",
    AuthenticationMechanism.__name__: "/users/auth-mechanism",
    Bot.__name__: "/bots",
    CreateBot.__name__: "/bots",
    # Roles
    Role.__name__: "/roles",
    CreateRoleRequest.__name__: "/roles",
    Policy.__name__: "/policies",
    CreatePolicyRequest.__name__: "/policies",
    # Automations
    Workflow.__name__: "/automations/workflows",
    CreateWorkflowRequest.__name__: "/automations/workflows",
    # Services
    ApiService.__name__: "/services/apiServices",
    CreateApiServiceRequest.__name__: "/services/apiServices",
    DatabaseService.__name__: "/services/databaseServices",
    CreateDatabaseServiceRequest.__name__: "/services/databaseServices",
    DashboardService.__name__: "/services/dashboardServices",
    CreateDashboardServiceRequest.__name__: "/services/dashboardServices",
    MessagingService.__name__: "/services/messagingServices",
    CreateMessagingServiceRequest.__name__: "/services/messagingServices",
    PipelineService.__name__: "/services/pipelineServices",
    CreatePipelineServiceRequest.__name__: "/services/pipelineServices",
    StorageService.__name__: "/services/storageServices",
    CreateStorageServiceRequest.__name__: "/services/storageServices",
    MlModelService.__name__: "/services/mlmodelServices",
    CreateMlModelServiceRequest.__name__: "/services/mlmodelServices",
    MetadataService.__name__: "/services/metadataServices",
    CreateMetadataServiceRequest.__name__: "/services/metadataServices",
    SearchService.__name__: "/services/searchServices",
    CreateSearchServiceRequest.__name__: "/services/searchServices",
    IngestionPipeline.__name__: "/services/ingestionPipelines",
    CreateIngestionPipelineRequest.__name__: "/services/ingestionPipelines",
    TestConnectionDefinition.__name__: "/services/testConnectionDefinitions",
    # Data Quality
    TestDefinition.__name__: "/dataQuality/testDefinitions",
    CreateTestDefinitionRequest.__name__: "/dataQuality/testDefinitions",
    TestSuite.__name__: "/dataQuality/testSuites",
    CreateTestSuiteRequest.__name__: "/dataQuality/testSuites",
    TestCase.__name__: "/dataQuality/testCases",
    CreateTestCaseRequest.__name__: "/dataQuality/testCases",
    # Analytics
    WebAnalyticEventData.__name__: "/analytics/web/events/collect",
    DataInsightChart.__name__: "/analytics/dataInsights/charts",
    Kpi.__name__: "/kpi",
    # Domains & Data Products
    Domain.__name__: "/domains",
    CreateDomainRequest.__name__: "/domains",
    DataProduct.__name__: "/dataProducts",
    CreateDataProductRequest.__name__: "/dataProducts",
    # Suggestions
    Suggestion.__name__: "/suggestions",
    CreateSuggestionRequest.__name__: "/suggestions",
    # Apps
    App.__name__: "/apps",
    CreateAppRequest.__name__: "/apps",
    AppMarketPlaceDefinition.__name__: "/apps/marketplace",
    CreateAppMarketPlaceDefinitionRequest.__name__: "/apps/marketplace",
    # Settings
    Settings.__name__: "/system/settings",
}
