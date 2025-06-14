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
import { PolicyRulesType } from '../support/access-control/PoliciesClass';
import { uuid } from '../utils/common';
import { GlobalSettingOptions } from './settings';

export const DEFAULT_POLICIES = {
  dataConsumerPolicy: 'Data Consumer Policy',
  dataStewardPolicy: 'Data Steward Policy',
  organizationPolicy: 'Organization Policy',
  teamOnlyAccessPolicy: 'Team only access Policy',
};

export const RULE_DETAILS = {
  resources: 'All',
  operations: 'All',
  effect: 'Allow',
  condition: 'isOwner()',
  inValidCondition: 'isOwner(',
};

export const ERROR_MESSAGE_VALIDATION = {
  lastPolicyCannotBeRemoved: 'At least one policy is required in a role',
  lastRuleCannotBeRemoved: 'At least one rule is required in a policy',
};

export const POLICY_NAME = `Policy-test-${uuid()}`;
export const DESCRIPTION = `This is ${POLICY_NAME} description`;

export const RULE_NAME = `Rule / test-${uuid()}`;
export const RULE_DESCRIPTION = `This is ${RULE_NAME} description`;
export const UPDATED_DESCRIPTION = 'This is updated description';
export const UPDATED_POLICY_NAME = `PW Updated ${POLICY_NAME}`;

export const NEW_RULE_NAME = `New / Rule-test-${uuid()}`;
export const NEW_RULE_DESCRIPTION = `This is ${NEW_RULE_NAME} description`;

export const UPDATED_RULE_NAME = `New-Rule-test-${uuid()}-updated`;

export const DATA_STEWARD_RULES: PolicyRulesType[] = [
  {
    name: 'DataStewardRole',
    resources: ['All'],
    operations: [
      'EditDescription',
      'EditDisplayName',
      'EditLineage',
      'EditOwners',
      'EditTags',
      'ViewAll',
    ],
    effect: 'allow',
  },
];

export const DATA_CONSUMER_RULES: PolicyRulesType[] = [
  {
    name: 'DataConsumerPolicy-EditRule',
    resources: ['All'],
    operations: [
      'EditDescription',
      'EditGlossaryTerms',
      'EditTags',
      'EditTier',
      'ViewAll',
    ],
    effect: 'allow',
  },
];

