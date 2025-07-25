import { SearchOutlined } from "@ant-design/icons";
import AlertIcon from "../../../assets/svg/alert.svg";
import AnnouncementIcon from "../../../assets/svg/announcements-black.svg";
import ApplicationIcon from "../../../assets/svg/application.svg";
import AutomatorBotIcon from "../../../assets/svg/automator-bot.svg";
import GlossaryTermIcon from "../../../assets/svg/book.svg";
import BotIcon from "../../../assets/svg/bot.svg";
import ChartIcon from "../../../assets/svg/chart.svg";
import ClassificationIcon from "../../../assets/svg/classification.svg";
import ConversationIcon from "../../../assets/svg/comment.svg";
import IconDataModel from "../../../assets/svg/data-model.svg";
import GlossaryIcon from "../../../assets/svg/glossary.svg";
import APICollectionIcon from "../../../assets/svg/ic-api-collection-default.svg";
import APIEndpointIcon from "../../../assets/svg/ic-api-endpoint-default.svg";
import APIServiceIcon from "../../../assets/svg/ic-api-service-default.svg";
import IconTestCase from "../../../assets/svg/ic-checklist.svg";
import DashboardIcon from "../../../assets/svg/ic-dashboard.svg";
import DataProductIcon from "../../../assets/svg/ic-data-product.svg";
import DatabaseIcon from "../../../assets/svg/ic-database.svg";
import DomainIcon from "../../../assets/svg/ic-domain.svg";
import MlModelIcon from "../../../assets/svg/ic-ml-model.svg";
import PersonaIcon from "../../../assets/svg/ic-personas.svg";
import PipelineIcon from "../../../assets/svg/ic-pipeline.svg";
import SchemaIcon from "../../../assets/svg/ic-schema.svg";
import ContainerIcon from "../../../assets/svg/ic-storage.svg";
import IconStoredProcedure from "../../../assets/svg/ic-stored-procedure.svg";
import TableIcon from "../../../assets/svg/ic-table.svg";
import TeamIcon from "../../../assets/svg/ic-teams.svg";
import TopicIcon from "../../../assets/svg/ic-topic.svg";
import RoleIcon from "../../../assets/svg/icon-role-grey.svg";
import KPIIcon from "../../../assets/svg/kpi.svg";
import LocationIcon from "../../../assets/svg/location.svg";
import MetadataServiceIcon from "../../../assets/svg/metadata-service.svg";
import MetricIcon from "../../../assets/svg/metric.svg";
import NotificationIcon from "../../../assets/svg/notification.svg";
import PolicyIcon from "../../../assets/svg/policies.svg";
import ServicesIcon from "../../../assets/svg/services.svg";
import TagIcon from "../../../assets/svg/tag.svg";
import TaskIcon from "../../../assets/svg/task-ic.svg";
import UserIcon from "../../../assets/svg/user.svg";

// Entity type enum for common-ui
export enum EntityType {
  TABLE = "table",
  TOPIC = "topic",
  CLASSIFICATION = "classification",
  DASHBOARD = "dashboard",
  PIPELINE = "pipeline",
  DATABASE = "database",
  DATABASE_SCHEMA = "databaseSchema",
  GLOSSARY = "glossary",
  GLOSSARY_TERM = "glossaryTerm",
  DATABASE_SERVICE = "databaseService",
  MESSAGING_SERVICE = "messagingService",
  METADATA_SERVICE = "metadataService",
  DASHBOARD_SERVICE = "dashboardService",
  PIPELINE_SERVICE = "pipelineService",
  MLMODEL_SERVICE = "mlmodelService",
  STORAGE_SERVICE = "storageService",
  SEARCH_SERVICE = "searchService",
  WEBHOOK = "webhook",
  MLMODEL = "mlmodel",
  TYPE = "type",
  TEAM = "team",
  USER = "user",
  BOT = "bot",
  ROLE = "role",
  POLICY = "policy",
  TEST_SUITE = "testSuite",
  TEST_CASE = "testCase",
  DATA_INSIGHT_CHART = "dataInsightChart",
  KPI = "kpi",
  ALERT = "alert",
  CONTAINER = "container",
  TAG = "tag",
  DASHBOARD_DATA_MODEL = "dashboardDataModel",
  SUBSCRIPTION = "subscription",
  CHART = "chart",
  DOMAIN = "domain",
  DATA_PRODUCT = "dataProduct",
  SAMPLE_DATA = "sampleData",
  STORED_PROCEDURE = "storedProcedure",
  SEARCH_INDEX = "searchIndex",
  APP_MARKET_PLACE_DEFINITION = "appMarketPlaceDefinition",
  APPLICATION = "app",
  PERSONA = "persona",
  DOC_STORE = "docStore",
  PAGE = "Page",
  KNOWLEDGE_PAGE = "page",
  knowledgePanels = "KnowLedgePanels",
  GOVERN = "govern",
  ALL = "all",
  CUSTOM_METRIC = "customMetric",
  INGESTION_PIPELINE = "ingestionPipeline",
  QUERY = "query",
  ENTITY_REPORT_DATA = "entityReportData",
  WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA = "webAnalyticEntityViewReportData",
  WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA = "webAnalyticUserActivityReportData",
  TEST_CASE_RESOLUTION_STATUS = "test_case_resolution_status_search_index",
  TEST_CASE_RESULT = "test_case_result_search_index",
  EVENT_SUBSCRIPTION = "eventsubscription",
  LINEAGE_EDGE = "lineageEdge",
  API_SERVICE = "apiService",
  API_COLLECTION = "apiCollection",
  API_ENDPOINT = "apiEndpoint",
  METRIC = "metric",
}

