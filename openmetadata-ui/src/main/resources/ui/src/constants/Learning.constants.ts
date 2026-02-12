/*
 *  Copyright 2024 Collate.
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

import { ReactNode } from 'react';
import {
  ResourceCategory,
  ResourceType,
  Status as LearningResourceStatus,
} from '../generated/entity/learning/learningResource';

export { LearningResourceStatus, ResourceCategory, ResourceType };

export const MAX_VISIBLE_TAGS = 2;
export const MAX_VISIBLE_CONTEXTS = 2;
export const DEFAULT_PAGE_SIZE = 10;

export const MAX_CHAIN_PAGES = 25;

export const RESOURCE_TYPE_VALUES = [
  ResourceType.Video,
  ResourceType.Storylane,
];

export const YOUTUBE_VIDEO_HOSTNAMES = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
];

export const VIMEO_VIDEO_HOSTNAMES = [
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
];

const VIDEO_HOSTNAMES = [...YOUTUBE_VIDEO_HOSTNAMES, ...VIMEO_VIDEO_HOSTNAMES];

export const isVideoUrl = (url: string | undefined): boolean => {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    return VIDEO_HOSTNAMES.some((h) => h === hostname);
  } catch {
    return false;
  }
};

export interface ResourceTypeOption {
  value: ResourceType;
  label: string;
  icon: ReactNode;
}

export interface CategoryOption {
  value: ResourceCategory;
  label: string;
}

export interface PageIdOption {
  value: string;
  label: string;
}

export const CATEGORIES: CategoryOption[] = [
  { value: ResourceCategory.Discovery, label: 'Discovery' },
  { value: ResourceCategory.DataGovernance, label: 'Governance' },
  { value: ResourceCategory.DataQuality, label: 'Data Quality' },
  { value: ResourceCategory.Observability, label: 'Observability' },
  { value: ResourceCategory.Administration, label: 'Admin' },
  { value: ResourceCategory.AI, label: 'AI' },
];

export const LEARNING_RESOURCE_STATUSES = [
  LearningResourceStatus.Active,
  LearningResourceStatus.Draft,
  LearningResourceStatus.Deprecated,
];

export const DURATIONS = [
  '1 min',
  '2 mins',
  '3 mins',
  '5 mins',
  '10 mins',
  '15 mins',
  '30 mins',
];

export const LEARNING_PAGE_IDS = {
  DOMAIN: 'domain',
  DATA_PRODUCT: 'dataProduct',
  GLOSSARY: 'glossary',
  GLOSSARY_TERM: 'glossaryTerm',
  CLASSIFICATION: 'classification',
  TAGS: 'tags',
  LINEAGE: 'lineage',
  DATA_INSIGHTS: 'dataInsights',
  DATA_INSIGHT_DASHBOARDS: 'dataInsightDashboards',
  DATA_QUALITY: 'dataQuality',
  TEST_SUITE: 'testSuite',
  INCIDENT_MANAGER: 'incidentManager',
  PROFILER_CONFIGURATION: 'profilerConfiguration',
  RULES_LIBRARY: 'rulesLibrary',
  EXPLORE: 'explore',
  TABLE: 'table',
  DASHBOARD: 'dashboard',
  PIPELINE: 'pipeline',
  TOPIC: 'topic',
  CONTAINER: 'container',
  ML_MODEL: 'mlmodel',
  STORED_PROCEDURE: 'storedProcedure',
  SEARCH_INDEX: 'searchIndex',
  API_ENDPOINT: 'apiEndpoint',
  API_COLLECTION: 'apiCollection',
  DATABASE: 'database',
  DATABASE_SCHEMA: 'databaseSchema',
  HOME_PAGE: 'homePage',
  MY_DATA: 'myData',
  WORKFLOWS: 'governanceWorkflows',
  AUTOMATIONS: 'automations',
  KNOWLEDGE_CENTER: 'knowledgeCenter',
  SQL_STUDIO: 'sqlStudio',
  QUERY_BUILDER: 'queryBuilder',
  ASK_COLLATE: 'askCollate',
  AI_ASSISTANT: 'aiAssistant',
  METRICS: 'metrics',
  DATA_OBSERVABILITY: 'dataObservability',
  PIPELINE_OBSERVABILITY: 'pipelineObservability',
  ALERTS: 'alerts',
  SERVICES: 'services',
  POLICIES: 'policies',
  ROLES: 'roles',
  TEAMS: 'teams',
  USERS: 'users',
  NOTIFICATION_TEMPLATES: 'notificationTemplates',
  INGESTION_RUNNERS: 'ingestionRunners',
  USAGE: 'usage',
  SETTINGS: 'settings',
} as const;

export type LearningPageId =
  typeof LEARNING_PAGE_IDS[keyof typeof LEARNING_PAGE_IDS];

export const PAGE_IDS: PageIdOption[] = [
  { value: LEARNING_PAGE_IDS.DOMAIN, label: 'Domain' },
  { value: LEARNING_PAGE_IDS.DATA_PRODUCT, label: 'Data Product' },
  { value: LEARNING_PAGE_IDS.GLOSSARY, label: 'Glossary' },
  { value: LEARNING_PAGE_IDS.GLOSSARY_TERM, label: 'Glossary Term' },
  { value: LEARNING_PAGE_IDS.CLASSIFICATION, label: 'Classification' },
  { value: LEARNING_PAGE_IDS.TAGS, label: 'Tags' },
  { value: LEARNING_PAGE_IDS.LINEAGE, label: 'Lineage' },
  { value: LEARNING_PAGE_IDS.DATA_INSIGHTS, label: 'Data Insights' },
  {
    value: LEARNING_PAGE_IDS.DATA_INSIGHT_DASHBOARDS,
    label: 'Data Insight Dashboards',
  },
  { value: LEARNING_PAGE_IDS.DATA_QUALITY, label: 'Data Quality' },
  { value: LEARNING_PAGE_IDS.TEST_SUITE, label: 'Test Suite' },
  { value: LEARNING_PAGE_IDS.INCIDENT_MANAGER, label: 'Incident Manager' },
  {
    value: LEARNING_PAGE_IDS.PROFILER_CONFIGURATION,
    label: 'Profiler Configuration',
  },
  { value: LEARNING_PAGE_IDS.RULES_LIBRARY, label: 'Rules Library' },
  { value: LEARNING_PAGE_IDS.EXPLORE, label: 'Explore' },
  { value: LEARNING_PAGE_IDS.TABLE, label: 'Table' },
  { value: LEARNING_PAGE_IDS.DASHBOARD, label: 'Dashboard' },
  { value: LEARNING_PAGE_IDS.PIPELINE, label: 'Pipeline' },
  { value: LEARNING_PAGE_IDS.TOPIC, label: 'Topic' },
  { value: LEARNING_PAGE_IDS.CONTAINER, label: 'Container' },
  { value: LEARNING_PAGE_IDS.ML_MODEL, label: 'ML Model' },
  { value: LEARNING_PAGE_IDS.STORED_PROCEDURE, label: 'Stored Procedure' },
  { value: LEARNING_PAGE_IDS.SEARCH_INDEX, label: 'Search Index' },
  { value: LEARNING_PAGE_IDS.API_ENDPOINT, label: 'API Endpoint' },
  { value: LEARNING_PAGE_IDS.API_COLLECTION, label: 'API Collection' },
  { value: LEARNING_PAGE_IDS.DATABASE, label: 'Database' },
  { value: LEARNING_PAGE_IDS.DATABASE_SCHEMA, label: 'Database Schema' },
  { value: LEARNING_PAGE_IDS.HOME_PAGE, label: 'Home Page' },
  { value: LEARNING_PAGE_IDS.MY_DATA, label: 'My Data' },
  { value: LEARNING_PAGE_IDS.WORKFLOWS, label: 'Workflows' },
  { value: LEARNING_PAGE_IDS.AUTOMATIONS, label: 'Automations' },
  { value: LEARNING_PAGE_IDS.KNOWLEDGE_CENTER, label: 'Knowledge Center' },
  { value: LEARNING_PAGE_IDS.SQL_STUDIO, label: 'SQL Studio' },
  { value: LEARNING_PAGE_IDS.QUERY_BUILDER, label: 'Query Builder' },
  { value: LEARNING_PAGE_IDS.ASK_COLLATE, label: 'Ask Collate' },
  { value: LEARNING_PAGE_IDS.AI_ASSISTANT, label: 'AI Assistant' },
  { value: LEARNING_PAGE_IDS.METRICS, label: 'Metrics' },
  { value: LEARNING_PAGE_IDS.DATA_OBSERVABILITY, label: 'Data Observability' },
  {
    value: LEARNING_PAGE_IDS.PIPELINE_OBSERVABILITY,
    label: 'Pipeline Observability',
  },
  { value: LEARNING_PAGE_IDS.ALERTS, label: 'Alerts' },
  { value: LEARNING_PAGE_IDS.SERVICES, label: 'Services' },
  { value: LEARNING_PAGE_IDS.POLICIES, label: 'Policies' },
  { value: LEARNING_PAGE_IDS.ROLES, label: 'Roles' },
  { value: LEARNING_PAGE_IDS.TEAMS, label: 'Teams' },
  { value: LEARNING_PAGE_IDS.USERS, label: 'Users' },
  {
    value: LEARNING_PAGE_IDS.NOTIFICATION_TEMPLATES,
    label: 'Notification Templates',
  },
  { value: LEARNING_PAGE_IDS.INGESTION_RUNNERS, label: 'Ingestion Runners' },
  { value: LEARNING_PAGE_IDS.USAGE, label: 'Usage' },
  { value: LEARNING_PAGE_IDS.SETTINGS, label: 'Settings' },
];
