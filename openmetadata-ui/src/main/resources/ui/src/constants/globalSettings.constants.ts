/*
 *  Copyright 2022 Collate
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

export const GLOBAL_SETTINGS_MENU = [
  {
    category: 'Access',
    items: ['Teams', 'Users', 'Roles'],
  },
  {
    category: 'Services',
    items: ['Databases', 'Messaging', 'Dashboards', 'Pipelines', 'ML Models'],
  },
  {
    category: 'Custom Attributes',
    items: ['Tables', 'Topics', 'Dashboards', 'Pipelines', 'ML Models'],
  },
  {
    category: 'Integrations',
    items: ['Webhook', 'Slack', 'Bots'],
  },
];

export const customAttributesPath = {
  tables: 'table',
  topics: 'topic',
  dashboards: 'dashboard',
  pipelines: 'pipeline',
  mlModels: 'mlmodel',
};

export enum GlobalSettingsMenuCategory {
  ACCESS = 'access',
  SERVICES = 'services',
  CUSTOM_ATTRIBUTES = 'customAttributes',
  INTEGRATIONS = 'integrations',
}

export enum GlobalSettingOptions {
  USERS = 'users',
  TEAMS = 'teams',
  ROLES = 'roles',
  POLICIES = 'policies',
  DATABASES = 'databases',
  MESSAGING = 'messaging',
  DASHBOARDS = 'dashboards',
  PIPELINES = 'pipelines',
  MLMODELS = 'mlModels',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  BOTS = 'bots',
  TABLES = 'tables',
}
