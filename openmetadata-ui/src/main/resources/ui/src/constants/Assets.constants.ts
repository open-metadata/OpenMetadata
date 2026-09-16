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
  Atom01,
  ClipboardMinus,
  CodeSquare01,
  CpuChip01,
  File02,
  File05,
  FileCheck02,
  Server04,
  Settings02,
  SlashDivider,
} from '@untitledui/icons';
import React from 'react';
import { ReactComponent as AlertIcon } from '../assets/svg/alert.svg';
import { ReactComponent as AnnouncementIcon } from '../assets/svg/announcements-black.svg';
import { ReactComponent as AutomatorBotIcon } from '../assets/svg/automator-bot.svg';
import { ReactComponent as ConversationIcon } from '../assets/svg/comment.svg';
import { ReactComponent as ApplicationIcon } from '../assets/svg/common/application.svg';
import { ReactComponent as EventSubscriptionIcon } from '../assets/svg/common/event-subscription.svg';
import { ReactComponent as FileIcon } from '../assets/svg/common/file.svg';
import { ReactComponent as FolderIcon } from '../assets/svg/common/folder.svg';
import { ReactComponent as MemoriesIcon } from '../assets/svg/common/memories.svg';
import { ReactComponent as PersonaIcon } from '../assets/svg/common/persona.svg';
import { ReactComponent as PolicyIcon } from '../assets/svg/common/policy.svg';
import { ReactComponent as RoleIcon } from '../assets/svg/common/role.svg';
import { ReactComponent as TeamIcon } from '../assets/svg/common/teams.svg';
import { ReactComponent as UserIcon } from '../assets/svg/common/user.svg';
import { ReactComponent as KnowledgeCenter } from '../assets/svg/context-center.svg';
import { ReactComponent as AIAutomation } from '../assets/svg/entity/ai-automation.svg';
import { ReactComponent as AIFrameworkControl } from '../assets/svg/entity/ai-framework-control.svg';
import { ReactComponent as AIGovernanceFramework } from '../assets/svg/entity/ai-governance-framework.svg';
import { ReactComponent as AIGovernancePolicy } from '../assets/svg/entity/ai-governance-policy.svg';
import { ReactComponent as APICollection } from '../assets/svg/entity/api-collection.svg';
import { ReactComponent as APIEndpoint } from '../assets/svg/entity/api-endpoint.svg';
import { ReactComponent as APIService } from '../assets/svg/entity/api-service.svg';
import { ReactComponent as AuditReport } from '../assets/svg/entity/audit-report.svg';
import { ReactComponent as BotIcon } from '../assets/svg/entity/bot.svg';
import { ReactComponent as Chart } from '../assets/svg/entity/chart.svg';
import { ReactComponent as Classification } from '../assets/svg/entity/classification.svg';
import { ReactComponent as Column } from '../assets/svg/entity/column.svg';
import { ReactComponent as Container } from '../assets/svg/entity/container.svg';
import { ReactComponent as DashboardDataModel } from '../assets/svg/entity/dashboard-data-model.svg';
import { ReactComponent as DashboardService } from '../assets/svg/entity/dashboard-service.svg';
import { ReactComponent as Dashboard } from '../assets/svg/entity/dashboard.svg';
import { ReactComponent as DataContract } from '../assets/svg/entity/data-contract.svg';
import { ReactComponent as DataObservability } from '../assets/svg/entity/data-observability.svg';
import { ReactComponent as DataProduct } from '../assets/svg/entity/data-product.svg';
import { ReactComponent as DatabaseSchema } from '../assets/svg/entity/database-schema.svg';
import { ReactComponent as DatabaseService } from '../assets/svg/entity/database-service.svg';
import { ReactComponent as DatabaseAsset } from '../assets/svg/entity/database.svg';
import { ReactComponent as Domain } from '../assets/svg/entity/domain.svg';
import { ReactComponent as DriveService } from '../assets/svg/entity/drive-service.svg';
import { ReactComponent as DynamicAgent } from '../assets/svg/entity/dynamic-agent.svg';
import { ReactComponent as GlossaryTerm } from '../assets/svg/entity/glossary-term.svg';
import { ReactComponent as Glossary } from '../assets/svg/entity/glossary.svg';
import { ReactComponent as IngestionPipeline } from '../assets/svg/entity/ingestion-pipeline.svg';
import { ReactComponent as KPIIcon } from '../assets/svg/entity/kpi.svg';
import { ReactComponent as LLMService } from '../assets/svg/entity/llm-service.svg';
import { ReactComponent as Marketplace } from '../assets/svg/entity/marketplace.svg';
import { ReactComponent as MCPService } from '../assets/svg/entity/mcp-service.svg';
import { ReactComponent as MessagingService } from '../assets/svg/entity/messaging-service.svg';
import { ReactComponent as MetadataService } from '../assets/svg/entity/metadata-service.svg';
import { ReactComponent as Metric } from '../assets/svg/entity/metric.svg';
import { ReactComponent as MLModelService } from '../assets/svg/entity/ml-model-service.svg';
import { ReactComponent as MLModel } from '../assets/svg/entity/ml-model.svg';
import { ReactComponent as PipelineService } from '../assets/svg/entity/pipeline-service.svg';
import { ReactComponent as Pipeline } from '../assets/svg/entity/pipeline.svg';
import { ReactComponent as Query } from '../assets/svg/entity/query.svg';
import { ReactComponent as Report } from '../assets/svg/entity/report.svg';
import { ReactComponent as SearchIndexIcon } from '../assets/svg/entity/search-index.svg';
import { ReactComponent as SearchService } from '../assets/svg/entity/search-service.svg';
import { ReactComponent as SecurityService } from '../assets/svg/entity/security-service.svg';
import { ReactComponent as SpreadSheet } from '../assets/svg/entity/spreadsheet.svg';
import { ReactComponent as StorageService } from '../assets/svg/entity/storage-service.svg';
import { ReactComponent as StoredProcedure } from '../assets/svg/entity/stored-procedure.svg';
import { ReactComponent as Table } from '../assets/svg/entity/table.svg';
import { ReactComponent as Tag } from '../assets/svg/entity/tag.svg';
import { ReactComponent as TestCase } from '../assets/svg/entity/test-case.svg';
import { ReactComponent as TestDefinition } from '../assets/svg/entity/test-definition.svg';
import { ReactComponent as TestSuite } from '../assets/svg/entity/test-suite.svg';
import { ReactComponent as Topic } from '../assets/svg/entity/topic.svg';
import { ReactComponent as DataQualityIcon } from '../assets/svg/ic-data-contract.svg';
import { ReactComponent as GovernanceIcon } from '../assets/svg/ic-governance.svg';
import { ReactComponent as LocationIcon } from '../assets/svg/location.svg';
import { ReactComponent as NotificationIcon } from '../assets/svg/notification.svg';
import { ReactComponent as ServicesIcon } from '../assets/svg/services.svg';
import { ReactComponent as TaskIcon } from '../assets/svg/task-ic.svg';
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
    icon: Chart,
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
    icon: Tag,
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
    icon: DatabaseAsset,
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
    icon: FileIcon,
  },
  [EntityType.KNOWLEDGE_CENTER]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: KnowledgeCenter,
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
    icon: MLModel,
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
    icon: SpreadSheet,
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
    icon: MLModelService,
  },
  [EntityType.PIPELINE_SERVICE]: {
    iconClass: TEXT_UTILITY_SUCCESS_600,
    bgClass: BG_UTILITY_SUCCESS_50,
    borderClass: BORDER_UTILITY_SUCCESS_200,
    icon: PipelineService,
  },
  [EntityType.DOMAIN]: {
    iconClass: TEXT_UTILITY_GRAY_BLUE_500,
    bgClass: BG_UTILITY_GRAY_BLUE_50,
    borderClass: BORDER_UTILITY_GRAY_BLUE_200,
    icon: Domain,
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
    icon: APIEndpoint,
  },
  [EntityType.API_SERVICE]: {
    iconClass: TEXT_UTILITY_PINK_600,
    bgClass: BG_UTILITY_PINK_50,
    borderClass: BORDER_UTILITY_PINK_200,
    icon: APIService,
  },
  [EntityType.API_COLLECTION]: {
    iconClass: TEXT_UTILITY_PINK_600,
    bgClass: BG_UTILITY_PINK_50,
    borderClass: BORDER_UTILITY_PINK_200,
    icon: APICollection,
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
    icon: SearchIndexIcon,
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
    icon: MemoriesIcon,
  },
  aiAutomation: {
    iconClass: 'tw:text-moss-600 tw:dark:text-moss-400',
    bgClass: 'tw:bg-moss-50 tw:dark:bg-moss-950',
    borderClass: 'tw:border-moss-200 tw:dark:border-moss-800',
    icon: AIAutomation,
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
    icon: FolderIcon,
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
    icon: AIFrameworkControl,
  },
  aiGovernancePolicy: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: AIGovernancePolicy,
  },
  aiGovernanceFramework: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: AIGovernanceFramework,
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
    icon: LLMService,
  },
  [EntityType.MCP_SERVICE]: {
    iconClass: TEXT_UTILITY_INDIGO_700,
    bgClass: BG_UTILITY_INDIGO_50,
    borderClass: BORDER_UTILITY_INDIGO_200,
    icon: MCPService,
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
    icon: BotIcon,
  },
  [EntityType.TEAM]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: TeamIcon,
  },
  [EntityType.APPLICATION]: {
    iconClass: TEXT_UTILITY_PURPLE_600,
    bgClass: BG_UTILITY_PURPLE_50,
    borderClass: BORDER_UTILITY_PURPLE_200,
    icon: ApplicationIcon,
  },
  [EntityType.PERSONA]: {
    iconClass: TEXT_UTILITY_ORANGE_600,
    bgClass: BG_UTILITY_ORANGE_50,
    borderClass: BORDER_UTILITY_ORANGE_200,
    icon: PersonaIcon,
  },
  [EntityType.ROLE]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: RoleIcon,
  },
  [EntityType.POLICY]: {
    iconClass: TEXT_UTILITY_INDIGO_600,
    bgClass: BG_UTILITY_INDIGO_50,
    borderClass: BORDER_UTILITY_INDIGO_200,
    icon: PolicyIcon,
  },
  [EntityType.EVENT_SUBSCRIPTION]: {
    iconClass: TEXT_TEAL_600_DARK_TEXT_TEAL_400,
    bgClass: BG_TEAL_50_DARK_BG_TEAL_950,
    borderClass: BORDER_TEAL_300_DARK_BORDER_TEAL_700,
    icon: EventSubscriptionIcon,
  },
  [EntityType.USER]: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: UserIcon,
  },
  [EntityType.ALERT]: {
    iconClass: 'tw:text-utility-error-600',
    bgClass: 'tw:bg-utility-error-50',
    borderClass: 'tw:border-utility-error-200',
    icon: AlertIcon,
  },
  [EntityType.KPI]: {
    iconClass: TEXT_UTILITY_SUCCESS_600,
    bgClass: BG_UTILITY_SUCCESS_50,
    borderClass: BORDER_UTILITY_SUCCESS_200,
    icon: KPIIcon,
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
    icon: AnnouncementIcon,
  },
  conversation: {
    iconClass: TEXT_UTILITY_GRAY_600,
    bgClass: BG_UTILITY_GRAY_50,
    borderClass: BORDER_UTILITY_GRAY_200,
    icon: ConversationIcon,
  },
  task: {
    iconClass: TEXT_UTILITY_BLUE_700,
    bgClass: BG_UTILITY_BLUE_50,
    borderClass: BORDER_UTILITY_BLUE_200,
    icon: TaskIcon,
  },
  dataQuality: {
    iconClass: TEXT_UTILITY_SUCCESS_600,
    bgClass: BG_UTILITY_SUCCESS_50,
    borderClass: BORDER_UTILITY_SUCCESS_200,
    icon: DataQualityIcon,
  },
  services: {
    iconClass: TEXT_UTILITY_PURPLE_600,
    bgClass: BG_UTILITY_PURPLE_50,
    borderClass: BORDER_UTILITY_PURPLE_200,
    icon: ServicesIcon,
  },
  automator: {
    iconClass: TEXT_UTILITY_PURPLE_600,
    bgClass: BG_UTILITY_PURPLE_50,
    borderClass: BORDER_UTILITY_PURPLE_200,
    icon: AutomatorBotIcon,
  },
  notification: {
    iconClass: TEXT_UTILITY_ORANGE_600,
    bgClass: BG_UTILITY_ORANGE_50,
    borderClass: BORDER_UTILITY_ORANGE_200,
    icon: NotificationIcon,
  },
  location: {
    iconClass: TEXT_UTILITY_GRAY_600,
    bgClass: BG_UTILITY_GRAY_50,
    borderClass: BORDER_UTILITY_GRAY_200,
    icon: LocationIcon,
  },
  Governance: {
    iconClass: TEXT_UTILITY_INDIGO_600,
    bgClass: BG_UTILITY_INDIGO_50,
    borderClass: BORDER_UTILITY_INDIGO_200,
    icon: GovernanceIcon,
  },
  default: {
    iconClass: 'tw:text-quaternary',
    bgClass: 'tw:bg-tertiary',
    borderClass: BORDER_UTILITY_GRAY_200,
    icon: SlashDivider,
  },
};