// Search index enum for common-ui
export enum SearchIndex {
  ALL = "all",
  TABLE = "table",
  CHART = "chart",
  PIPELINE = "pipeline",
  DASHBOARD = "dashboard",
  MLMODEL = "mlmodel",
  TOPIC = "topic",
  CONTAINER = "container",
  TAG = "tag",
  GLOSSARY_TERM = "glossaryTerm",
  STORED_PROCEDURE = "storedProcedure",
  DASHBOARD_DATA_MODEL = "dashboardDataModel",
  SEARCH_INDEX = "searchIndex",
  DATABASE_SERVICE = "databaseService",
  MESSAGING_SERVICE = "messagingService",
  DASHBOARD_SERVICE = "dashboardService",
  PIPELINE_SERVICE = "pipelineService",
  ML_MODEL_SERVICE = "mlModelService",
  STORAGE_SERVICE = "storageService",
  SEARCH_SERVICE = "searchService",
  DOMAIN = "domain",
  DATA_PRODUCT = "dataProduct",
  DATABASE = "database",
  DATABASE_SCHEMA = "databaseSchema",
  USER = "user",
  TEAM = "team",
  TEST_CASE = "testCase",
  TEST_SUITE = "testSuite",
  GLOSSARY = "glossary",
  INGESTION_PIPELINE = "ingestionPipeline",
  API_SERVICE_INDEX = "apiService",
  API_COLLECTION_INDEX = "apiCollection",
  API_ENDPOINT_INDEX = "apiEndpoint",
  METRIC_SEARCH_INDEX = "metric",
}

export const getEntityTypeIcon = (entityType: string) => {
  const entityIconMapping: Record<string, any> = {
    // Database related
    [EntityType.DATABASE]: DatabaseIcon,
    [EntityType.DATABASE_SERVICE]: DatabaseIcon,
    [EntityType.DATABASE_SCHEMA]: SchemaIcon,

    // Topic and messaging
    [EntityType.TOPIC]: TopicIcon,
    [EntityType.MESSAGING_SERVICE]: TopicIcon,

    // Dashboard related
    [EntityType.DASHBOARD]: DashboardIcon,
    [EntityType.DASHBOARD_SERVICE]: DashboardIcon,

    // ML Model related
    [EntityType.MLMODEL]: MlModelIcon,
    [EntityType.MLMODEL_SERVICE]: MlModelIcon,

    // Pipeline related
    [EntityType.PIPELINE]: PipelineIcon,
    [EntityType.PIPELINE_SERVICE]: PipelineIcon,

    // Container and storage
    [EntityType.CONTAINER]: ContainerIcon,
    [EntityType.STORAGE_SERVICE]: ContainerIcon,

    // Data model and stored procedures
    [EntityType.DASHBOARD_DATA_MODEL]: IconDataModel,
    [EntityType.STORED_PROCEDURE]: IconStoredProcedure,

    // Classification and tags
    [EntityType.CLASSIFICATION]: ClassificationIcon,
    [EntityType.TAG]: TagIcon,

    // Glossary related
    [EntityType.GLOSSARY]: GlossaryIcon,
    [EntityType.GLOSSARY_TERM]: GlossaryTermIcon,

    // Domain
    [EntityType.DOMAIN]: DomainIcon,

    // Chart and table
    [EntityType.CHART]: ChartIcon,
    [EntityType.TABLE]: TableIcon,

    // Services
    [EntityType.METADATA_SERVICE]: MetadataServiceIcon,

    // Data product
    [EntityType.DATA_PRODUCT]: DataProductIcon,

    // Test related
    [EntityType.TEST_CASE]: IconTestCase,
    [EntityType.TEST_SUITE]: IconTestCase,

    // User and team related
    [EntityType.BOT]: BotIcon,
    [EntityType.TEAM]: TeamIcon,
    [EntityType.APPLICATION]: ApplicationIcon,
    [EntityType.PERSONA]: PersonaIcon,
    [EntityType.ROLE]: RoleIcon,
    [EntityType.POLICY]: PolicyIcon,
    [EntityType.EVENT_SUBSCRIPTION]: AlertIcon,
    [EntityType.USER]: UserIcon,

    // Pipeline and alerts
    [EntityType.INGESTION_PIPELINE]: PipelineIcon,
    [EntityType.ALERT]: AlertIcon,
    [EntityType.KPI]: KPIIcon,

    // API related
    [EntityType.API_ENDPOINT]: APIEndpointIcon,
    [EntityType.METRIC]: MetricIcon,
    [EntityType.API_SERVICE]: APIServiceIcon,
    [EntityType.API_COLLECTION]: APICollectionIcon,

    // Additional mappings for entities not in EntityType enum
    tagCategory: ClassificationIcon,
    announcement: AnnouncementIcon,
    conversation: ConversationIcon,
    task: TaskIcon,
    dataQuality: ServicesIcon,
    services: ServicesIcon,
    automator: AutomatorBotIcon,
    notification: NotificationIcon,
    location: LocationIcon,
  };

  // Handle special cases
  if (
    entityType === EntityType.SEARCH_INDEX ||
    entityType === SearchIndex.SEARCH_INDEX ||
    entityType === EntityType.SEARCH_SERVICE ||
    entityType === SearchIndex.SEARCH_SERVICE
  ) {
    return SearchOutlined;
  }

  return entityIconMapping[entityType] || null;
};