export const VIEW_ALL_RULE: PolicyRulesType[] = [
  {
    name: 'OrganizationPolicy-ViewAll-Rule',
    description: 'Allow all users to view all metadata',
    resources: ['All'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
];

export const VIEW_ALL_WITH_IS_OWNER: PolicyRulesType[] = [
  {
    name: 'viewAll-IsOwner',
    resources: ['All'],
    operations: ['ViewAll'],
    effect: 'allow',
    condition: 'isOwner()',
  },
];

export const VIEW_ALL_WITH_MATCH_TAG_CONDITION: PolicyRulesType[] = [
  {
    name: 'viewAll-MatchTag',
    resources: ['All'],
    operations: ['ViewAll'],
    effect: 'allow',
    condition: "matchAnyTag('PersonalData.Personal')",
  },
];

export const EDIT_USER_FOR_TEAM_RULES: PolicyRulesType[] = [
  {
    name: 'EditUserTeams-EditRule',
    resources: ['team'],
    operations: ['EditUsers'],
    effect: 'allow',
  },
];

export const ORGANIZATION_POLICY_RULES: PolicyRulesType[] = [
  {
    name: 'OrganizationPolicy-NoOwner-Rule',
    description:
      'Allow any one to set the owner of an entity that has no owner set.',
    effect: 'allow',
    operations: ['EditOwners'],
    resources: ['All'],
    condition: 'noOwner()',
  },
  {
    name: 'OrganizationPolicy-Owner-Rule',
    description: 'Allow all the operations on an entity for the owner.',
    effect: 'allow',
    operations: ['All'],
    resources: ['All'],
    condition: 'isOwner()',
  },
];

export const EDIT_TAGS_RULE: PolicyRulesType[] = [
  {
    name: 'EditTags-EditRule',
    description: 'Allow EditTags for all entities.',
    resources: ['All'],
    operations: ['EditTags'],
    effect: 'allow',
  },
];

export const EDIT_DESCRIPTION_RULE: PolicyRulesType[] = [
  {
    name: 'EditDescription-EditRule',
    description: 'Allow EditDescription for all entities.',
    resources: ['All'],
    operations: ['EditDescription'],
    effect: 'allow',
  },
];

export const EDIT_GLOSSARY_TERM_RULE: PolicyRulesType[] = [
  {
    name: 'EditGlossaryTerm-EditRule',
    description: 'Allow EditGlossaryTerm for all entities.',
    resources: ['All'],
    operations: ['EditGlossaryTerms'],
    effect: 'allow',
  },
];

export const GLOBAL_SETTING_PERMISSIONS: Record<
  string,
  { testid: GlobalSettingOptions; isCustomProperty?: boolean }
> = {
  metadata: {
    testid: GlobalSettingOptions.METADATA,
  },
  customAttributesDatabase: {
    testid: GlobalSettingOptions.DATABASES,
    isCustomProperty: true,
  },
  customAttributesDatabaseSchema: {
    testid: GlobalSettingOptions.DATABASE_SCHEMA,
    isCustomProperty: true,
  },
  customAttributesStoredProcedure: {
    testid: GlobalSettingOptions.STORED_PROCEDURES,
    isCustomProperty: true,
  },
  customAttributesTable: {
    testid: GlobalSettingOptions.TABLES,
    isCustomProperty: true,
  },
  customAttributesTopics: {
    testid: GlobalSettingOptions.TOPICS,
    isCustomProperty: true,
  },
  customAttributesDashboards: {
    testid: GlobalSettingOptions.DASHBOARDS,
    isCustomProperty: true,
  },
  customAttributesPipelines: {
    testid: GlobalSettingOptions.PIPELINES,
    isCustomProperty: true,
  },
  customAttributesMlModels: {
    testid: GlobalSettingOptions.MLMODELS,
    isCustomProperty: true,
  },
  customAttributesSearchIndex: {
    testid: GlobalSettingOptions.SEARCH_INDEXES,
    isCustomProperty: true,
  },
  customAttributesGlossaryTerm: {
    testid: GlobalSettingOptions.GLOSSARY_TERM,
    isCustomProperty: true,
  },
  customAttributesAPICollection: {
    testid: GlobalSettingOptions.API_COLLECTIONS,
    isCustomProperty: true,
  },
  customAttributesAPIEndpoint: {
    testid: GlobalSettingOptions.API_ENDPOINTS,
    isCustomProperty: true,
  },
  customAttributesMetric: {
    testid: GlobalSettingOptions.METRICS,
    isCustomProperty: true,
  },
  customAttributesDataProduct: {
    testid: GlobalSettingOptions.DATA_PRODUCTS,
    isCustomProperty: true,
  },
  customAttributesDataModel: {
    testid: GlobalSettingOptions.DASHBOARD_DATA_MODEL,
    isCustomProperty: true,
  },
  customAttributesContainer: {
    testid: GlobalSettingOptions.CONTAINERS,
    isCustomProperty: true,
  },
  bots: {
    testid: GlobalSettingOptions.BOTS,
  },
};
export const SETTING_PAGE_ENTITY_PERMISSION: Record<
  string,
  { testid: GlobalSettingOptions; button: string; api?: string }
> = {
  teams: {
    testid: GlobalSettingOptions.TEAMS,
    button: 'add-team',
  },
  users: {
    testid: GlobalSettingOptions.USERS,
    button: 'add-user',
    api: '/api/v1/users?*',
  },
  admins: {
    testid: GlobalSettingOptions.ADMINS,
    button: 'add-user',
    api: '/api/v1/users?*',
  },
  databases: {
    testid: GlobalSettingOptions.DATABASES,
    button: 'add-service-button',
    api: '/api/v1/services/databaseServices?*',
  },
  messaging: {
    testid: GlobalSettingOptions.MESSAGING,
    button: 'add-service-button',
    api: '/api/v1/services/messagingServices?*',
  },
  dashboard: {
    testid: GlobalSettingOptions.DASHBOARDS,
    button: 'add-service-button',
    api: '/api/v1/services/dashboardServices?*',
  },
  pipelines: {
    testid: GlobalSettingOptions.PIPELINES,
    button: 'add-service-button',
    api: '/api/v1/services/pipelineServices?*',
  },
  mlmodels: {
    testid: GlobalSettingOptions.MLMODELS,
    button: 'add-service-button',
    api: '/api/v1/services/mlmodelServices?*',
  },
  storage: {
    testid: GlobalSettingOptions.STORAGES,
    button: 'add-service-button',
    api: '/api/v1/services/storageServices?*',
  },
};
