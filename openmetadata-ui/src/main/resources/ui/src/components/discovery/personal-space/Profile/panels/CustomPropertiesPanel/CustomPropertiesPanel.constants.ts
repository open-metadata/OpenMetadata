/*
 *  Copyright 2026 Collate.
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

export const CRUMB = {
  WORKSPACE: 'workspace',
  LANDING: 'landing',
  DETAIL: 'detail',
  ACTION: 'action',
} as const;

export const getTableColumns = (
  t: (key: string) => string
): { id: string; name: string; width?: number }[] => [
  { id: 'name', name: t('label.name') },
  { id: 'type', name: t('label.type') },
  { id: 'config', name: t('label.config') },
  { id: 'description', name: t('label.description') },
  { id: 'actions', name: t('label.action-plural') },
];

export const GROUP_DATABASE_STORAGE = 'DATABASE & STORAGE';
export const GROUP_DASHBOARDS_REPORTING = 'DASHBOARDS & REPORTING';
export const GROUP_PIPELINES_ML = 'PIPELINES & ML';
export const GROUP_API = 'API';
export const GROUP_GOVERNANCE = 'GOVERNANCE';

export const ENTITY_GROUP_MAP: Record<string, string> = {
  apiCollection: GROUP_API,
  apiEndpoint: GROUP_API,
  chart: GROUP_DASHBOARDS_REPORTING,
  container: GROUP_DATABASE_STORAGE,
  dashboard: GROUP_DASHBOARDS_REPORTING,
  dashboardDataModel: GROUP_DASHBOARDS_REPORTING,
  database: GROUP_DATABASE_STORAGE,
  databaseSchema: GROUP_DATABASE_STORAGE,
  dataProduct: GROUP_GOVERNANCE,
  directory: GROUP_DATABASE_STORAGE,
  domain: GROUP_GOVERNANCE,
  file: GROUP_DATABASE_STORAGE,
  glossaryTerm: GROUP_GOVERNANCE,
  metric: GROUP_GOVERNANCE,
  mlmodel: GROUP_PIPELINES_ML,
  pipeline: GROUP_PIPELINES_ML,
  searchIndex: GROUP_PIPELINES_ML,
  spreadsheet: GROUP_DASHBOARDS_REPORTING,
  storedProcedure: GROUP_DATABASE_STORAGE,
  table: GROUP_DATABASE_STORAGE,
  tableColumn: GROUP_DATABASE_STORAGE,
  topic: GROUP_PIPELINES_ML,
  worksheet: GROUP_DASHBOARDS_REPORTING,
};

export const GROUP_ORDER = [
  GROUP_DATABASE_STORAGE,
  GROUP_DASHBOARDS_REPORTING,
  GROUP_PIPELINES_ML,
  GROUP_API,
  GROUP_GOVERNANCE,
];

export const GROUP_LABEL_KEYS: Record<string, string> = {
  [GROUP_DATABASE_STORAGE]: 'label.entity-group-database-and-storage',
  [GROUP_DASHBOARDS_REPORTING]: 'label.entity-group-dashboards-and-reporting',
  [GROUP_PIPELINES_ML]: 'label.entity-group-pipelines-and-ml',
  [GROUP_API]: 'label.entity-group-api',
  [GROUP_GOVERNANCE]: 'label.entity-group-governance',
};
