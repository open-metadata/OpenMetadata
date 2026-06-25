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
  Browser,
  ClipboardMinus,
  CodeCircle01,
  Codepen,
  CodeSquare01,
  CodeSquare02,
  Columns02,
  Cube01,
  CubeOutline,
  Database01,
  Dataflow02,
  Dataflow03,
  Dataflow04,
  File02,
  File06,
  FileCheck02,
  Folder,
  Globe02,
  MessageSquare02,
  SearchMd,
  Settings02,
  SlashCircle01,
  Table,
  Tag01,
} from '@untitledui/icons';
import React from 'react';
import { ReactComponent as AIAutomation } from '../assets/svg/entity/ai-automation.svg';
import { ReactComponent as APIService } from '../assets/svg/entity/api-service.svg';
import { ReactComponent as Chart } from '../assets/svg/entity/chart.svg';
import { ReactComponent as ContextMemory } from '../assets/svg/entity/context-memory.svg';
import { ReactComponent as DashboardService } from '../assets/svg/entity/dashboard-service.svg';
import { ReactComponent as Dashboard } from '../assets/svg/entity/dashboard.svg';
import { ReactComponent as DatabaseService } from '../assets/svg/entity/database-service.svg';
import { ReactComponent as DriveService } from '../assets/svg/entity/drive-service.svg';
import { ReactComponent as DynamicAgent } from '../assets/svg/entity/dynamic-agent.svg';
import { ReactComponent as Marketplace } from '../assets/svg/entity/marketplace.svg';
import { ReactComponent as MetadataService } from '../assets/svg/entity/metadata-service.svg';
import { ReactComponent as MLModelService } from '../assets/svg/entity/ml-model-service.svg';
import { ReactComponent as PipelineService } from '../assets/svg/entity/pipeline-service.svg';
import { ReactComponent as SpreadSheet } from '../assets/svg/entity/spreadsheet.svg';
import { ReactComponent as StorageService } from '../assets/svg/entity/storage-service.svg';
import { ReactComponent as StoredProcedure } from '../assets/svg/entity/stored-procedure.svg';
import { ReactComponent as TestCase } from '../assets/svg/entity/test-case.svg';
import { ReactComponent as TestSuite } from '../assets/svg/entity/test-suite.svg';
import { AssetsUnion } from '../components/DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import i18n from '../utils/i18next/LocalUtil';

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
    iconClass: 'tw:text-utility-purple-600',
    bgClass: 'tw:bg-utility-purple-50',
    borderClass: 'tw:border-utility-purple-200',
    icon: Table,
  },
  [EntityType.DASHBOARD]: {
    iconClass: 'tw:text-utility-blue-700',
    bgClass: 'tw:bg-utility-blue-50',
    borderClass: 'tw:border-utility-blue-200',
    icon: Dashboard,
  },
  [EntityType.TABLE_COLUMN]: {
    iconClass: 'tw:text-utility-error-600',
    bgClass: 'tw:bg-utility-error-50',
    borderClass: 'tw:border-utility-error-200',
    icon: Columns02,
  },
  [EntityType.PIPELINE]: {
    iconClass: 'tw:text-utility-success-600',
    bgClass: 'tw:bg-utility-success-50',
    borderClass: 'tw:border-utility-success-200',
    icon: Dataflow02,
  },
  [EntityType.DATA_PRODUCT]: {
    iconClass: 'tw:text-utility-warning-600',
    bgClass: 'tw:bg-utility-warning-50',
    borderClass: 'tw:border-utility-warning-300',
    icon: Cube01,
  },
  [EntityType.CHART]: {
    iconClass: 'tw:text-utility-fuchsia-600',
    bgClass: 'tw:bg-utility-fuchsia-50',
    borderClass: 'tw:border-utility-fuchsia-200',
    icon: Chart,
  },
  [EntityType.MESSAGING_SERVICE]: {
    iconClass: 'tw:text-utility-warning-600',
    bgClass: 'tw:bg-utility-warning-50',
    borderClass: 'tw:border-utility-warning-300',
    icon: MessageSquare02,
  },
  [EntityType.DASHBOARD_SERVICE]: {
    iconClass: 'tw:text-utility-blue-700',
    bgClass: 'tw:bg-utility-blue-50',
    borderClass: 'tw:border-utility-blue-200',
    icon: DashboardService,
  },
  [EntityType.GLOSSARY_TERM]: {
    iconClass: 'tw:text-moss-600 tw:dark:text-moss-400',
    bgClass: 'tw:bg-moss-50 tw:dark:bg-moss-950',
    borderClass: 'tw:border-moss-200 tw:dark:border-moss-800',
    icon: File02,
  },
  [EntityType.STORAGE_SERVICE]: {
    iconClass: 'tw:text-utility-fuchsia-600',
    bgClass: 'tw:bg-utility-fuchsia-50',
    borderClass: 'tw:border-utility-fuchsia-200',
    icon: StorageService,
  },
  [EntityType.CONTAINER]: {
    iconClass: 'tw:text-utility-warning-600',
    bgClass: 'tw:bg-utility-warning-50',
    borderClass: 'tw:border-utility-warning-300',
    icon: Browser,
  },
  [EntityType.DATABASE_SCHEMA]: {
    iconClass: 'tw:text-cyan-700 tw:dark:text-cyan-300',
    bgClass: 'tw:bg-cyan-50 tw:dark:bg-cyan-950',
    borderClass: 'tw:border-cyan-100 tw:dark:border-cyan-900',
    icon: Dataflow04,
  },
  [EntityType.TAG]: {
    iconClass: 'tw:text-teal-600 tw:dark:text-teal-400',
    bgClass: 'tw:bg-teal-50 tw:dark:bg-teal-950',
    borderClass: 'tw:border-teal-300 tw:dark:border-teal-700',
    icon: Tag01,
  },
  [EntityType.DASHBOARD_DATA_MODEL]: {
    iconClass: 'tw:text-utility-indigo-600',
    bgClass: 'tw:bg-utility-indigo-50',
    borderClass: 'tw:border-utility-indigo-300',
    icon: Codepen,
  },
  [EntityType.DATABASE]: {
    iconClass: 'tw:text-utility-pink-600',
    bgClass: 'tw:bg-utility-pink-50',
    borderClass: 'tw:border-utility-pink-200',
    icon: Database01,
  },
  [EntityType.STORED_PROCEDURE]: {
    iconClass: 'tw:text-rose-600 tw:dark:text-rose-400',
    bgClass: 'tw:bg-rose-50 tw:dark:bg-rose-950',
    borderClass: 'tw:border-rose-200 tw:dark:border-rose-800',
    icon: StoredProcedure,
  },
  [EntityType.KNOWLEDGE_PAGE]: {
    iconClass: 'tw:text-utility-blue-700',
    bgClass: 'tw:bg-utility-blue-50',
    borderClass: 'tw:border-utility-blue-200',
    icon: File06,
  },
  [EntityType.WORKSHEET]: {
    iconClass: 'tw:text-utility-purple-600',
    bgClass: 'tw:bg-utility-purple-50',
    borderClass: 'tw:border-utility-purple-200',
    icon: ClipboardMinus,
  },
  [EntityType.DATABASE_SERVICE]: {
    iconClass: 'tw:text-utility-pink-600',
    bgClass: 'tw:bg-utility-pink-50',
    borderClass: 'tw:border-utility-pink-200',
    icon: DatabaseService,
  },
  [EntityType.MLMODEL]: {
    iconClass: 'tw:text-utility-blue-700',
    bgClass: 'tw:bg-utility-blue-50',
    borderClass: 'tw:border-utility-blue-200',
    icon: CubeOutline,
  },
  [EntityType.CLASSIFICATION]: {
    iconClass: 'tw:text-utility-purple-600',
    bgClass: 'tw:bg-utility-purple-50',
    borderClass: 'tw:border-utility-purple-200',
    icon: Dataflow03,
  },
  [EntityType.GLOSSARY]: {
    iconClass: 'tw:text-utility-purple-600',
    bgClass: 'tw:bg-utility-purple-50',
    borderClass: 'tw:border-utility-purple-200',
    icon: File02,
  },
  [EntityType.METRIC]: {
    iconClass: 'tw:text-teal-600 tw:dark:text-teal-400',
    bgClass: 'tw:bg-teal-50 tw:dark:bg-teal-950',
    borderClass: 'tw:border-teal-300 tw:dark:border-teal-700',
    icon: ClipboardMinus,
  },
  [EntityType.DRIVE_SERVICE]: {
    iconClass: 'tw:text-utility-fuchsia-600',
    bgClass: 'tw:bg-utility-fuchsia-50',
    borderClass: 'tw:border-utility-fuchsia-200',
    icon: DriveService,
  },
  [EntityType.SPREADSHEET]: {
    iconClass: 'tw:text-utility-fuchsia-600',
    bgClass: 'tw:bg-utility-fuchsia-50',
    borderClass: 'tw:border-utility-fuchsia-200',
    icon: SpreadSheet,
  },
  [EntityType.DIRECTORY]: {
    iconClass: 'tw:text-utility-success-600',
    bgClass: 'tw:bg-utility-success-50',
    borderClass: 'tw:border-utility-success-200',
    icon: FileCheck02,
  },
  [EntityType.TOPIC]: {
    iconClass: 'tw:text-utility-warning-600',
    bgClass: 'tw:bg-utility-warning-50',
    borderClass: 'tw:border-utility-warning-300',
    icon: File02,
  },
  [EntityType.FILE]: {
    iconClass: 'tw:text-utility-blue-700',
    bgClass: 'tw:bg-utility-blue-50',
    borderClass: 'tw:border-utility-blue-200',
    icon: Folder,
  },
  [EntityType.MLMODEL_SERVICE]: {
    iconClass: 'tw:text-rose-600 tw:dark:text-rose-400',
    bgClass: 'tw:bg-rose-50 tw:dark:bg-rose-950',
    borderClass: 'tw:border-rose-200 tw:dark:border-rose-800',
    icon: MLModelService,
  },
  [EntityType.PIPELINE_SERVICE]: {
    iconClass: 'tw:text-utility-fuchsia-600',
    bgClass: 'tw:bg-utility-fuchsia-50',
    borderClass: 'tw:border-utility-fuchsia-200',
    icon: PipelineService,
  },
  [EntityType.DOMAIN]: {
    iconClass: 'tw:text-utility-pink-600',
    bgClass: 'tw:bg-utility-pink-50',
    borderClass: 'tw:border-utility-pink-200',
    icon: Globe02,
  },
  [EntityType.METADATA_SERVICE]: {
    iconClass: 'tw:text-utility-pink-600',
    bgClass: 'tw:bg-utility-pink-50',
    borderClass: 'tw:border-utility-pink-200',
    icon: MetadataService,
  },
  [EntityType.API_ENDPOINT]: {
    iconClass: 'tw:text-teal-600 tw:dark:text-teal-400',
    bgClass: 'tw:bg-teal-50 tw:dark:bg-teal-950',
    borderClass: 'tw:border-teal-300 tw:dark:border-teal-700',
    icon: CodeCircle01,
  },
  [EntityType.API_SERVICE]: {
    iconClass: 'tw:text-utility-fuchsia-600',
    bgClass: 'tw:bg-utility-fuchsia-50',
    borderClass: 'tw:border-utility-fuchsia-200',
    icon: APIService,
  },
  [EntityType.API_COLLECTION]: {
    iconClass: 'tw:text-utility-fuchsia-600',
    bgClass: 'tw:bg-utility-fuchsia-50',
    borderClass: 'tw:border-utility-fuchsia-200',
    icon: CodeSquare02,
  },
  [EntityType.SERVICE]: {
    iconClass: 'tw:text-utility-fuchsia-600',
    bgClass: 'tw:bg-utility-fuchsia-50',
    borderClass: 'tw:border-utility-fuchsia-200',
    icon: Settings02,
  },
  [EntityType.SEARCH_SERVICE]: {
    iconClass: 'tw:text-utility-purple-600',
    bgClass: 'tw:bg-utility-purple-50',
    borderClass: 'tw:border-utility-purple-200',
    icon: SearchMd,
  },
  contextFile: {
    iconClass: 'tw:text-utility-fuchsia-600',
    bgClass: 'tw:bg-utility-fuchsia-50',
    borderClass: 'tw:border-utility-fuchsia-200',
    icon: File02,
  },
   [EntityType.SEARCH_INDEX]: {
    iconClass: 'tw:text-utility-warning-600',
    bgClass: 'tw:bg-utility-warning-50',
    borderClass: 'tw:border-utility-warning-300',
    icon: SearchMd,
  },
  contextMemory: {
    iconClass: 'tw:text-teal-600 tw:dark:text-teal-400',
    bgClass: 'tw:bg-teal-50 tw:dark:bg-teal-950',
    borderClass: 'tw:border-teal-300 tw:dark:border-teal-700',
    icon: ContextMemory,
  },
  aiAutomation: {
    iconClass: 'tw:text-moss-600 tw:dark:text-moss-400',
    bgClass: 'tw:bg-moss-50 tw:dark:bg-moss-950',
    borderClass: 'tw:border-moss-200 tw:dark:border-moss-800',
    icon: AIAutomation,
  },
  marketplace: {
    iconClass: 'tw:text-utility-warning-600',
    bgClass: 'tw:bg-utility-warning-50',
    borderClass: 'tw:border-utility-warning-300',
    icon: Marketplace,
  },
  [EntityType.TEST_CASE]: {
    iconClass: 'tw:text-utility-purple-600',
    bgClass: 'tw:bg-utility-purple-50',
    borderClass: 'tw:border-utility-purple-200',
    icon: TestCase,
  },
  folder: {
    iconClass: 'tw:text-utility-error-600',
    bgClass: 'tw:bg-error-primary',
    borderClass: 'tw:border-utility-error-200',
    icon: Folder,
  },
   contextPlugin: {
    iconClass: 'tw:text-utility-fuchsia-600',
    bgClass: 'tw:bg-utility-fuchsia-50',
    borderClass: 'tw:border-utility-fuchsia-200',
    icon: CodeSquare01,
  },
  dynamicAgent: {
    iconClass: 'tw:text-utility-fuchsia-600',
    bgClass: 'tw:bg-utility-fuchsia-50',
    borderClass: 'tw:border-utility-fuchsia-200',
    icon: DynamicAgent,
  },
  [EntityType.TEST_SUITE]: {
    iconClass: 'tw:text-utility-error-600',
    bgClass: 'tw:bg-error-primary',
    borderClass: 'tw:border-utility-error-200',
    icon: TestSuite,
  },
  default: {
    iconClass: 'tw:text-quanternary',
    bgClass: 'tw:bg-tertiery',
    borderClass: 'tw:border-utility-gray-200',
    icon: SlashCircle01,
  }
};
