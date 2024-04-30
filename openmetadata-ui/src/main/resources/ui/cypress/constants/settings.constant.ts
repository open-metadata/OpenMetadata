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

export enum GlobalSettingsMenuCategory {
  ACCESS = 'access',
  NOTIFICATIONS = 'notifications',
  CUSTOM_PROPERTIES = 'customProperties',
  PREFERENCES = 'preferences',
  MEMBERS = 'members',
  SERVICES = 'services',
  BOTS = 'bots',
  APPLICATIONS = 'apps',
}

export enum GlobalSettingOptions {
  USERS = 'users',
  ADMINS = 'admins',
  TEAMS = 'teams',
  PERSONA = 'persona',
  ROLES = 'roles',
  POLICIES = 'policies',
  DATABASES = 'databases',
  DATABASE = 'database',
  DATABASE_SCHEMA = 'databaseSchemas',
  MESSAGING = 'messaging',
  METADATA = 'metadata',
  DASHBOARDS = 'dashboards',
  PIPELINES = 'pipelines',
  MLMODELS = 'mlmodels',
  STORED_PROCEDURES = 'storedProcedures',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  BOTS = 'bots',
  TABLES = 'tables',
  MSTEAMS = 'msteams',
  ACTIVITY_FEED = 'activityFeeds',
  SEARCH = 'search',
  SEARCH_INDEXES = 'searchIndexes',
  DATA_INSIGHT = 'dataInsight',
  EMAIL = 'email',
  NOTIFICATIONS = 'notifications',
  NOTIFICATION = 'notification',
  OBSERVABILITY = 'observability',
  GLOSSARY_TERM = 'glossaryTerm',
  ADD_NOTIFICATION = 'add-notification',
  EDIT_NOTIFICATION = 'edit-notification',
  ADD_OBSERVABILITY = 'add-observability',
  STORAGES = 'storages',
  DATA_INSIGHT_REPORT_ALERT = 'dataInsightReport',
  ADD_DATA_INSIGHT_REPORT_ALERT = 'add-data-insight-report',
  EDIT_DATA_INSIGHT_REPORT_ALERT = 'edit-data-insight-report',
  LOGIN_CONFIGURATION = 'loginConfiguration',
  OPENMETADATA_STATUS = 'openmetadataStatus',
  CUSTOMIZE_LANDING_PAGE = 'customizeLandingPage',
  TOPICS = 'topics',
  CONTAINERS = 'containers',
  APPLICATIONS = 'apps',
  OM_HEALTH = 'om-health',
  APPEARANCE = 'appearance',
}

