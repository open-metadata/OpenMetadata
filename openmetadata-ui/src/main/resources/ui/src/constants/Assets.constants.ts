/*
 *  Copyright 2023 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import {
  AiAutomation03,
  AiFrameworkControl,
  AiGovernanceFramework,
  Alert,
  Announcement02,
  ApiCollection,
  ApiEndpoint,
  ApiService,
  App,
  AppSearchIndexing,
  Article,
  Atom01,
  AuditReport,
  AutomatorBot,
  Bot,
  Classification,
  ClipboardMinus,
  CodeSquare01,
  Column,
  Container,
  ContextCenter,
  CpuChip01,
  Dashboard,
  DashboardDataModel,
  DashboardService,
  Database,
  DatabaseSchema,
  DatabaseService,
  DataContract,
  DataObservability,
  DataProduct,
  Documents,
  DriveService,
  DynamicAgent,
  Eventsubscription,
  File02,
  File05,
  FileCheck02,
  Globe01,
  Glossary,
  GlossaryTerm,
  Governance,
  IngestionPipeline,
  Kpi,
  LineChartUp01,
  ListConversation,
  LlmService,
  Location,
  Marketplace,
  McpService,
  Memories,
  MessagingService,
  MetadataService,
  Metric,
  MlModel,
  MlModelService,
  Notification,
  Persona,
  Pipeline,
  Policy,
  Query,
  Report,
  Role,
  Scales02,
  SearchService,
  SecurityService,
  Server04,
  Services,
  Settings02,
  SlashDivider,
  Spreadsheet,
  StorageService,
  StoredProcedure,
  Table,
  Tag01,
  Task,
  Teams,
  TestCase,
  TestDefinition,
  TestSuite,
  Topic,
  User01,
} from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { AssetsUnion } from '../components/DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import i18n from '../utils/i18next/LocalUtil';

const BG_TEAL_50_DARK_BG_TEAL_950 = 'tw:bg-teal-50 tw:dark:bg-teal-950';
const BG_UTILITY_BLUE_50 = 'tw:bg-utility-blue-50';
const BG_UTILITY_FUCHSIA_50 = 'tw:bg-utility-fuchsia-50';
const BG_UTILITY_GRAY_50 = 'tw:bg-utility-gray-50';
const BG_UTILITY_GRAY_BLUE_50 = 'tw:bg-utility-gray-blue-50';
const BG_UTILITY_INDIGO_50 = 'tw:bg-utility-indigo-50';
const BG_UTILITY_ORANGE_50 = 'tw:bg-utility-orange-50';
const BG_UTILITY_PINK_50 = 'tw:bg-utility-pink-50';
const BG_UTILITY_PURPLE_50 = 'tw:bg-utility-purple-50';
const BG_UTILITY_SUCCESS_50 = 'tw:bg-utility-success-50';
const BG_UTILITY_WARNING_50 = 'tw:bg-utility-warning-50';
const BORDER_TEAL_300_DARK_BORDER_TEAL_700 =
  'tw:border-teal-300 tw:dark:border-teal-700';
const BORDER_UTILITY_BLUE_200 = 'tw:border-utility-blue-200';
const BORDER_UTILITY_FUCHSIA_200 = 'tw:border-utility-fuchsia-200';
const BORDER_UTILITY_GRAY_200 = 'tw:border-utility-gray-200';
const BORDER_UTILITY_GRAY_BLUE_200 = 'tw:border-utility-gray-blue-200';
const BORDER_UTILITY_INDIGO_200 = 'tw:border-utility-indigo-200';
const BORDER_UTILITY_INDIGO_300 = 'tw:border-utility-indigo-300';
const BORDER_UTILITY_ORANGE_200 = 'tw:border-utility-orange-200';
const BORDER_UTILITY_PINK_200 = 'tw:border-utility-pink-200';
const BORDER_UTILITY_PURPLE_200 = 'tw:border-utility-purple-200';
const BORDER_UTILITY_SUCCESS_200 = 'tw:border-utility-success-200';
const BORDER_UTILITY_WARNING_300 = 'tw:border-utility-warning-300';
const TEXT_TEAL_600_DARK_TEXT_TEAL_400 =
  'tw:text-teal-600 tw:dark:text-teal-400';
const TEXT_UTILITY_BLUE_700 = 'tw:text-utility-blue-700';
const TEXT_UTILITY_FUCHSIA_600 = 'tw:text-utility-fuchsia-600';
const TEXT_UTILITY_GRAY_600 = 'tw:text-utility-gray-600';
const TEXT_UTILITY_GRAY_BLUE_500 = 'tw:text-utility-gray-blue-500';
const TEXT_UTILITY_INDIGO_600 = 'tw:text-utility-indigo-600';
const TEXT_UTILITY_INDIGO_700 = 'tw:text-utility-indigo-700';
const TEXT_UTILITY_ORANGE_600 = 'tw:text-utility-orange-600';
const TEXT_UTILITY_PINK_600 = 'tw:text-utility-pink-600';
const TEXT_UTILITY_PURPLE_600 = 'tw:text-utility-purple-600';
const TEXT_UTILITY_SUCCESS_600 = 'tw:text-utility-success-600';
const TEXT_UTILITY_WARNING_600 = 'tw:text-utility-warning-600';

export const AssetsFilterOptions: Array<{
  label: string;
  key: AssetsUnion;
  value: SearchIndex;
}> = [
  {
    label: i18n.t('label.table-plural'),
    key: EntityType.TABLE,
    value: SearchIndex.TABLE,
  },
  {
    label: i18n.t('label.topic-plural'),
    key: EntityType.TOPIC,
    value: SearchIndex.TOPIC,
  },
  {
    label: i18n.t('label.dashboard-plural'),
    key: EntityType.DASHBOARD,
    value: SearchIndex.DASHBOARD,
  },
  {
    label: i18n.t('label.pipeline-plural'),
    key: EntityType.PIPELINE,
    value: SearchIndex.PIPELINE,
  },
  {
    label: i18n.t('label.ml-model-plural'),
    key: EntityType.MLMODEL,
    value: SearchIndex.MLMODEL,
  },
  {
    label: i18n.t('label.container-plural'),
    key: EntityType.CONTAINER,
    value: SearchIndex.CONTAINER,
  },
  {
    label: i18n.t('label.glossary-plural'),
    key: EntityType.GLOSSARY_TERM,
    value: SearchIndex.GLOSSARY_TERM,
  },
  {
    label: i18n.t('label.stored-procedure-plural'),
    key: EntityType.STORED_PROCEDURE,
    value: SearchIndex.STORED_PROCEDURE,
  },
  {
    label: i18n.t('label.data-model-plural'),
    key: EntityType.DASHBOARD_DATA_MODEL,
    value: SearchIndex.DASHBOARD_DATA_MODEL,
  },
  {
    label: i18n.t('label.database'),
    key: EntityType.DATABASE,
    value: SearchIndex.DATABASE,
  },
  {
    label: i18n.t('label.database-schema'),
    key: EntityType.DATABASE_SCHEMA,
    value: SearchIndex.DATABASE_SCHEMA,
  },

  {
    label: i18n.t('label.search-index'),
    key: EntityType.SEARCH_INDEX,
    value: SearchIndex.SEARCH_INDEX,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.database'),
    }),
    key: EntityType.DATABASE_SERVICE,
    value: SearchIndex.DATABASE_SERVICE,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.messaging'),
    }),
    key: EntityType.MESSAGING_SERVICE,
    value: SearchIndex.MESSAGING_SERVICE,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.dashboard'),
    }),
    key: EntityType.DASHBOARD_SERVICE,
    value: SearchIndex.DASHBOARD_SERVICE,
  },

  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.pipeline'),
    }),
    key: EntityType.PIPELINE_SERVICE,
    value: SearchIndex.PIPELINE_SERVICE,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.ml-model'),
    }),
    key: EntityType.MLMODEL_SERVICE,
    value: SearchIndex.ML_MODEL_SERVICE,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.storage'),
    }),
    key: EntityType.STORAGE_SERVICE,
    value: SearchIndex.STORAGE_SERVICE,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.search-index'),
    }),
    key: EntityType.SEARCH_SERVICE,
    value: SearchIndex.SEARCH_SERVICE,
  },
  {
    label: i18n.t('label.entity-service', {
      entity: i18n.t('label.api-uppercase'),
    }),
    key: EntityType.API_SERVICE,
    value: SearchIndex.API_SERVICE,
  },
  {
    label: i18n.t('label.api-collection-plural'),
    key: EntityType.API_COLLECTION,
    value: SearchIndex.API_COLLECTION,
  },
  {
    label: i18n.t('label.api-endpoint-plural'),
    key: EntityType.API_ENDPOINT,
    value: SearchIndex.API_ENDPOINT,
  },
  {
    label: i18n.t('label.metric-plural'),
    key: EntityType.METRIC,
    value: SearchIndex.METRIC,
  },
];

export const ASSET_MENU_KEYS = [
  EntityType.DOMAIN,
  EntityType.DATABASE,
  EntityType.TOPIC,
  EntityType.PIPELINE,
  EntityType.DASHBOARD,
  EntityType.MLMODEL,
  EntityType.CONTAINER,
  EntityType.SEARCH_INDEX,
  EntityType.GOVERN,
];

export const NON_SERVICE_TYPE_ASSETS = [
  EntityType.GLOSSARY,
  EntityType.GLOSSARY_TERM,
  EntityType.CLASSIFICATION,
  EntityType.TAG,
  EntityType.ALERT,
  EntityType.DATA_PRODUCT,
  EntityType.DOMAIN,
  EntityType.TEST_CASE,
  EntityType.TEST_SUITE,
  EntityType.EVENT_SUBSCRIPTION,
  EntityType.BOT,
  EntityType.TEAM,
  EntityType.APPLICATION,
  EntityType.PERSONA,
  EntityType.ROLE,
  EntityType.POLICY,
  EntityType.KPI,
  EntityType.METRIC,
  EntityType.KNOWLEDGE_PAGE,
  EntityType.KNOWLEDGE_CENTER,
  'tagCategory',
  'announcement',
  'conversation',
  'task',
  'services',
  'automator',
  'notification',
  'folder',
  'contextFile',
  'contextMemory',
  'aiAutomation',
  'contextPlugin',
  'marketplace',
  'dynamicAgent',
  'dataObservability',
  'report',
  'testDefinition',
  'aiGovernanceFramework',
  'aiGovernancePolicy',
  'aiFrameworkControl',
  EntityType.MCP_SERVICE,
  EntityType.LLM_SERVICE,
  EntityType.AUDIT_REPORT,
  EntityType.INGESTION_PIPELINE,
  EntityType.AI_APPLICATION,
  EntityType.LLM_MODEL,
  EntityType.MCP_SERVER,
];

export const ENTITY_ICON_MAPPER: Record<
  string,
  {
    iconClass: string;
    bgClass: string;
    borderClass: string;
    icon: React.ElementType;
  }
> = {
  [EntityType.TABLE]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: Table,
  },
  [EntityType.DASHBOARD]: {
    iconClass: TEXT_UTILITY_PURPLE_600,
    bgClass: BG_UTILITY_PURPLE_50,
    borderClass: BORDER_UTILITY_PURPLE_200,
    icon: Dashboard,
  },
  [EntityType.TABLE_COLUMN]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: Column,
  },
  [EntityType.PIPELINE]: {
    iconClass: TEXT_UTILITY_SUCCESS_600,
    bgClass: BG_UTILITY_SUCCESS_50,
    borderClass: BORDER_UTILITY_SUCCESS_200,
    icon: Pipeline,
  },
  [EntityType.INGESTION_PIPELINE]: {
    iconClass: TEXT_UTILITY_SUCCESS_600,
    bgClass: BG_UTILITY_SUCCESS_50,
    borderClass: BORDER_UTILITY_SUCCESS_200,
    icon: IngestionPipeline,
  },
  [EntityType.DATA_PRODUCT]: {
    iconClass: TEXT_UTILITY_INDIGO_600,
    bgClass: BG_UTILITY_INDIGO_50,
    borderClass: BORDER_UTILITY_INDIGO_300,
    icon: DataProduct,
  },
  [EntityType.CHART]: {
    iconClass: TEXT_UTILITY_PURPLE_600,
    bgClass: BG_UTILITY_PURPLE_50,
    borderClass: BORDER_UTILITY_PURPLE_200,
    icon: LineChartUp01,
  },
  [EntityType.MESSAGING_SERVICE]: {
    iconClass: 'tw:text-cyan-700 tw:dark:text-cyan-300',
    bgClass: 'tw:bg-cyan-50 tw:dark:bg-cyan-950',
    borderClass: 'tw:border-cyan-100 tw:dark:border-cyan-900',
    icon: MessagingService,
  },
  [EntityType.DASHBOARD_SERVICE]: {
    iconClass: TEXT_UTILITY_PURPLE_600,
    bgClass: BG_UTILITY_PURPLE_50,
    borderClass: BORDER_UTILITY_PURPLE_200,
    icon: DashboardService,
  },
  [EntityType.GLOSSARY_TERM]: {
    iconClass: TEXT_UTILITY_GRAY_BLUE_500,
    bgClass: BG_UTILITY_GRAY_BLUE_50,
    borderClass: BORDER_UTILITY_GRAY_BLUE_200,
    icon: GlossaryTerm,
  },
  [EntityType.STORAGE_SERVICE]: {
    iconClass: TEXT_UTILITY_WARNING_600,
    bgClass: BG_UTILITY_WARNING_50,
    borderClass: BORDER_UTILITY_WARNING_300,
    icon: StorageService,
  },
  [EntityType.CONTAINER]: {
    iconClass: TEXT_UTILITY_WARNING_600,
    bgClass: BG_UTILITY_WARNING_50,
    borderClass: BORDER_UTILITY_WARNING_300,
    icon: Container,
  },
  [EntityType.DATABASE_SCHEMA]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: DatabaseSchema,
  },
  [EntityType.TAG]: {
    iconClass: TEXT_UTILITY_GRAY_BLUE_500,
    bgClass: BG_UTILITY_GRAY_BLUE_50,
    borderClass: BORDER_UTILITY_GRAY_BLUE_200,
    icon: Tag01,
  },
  [EntityType.DASHBOARD_DATA_MODEL]: {
    iconClass: TEXT_UTILITY_PURPLE_600,
    bgClass: BG_UTILITY_PURPLE_50,
    borderClass: BORDER_UTILITY_PURPLE_200,
    icon: DashboardDataModel,
  },
  [EntityType.DATABASE]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: Database,
  },
  [EntityType.STORED_PROCEDURE]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: StoredProcedure,
  },
  [EntityType.KNOWLEDGE_PAGE]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: Article,
  },
  [EntityType.KNOWLEDGE_CENTER]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: ContextCenter,
  },
  [EntityType.WORKSHEET]: {
    iconClass: TEXT_UTILITY_PURPLE_600,
    bgClass: BG_UTILITY_PURPLE_50,
    borderClass: BORDER_UTILITY_PURPLE_200,
    icon: ClipboardMinus,
  },
  [EntityType.DATABASE_SERVICE]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: DatabaseService,
  },
  [EntityType.MLMODEL]: {
    iconClass: TEXT_UTILITY_FUCHSIA_600,
    bgClass: BG_UTILITY_FUCHSIA_50,
    borderClass: BORDER_UTILITY_FUCHSIA_200,
    icon: MlModel,
  },
  [EntityType.CLASSIFICATION]: {
    iconClass: TEXT_UTILITY_GRAY_BLUE_500,
    bgClass: BG_UTILITY_GRAY_BLUE_50,
    borderClass: BORDER_UTILITY_GRAY_BLUE_200,
    icon: Classification,
  },
  [EntityType.GLOSSARY]: {
    iconClass: TEXT_UTILITY_GRAY_BLUE_500,
    bgClass: BG_UTILITY_GRAY_BLUE_50,
    borderClass: BORDER_UTILITY_GRAY_BLUE_200,
    icon: Glossary,
  },
  [EntityType.METRIC]: {
    iconClass: 'tw:text-utility-success-700',
    bgClass: BG_UTILITY_SUCCESS_50,
    borderClass: 'tw:border-utility-success-300',
    icon: Metric,
  },
  [EntityType.DRIVE_SERVICE]: {
    iconClass: TEXT_TEAL_600_DARK_TEXT_TEAL_400,
    bgClass: BG_TEAL_50_DARK_BG_TEAL_950,
    borderClass: BORDER_TEAL_300_DARK_BORDER_TEAL_700,
    icon: DriveService,
  },
  [EntityType.SPREADSHEET]: {
    iconClass: TEXT_UTILITY_FUCHSIA_600,
    bgClass: BG_UTILITY_FUCHSIA_50,
    borderClass: BORDER_UTILITY_FUCHSIA_200,
    icon: Spreadsheet,
  },
  [EntityType.DIRECTORY]: {
    iconClass: TEXT_UTILITY_SUCCESS_600,
    bgClass: BG_UTILITY_SUCCESS_50,
    borderClass: BORDER_UTILITY_SUCCESS_200,
    icon: FileCheck02,
  },
  [EntityType.TOPIC]: {
    iconClass: 'tw:text-cyan-700 tw:dark:text-cyan-300',
    bgClass: 'tw:bg-cyan-50 tw:dark:bg-cyan-950',
    borderClass: 'tw:border-cyan-100 tw:dark:border-cyan-900',
    icon: Topic,
  },
  [EntityType.FILE]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: File05,
  },
  [EntityType.MLMODEL_SERVICE]: {
    iconClass: TEXT_UTILITY_FUCHSIA_600,
    bgClass: BG_UTILITY_FUCHSIA_50,
    borderClass: BORDER_UTILITY_FUCHSIA_200,
    icon: MlModelService,
  },
  [EntityType.PIPELINE_SERVICE]: {
    iconClass: TEXT_UTILITY_SUCCESS_600,
    bgClass: BG_UTILITY_SUCCESS_50,
    borderClass: BORDER_UTILITY_SUCCESS_200,
    icon: Pipeline,
  },
  [EntityType.DOMAIN]: {
    iconClass: TEXT_UTILITY_GRAY_BLUE_500,
    bgClass: BG_UTILITY_GRAY_BLUE_50,
    borderClass: BORDER_UTILITY_GRAY_BLUE_200,
    icon: Globe01,
  },
  [EntityType.METADATA_SERVICE]: {
    iconClass: TEXT_UTILITY_GRAY_BLUE_500,
    bgClass: BG_UTILITY_GRAY_BLUE_50,
    borderClass: BORDER_UTILITY_GRAY_BLUE_200,
    icon: MetadataService,
  },
  [EntityType.API_ENDPOINT]: {
    iconClass: TEXT_UTILITY_PINK_600,
    bgClass: BG_UTILITY_PINK_50,
    borderClass: BORDER_UTILITY_PINK_200,
    icon: ApiEndpoint,
  },
  [EntityType.API_SERVICE]: {
    iconClass: TEXT_UTILITY_PINK_600,
    bgClass: BG_UTILITY_PINK_50,
    borderClass: BORDER_UTILITY_PINK_200,
    icon: ApiService,
  },
  [EntityType.API_COLLECTION]: {
    iconClass: TEXT_UTILITY_PINK_600,
    bgClass: BG_UTILITY_PINK_50,
    borderClass: BORDER_UTILITY_PINK_200,
    icon: ApiCollection,
  },
  [EntityType.SERVICE]: {
    iconClass: TEXT_UTILITY_FUCHSIA_600,
    bgClass: BG_UTILITY_FUCHSIA_50,
    borderClass: BORDER_UTILITY_FUCHSIA_200,
    icon: Settings02,
  },
  [EntityType.SEARCH_SERVICE]: {
    iconClass: TEXT_UTILITY_INDIGO_600,
    bgClass: BG_UTILITY_INDIGO_50,
    borderClass: BORDER_UTILITY_INDIGO_300,
    icon: SearchService,
  },
  contextFile: {
    iconClass: TEXT_UTILITY_FUCHSIA_600,
    bgClass: BG_UTILITY_FUCHSIA_50,
    borderClass: BORDER_UTILITY_FUCHSIA_200,
    icon: File02,
  },
  [EntityType.SEARCH_INDEX]: {
    iconClass: TEXT_UTILITY_INDIGO_600,
    bgClass: BG_UTILITY_INDIGO_50,
    borderClass: BORDER_UTILITY_INDIGO_300,
    icon: AppSearchIndexing,
  },
  [EntityType.QUERY]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: Query,
  },
  [EntityType.DATA_CONTRACT]: {
    iconClass: TEXT_UTILITY_INDIGO_600,
    bgClass: BG_UTILITY_INDIGO_50,
    borderClass: BORDER_UTILITY_INDIGO_300,
    icon: DataContract,
  },
  [EntityType.SECURITY_SERVICE]: {
    iconClass: 'tw:text-violet-600 tw:dark:text-violet-400',
    bgClass: 'tw:bg-violet-50 tw:dark:bg-violet-950',
    borderClass: 'tw:border-violet-200 tw:dark:border-violet-800',
    icon: SecurityService,
  },
  contextMemory: {
    iconClass: TEXT_TEAL_600_DARK_TEXT_TEAL_400,
    bgClass: BG_TEAL_50_DARK_BG_TEAL_950,
    borderClass: BORDER_TEAL_300_DARK_BORDER_TEAL_700,
    icon: Memories,
  },
  aiAutomation: {
    iconClass: 'tw:text-moss-600 tw:dark:text-moss-400',
    bgClass: 'tw:bg-moss-50 tw:dark:bg-moss-950',
    borderClass: 'tw:border-moss-200 tw:dark:border-moss-800',
    icon: AiAutomation03,
  },
  marketplace: {
    iconClass: TEXT_UTILITY_WARNING_600,
    bgClass: BG_UTILITY_WARNING_50,
    borderClass: BORDER_UTILITY_WARNING_300,
    icon: Marketplace,
  },
  [EntityType.TEST_CASE]: {
    iconClass: TEXT_TEAL_600_DARK_TEXT_TEAL_400,
    bgClass: BG_TEAL_50_DARK_BG_TEAL_950,
    borderClass: BORDER_TEAL_300_DARK_BORDER_TEAL_700,
    icon: TestCase,
  },
  folder: {
    iconClass: 'tw:text-utility-error-600',
    bgClass: 'tw:bg-error-primary',
    borderClass: 'tw:border-utility-error-200',
    icon: Documents,
  },
  contextPlugin: {
    iconClass: TEXT_UTILITY_FUCHSIA_600,
    bgClass: BG_UTILITY_FUCHSIA_50,
    borderClass: BORDER_UTILITY_FUCHSIA_200,
    icon: CodeSquare01,
  },
  dynamicAgent: {
    iconClass: TEXT_UTILITY_FUCHSIA_600,
    bgClass: BG_UTILITY_FUCHSIA_50,
    borderClass: BORDER_UTILITY_FUCHSIA_200,
    icon: DynamicAgent,
  },
  [EntityType.AI_APPLICATION]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: CpuChip01,
  },
  aiFrameworkControl: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: AiFrameworkControl,
  },
  aiGovernancePolicy: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: Scales02,
  },
  aiGovernanceFramework: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: AiGovernanceFramework,
  },
  [EntityType.LLM_MODEL]: {
    iconClass: 'tw:text-utility-purple-700',
    bgClass: BG_UTILITY_PURPLE_50,
    borderClass: BORDER_UTILITY_PURPLE_200,
    icon: Atom01,
  },
  [EntityType.MCP_SERVER]: {
    iconClass: TEXT_UTILITY_INDIGO_700,
    bgClass: BG_UTILITY_INDIGO_50,
    borderClass: BORDER_UTILITY_INDIGO_200,
    icon: Server04,
  },
  [EntityType.LLM_SERVICE]: {
    iconClass: TEXT_UTILITY_INDIGO_700,
    bgClass: BG_UTILITY_INDIGO_50,
    borderClass: BORDER_UTILITY_INDIGO_200,
    icon: LlmService,
  },
  [EntityType.MCP_SERVICE]: {
    iconClass: TEXT_UTILITY_INDIGO_700,
    bgClass: BG_UTILITY_INDIGO_50,
    borderClass: BORDER_UTILITY_INDIGO_200,
    icon: McpService,
  },
  [EntityType.TEST_SUITE]: {
    iconClass: TEXT_TEAL_600_DARK_TEXT_TEAL_400,
    bgClass: BG_TEAL_50_DARK_BG_TEAL_950,
    borderClass: BORDER_TEAL_300_DARK_BORDER_TEAL_700,
    icon: TestSuite,
  },
  dataObservability: {
    iconClass: 'tw:text-utility-success-700',
    bgClass: BG_UTILITY_SUCCESS_50,
    borderClass: 'tw:border-utility-success-300',
    icon: DataObservability,
  },
  report: {
    iconClass: TEXT_UTILITY_ORANGE_600,
    bgClass: BG_UTILITY_ORANGE_50,
    borderClass: BORDER_UTILITY_ORANGE_200,
    icon: Report,
  },
  [EntityType.AUDIT_REPORT]: {
    iconClass: TEXT_UTILITY_ORANGE_600,
    bgClass: BG_UTILITY_ORANGE_50,
    borderClass: BORDER_UTILITY_ORANGE_200,
    icon: AuditReport,
  },
  testDefinition: {
    iconClass: TEXT_TEAL_600_DARK_TEXT_TEAL_400,
    bgClass: BG_TEAL_50_DARK_BG_TEAL_950,
    borderClass: BORDER_TEAL_300_DARK_BORDER_TEAL_700,
    icon: TestDefinition,
  },
  [EntityType.BOT]: {
    iconClass: TEXT_UTILITY_GRAY_600,
    bgClass: BG_UTILITY_GRAY_50,
    borderClass: BORDER_UTILITY_GRAY_200,
    icon: Bot,
  },
  [EntityType.TEAM]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: Teams,
  },
  [EntityType.APPLICATION]: {
    iconClass: TEXT_UTILITY_PURPLE_600,
    bgClass: BG_UTILITY_PURPLE_50,
    borderClass: BORDER_UTILITY_PURPLE_200,
    icon: App,
  },
  [EntityType.PERSONA]: {
    iconClass: TEXT_UTILITY_ORANGE_600,
    bgClass: BG_UTILITY_ORANGE_50,
    borderClass: BORDER_UTILITY_ORANGE_200,
    icon: Persona,
  },
  [EntityType.ROLE]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: Role,
  },
  [EntityType.POLICY]: {
    iconClass: TEXT_UTILITY_INDIGO_600,
    bgClass: BG_UTILITY_INDIGO_50,
    borderClass: BORDER_UTILITY_INDIGO_200,
    icon: Policy,
  },
  [EntityType.EVENT_SUBSCRIPTION]: {
    iconClass: TEXT_TEAL_600_DARK_TEXT_TEAL_400,
    bgClass: BG_TEAL_50_DARK_BG_TEAL_950,
    borderClass: BORDER_TEAL_300_DARK_BORDER_TEAL_700,
    icon: Eventsubscription,
  },
  [EntityType.USER]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: User01,
  },
  [EntityType.ALERT]: {
    iconClass: 'tw:text-utility-error-600',
    bgClass: 'tw:bg-utility-error-50',
    borderClass: 'tw:border-utility-error-200',
    icon: Alert,
  },
  [EntityType.KPI]: {
    iconClass: TEXT_UTILITY_SUCCESS_600,
    bgClass: BG_UTILITY_SUCCESS_50,
    borderClass: BORDER_UTILITY_SUCCESS_200,
    icon: Kpi,
  },
  tagCategory: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: Classification,
  },
  announcement: {
    iconClass: TEXT_UTILITY_WARNING_600,
    bgClass: BG_UTILITY_WARNING_50,
    borderClass: 'tw:border-utility-warning-200',
    icon: Announcement02,
  },
  conversation: {
    iconClass: TEXT_UTILITY_GRAY_600,
    bgClass: BG_UTILITY_GRAY_50,
    borderClass: BORDER_UTILITY_GRAY_200,
    icon: ListConversation,
  },
  task: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: Task,
  },
  dataQuality: {
    iconClass: TEXT_UTILITY_SUCCESS_600,
    bgClass: BG_UTILITY_SUCCESS_50,
    borderClass: BORDER_UTILITY_SUCCESS_200,
    icon: DataContract,
  },
  services: {
    iconClass: TEXT_UTILITY_PURPLE_600,
    bgClass: BG_UTILITY_PURPLE_50,
    borderClass: BORDER_UTILITY_PURPLE_200,
    icon: Services,
  },
  automator: {
    iconClass: TEXT_UTILITY_PURPLE_600,
    bgClass: BG_UTILITY_PURPLE_50,
    borderClass: BORDER_UTILITY_PURPLE_200,
    icon: AutomatorBot,
  },
  notification: {
    iconClass: TEXT_UTILITY_ORANGE_600,
    bgClass: BG_UTILITY_ORANGE_50,
    borderClass: BORDER_UTILITY_ORANGE_200,
    icon: Notification,
  },
  location: {
    iconClass: TEXT_UTILITY_GRAY_600,
    bgClass: BG_UTILITY_GRAY_50,
    borderClass: BORDER_UTILITY_GRAY_200,
    icon: Location,
  },
  Governance: {
    iconClass: TEXT_UTILITY_INDIGO_600,
    bgClass: BG_UTILITY_INDIGO_50,
    borderClass: BORDER_UTILITY_INDIGO_200,
    icon: Governance,
  },
  default: {
    iconClass: 'tw:text-quaternary',
    bgClass: 'tw:bg-tertiary',
    borderClass: BORDER_UTILITY_GRAY_200,
    icon: SlashDivider,
  },
};
