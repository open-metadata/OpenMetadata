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

import { Icons } from '../utils/SvgUtils';

export const GLOBAL_SETTINGS_MENU = [
  {
    category: 'Access',
    isProtected: false,
    items: [
      { label: 'Teams', isProtected: false, icon: Icons.TEAMS_GREY },
      { label: 'Users', isProtected: true, icon: Icons.USERS },
      { label: 'Admins', isProtected: true, icon: Icons.USERS },
      { label: 'Roles', isProtected: true, icon: Icons.ROLE_GREY },
    ],
  },
  {
    category: 'Services',
    isProtected: false,
    items: [
      { label: 'Databases', isProtected: false, icon: Icons.TABLE_GREY },
      { label: 'Messaging', isProtected: false, icon: Icons.TOPIC_GREY },
      { label: 'Dashboards', isProtected: false, icon: Icons.DASHBOARD_GREY },
      { label: 'Pipelines', isProtected: false, icon: Icons.PIPELINE_GREY },
      { label: 'ML Models', isProtected: false, icon: Icons.MLMODAL },
    ],
  },
  {
    category: 'Custom Attributes',
    isProtected: true,
    items: [
      { label: 'Tables', isProtected: true, icon: Icons.TABLE_GREY },
      { label: 'Topics', isProtected: true, icon: Icons.TOPIC_GREY },
      { label: 'Dashboards', isProtected: true, icon: Icons.DASHBOARD_GREY },
      { label: 'Pipelines', isProtected: true, icon: Icons.PIPELINE_GREY },
      { label: 'ML Models', isProtected: true, icon: Icons.MLMODAL },
    ],
  },
  {
    category: 'Integrations',
    isProtected: true,
    items: [
      { label: 'Webhook', isProtected: true, icon: Icons.WEBHOOK_GREY },
      { label: 'Bots', isProtected: true, icon: Icons.BOT_PROFILE },
    ],
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
  ADMINS = 'admins',
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