export const SETTINGS_OPTIONS_PATH = {
  // Services

  [GlobalSettingOptions.DATABASES]: [
    GlobalSettingsMenuCategory.SERVICES,
    `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.DATABASES}`,
  ],
  [GlobalSettingOptions.MESSAGING]: [
    GlobalSettingsMenuCategory.SERVICES,
    `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.MESSAGING}`,
  ],
  [GlobalSettingOptions.DASHBOARDS]: [
    GlobalSettingsMenuCategory.SERVICES,
    `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.DASHBOARDS}`,
  ],
  [GlobalSettingOptions.PIPELINES]: [
    GlobalSettingsMenuCategory.SERVICES,
    `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.PIPELINES}`,
  ],
  [GlobalSettingOptions.MLMODELS]: [
    GlobalSettingsMenuCategory.SERVICES,
    `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.MLMODELS}`,
  ],
  [GlobalSettingOptions.STORAGES]: [
    GlobalSettingsMenuCategory.SERVICES,
    `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.STORAGES}`,
  ],
  [GlobalSettingOptions.SEARCH]: [
    GlobalSettingsMenuCategory.SERVICES,
    `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.SEARCH}`,
  ],
  [GlobalSettingOptions.METADATA]: [
    GlobalSettingsMenuCategory.SERVICES,
    `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.METADATA}`,
  ],

  // Applications

  [GlobalSettingOptions.APPLICATIONS]: [GlobalSettingOptions.APPLICATIONS],

  // Bots

  [GlobalSettingOptions.BOTS]: [GlobalSettingOptions.BOTS],

  // Notification

  [GlobalSettingsMenuCategory.NOTIFICATIONS]: [
    GlobalSettingsMenuCategory.NOTIFICATIONS,
  ],

  // Teams  User Management

  [GlobalSettingOptions.USERS]: [
    GlobalSettingsMenuCategory.MEMBERS,
    `${GlobalSettingsMenuCategory.MEMBERS}.${GlobalSettingOptions.USERS}`,
  ],
  [GlobalSettingOptions.TEAMS]: [
    GlobalSettingsMenuCategory.MEMBERS,
    `${GlobalSettingsMenuCategory.MEMBERS}.${GlobalSettingOptions.TEAMS}`,
  ],
  [GlobalSettingOptions.ADMINS]: [
    GlobalSettingsMenuCategory.MEMBERS,
    `${GlobalSettingsMenuCategory.MEMBERS}.${GlobalSettingOptions.ADMINS}`,
  ],
  [GlobalSettingOptions.PERSONA]: [
    GlobalSettingsMenuCategory.MEMBERS,
    `${GlobalSettingsMenuCategory.MEMBERS}.${GlobalSettingOptions.PERSONA}`,
  ],

  // Access Control

  [GlobalSettingOptions.ROLES]: [
    GlobalSettingsMenuCategory.ACCESS,
    `${GlobalSettingsMenuCategory.ACCESS}.${GlobalSettingOptions.ROLES}`,
  ],
  [GlobalSettingOptions.POLICIES]: [
    GlobalSettingsMenuCategory.ACCESS,
    `${GlobalSettingsMenuCategory.ACCESS}.${GlobalSettingOptions.POLICIES}`,
  ],

  // Open-metadata

  [GlobalSettingOptions.CUSTOMIZE_LANDING_PAGE]: [
    GlobalSettingsMenuCategory.PREFERENCES,
    `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.CUSTOMIZE_LANDING_PAGE}`,
  ],
  [GlobalSettingOptions.EMAIL]: [
    GlobalSettingsMenuCategory.PREFERENCES,
    `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.EMAIL}`,
  ],
  [GlobalSettingOptions.APPEARANCE]: [
    GlobalSettingsMenuCategory.PREFERENCES,
    `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.APPEARANCE}`,
  ],
  [GlobalSettingOptions.LOGIN_CONFIGURATION]: [
    GlobalSettingsMenuCategory.PREFERENCES,
    `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.LOGIN_CONFIGURATION}`,
  ],
  [GlobalSettingOptions.OM_HEALTH]: [
    GlobalSettingsMenuCategory.PREFERENCES,
    `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.OM_HEALTH}`,
  ],
  [GlobalSettingOptions.GLOSSARY_TERM]: [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.GLOSSARY_TERM}`,
  ],
};

export const SETTING_CUSTOM_PROPERTIES_PATH = {
  [GlobalSettingOptions.DATABASES]: [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.DATABASES}`,
  ],
  [GlobalSettingOptions.DATABASE_SCHEMA]: [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.DATABASE_SCHEMA}`,
  ],
  [GlobalSettingOptions.TABLES]: [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.TABLES}`,
  ],
  [GlobalSettingOptions.STORED_PROCEDURES]: [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.STORED_PROCEDURES}`,
  ],
  [GlobalSettingOptions.TOPICS]: [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.TOPICS}`,
  ],
  [GlobalSettingOptions.DASHBOARDS]: [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.DASHBOARDS}`,
  ],
  [GlobalSettingOptions.PIPELINES]: [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.PIPELINES}`,
  ],
  [GlobalSettingOptions.MLMODELS]: [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.MLMODELS}`,
  ],
  [GlobalSettingOptions.CONTAINERS]: [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.CONTAINERS}`,
  ],
  [GlobalSettingOptions.SEARCH_INDEXES]: [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.SEARCH_INDEXES}`,
  ],
  [GlobalSettingOptions.GLOSSARY_TERM]: [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.GLOSSARY_TERM}`,
  ],
};
