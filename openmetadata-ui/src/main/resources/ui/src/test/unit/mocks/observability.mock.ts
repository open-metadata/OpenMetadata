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
import { FilterResourceDescriptor } from '../../../generated/events/filterResourceDescriptor';

const EVENTSUBSCRIPTION_FILTERBYFQN = 'eventSubscription.filterByFqn';
const MATCHANYENTITYFQN_FQNLIST = 'matchAnyEntityFqn(${fqnList})';
const EVENTSUBSCRIPTION_FILTERBYDOMAIN = 'eventSubscription.filterByDomain';
const EVENT_FILTERING_BY_DOMAIN_A_ENTITY_BELONGS =
  'Event Filtering By Domain a Entity Belongs To';
const MATCHANYDOMAIN_DOMAINLIST = 'matchAnyDomain(${domainList})';
const OWNER_NAME = 'Owner Name';
const EVENTSUBSCRIPTION_FILTERBYOWNER = 'eventSubscription.filterByOwner';
const EVENT_FILTERING_BY_OWNER_NAME_OF_ASSET =
  'Event Filtering By Owner Name of Asset';
const MATCHANYOWNERNAME_OWNERNAMELIST = 'matchAnyOwnerName(${ownerNameList})';
const GET_SCHEMA_CHANGES = 'Get Schema Changes';
const GET_UPDATES_FOR_SCHEMA_CHANGES = 'Get Updates for Schema Changes';

export const MOCK_FILTER_RESOURCES = [
  {
    name: 'container',
    supportedFilters: [
      {
        name: 'filterByFqn',
        displayName: 'Container Name',
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYFQN,
        description: 'Event Filtering By Container Name',
        effect: 'include',
        condition: MATCHANYENTITYFQN_FQNLIST,
        arguments: ['fqnList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByDomain',
        displayName: 'Domain',
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYDOMAIN,
        description: EVENT_FILTERING_BY_DOMAIN_A_ENTITY_BELONGS,
        effect: 'include',
        condition: MATCHANYDOMAIN_DOMAINLIST,
        arguments: ['domainList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByOwner',
        displayName: OWNER_NAME,
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYOWNER,
        description: EVENT_FILTERING_BY_OWNER_NAME_OF_ASSET,
        effect: 'include',
        condition: MATCHANYOWNERNAME_OWNERNAMELIST,
        arguments: ['ownerNameList'],
        inputType: 'runtime',
      },
    ],
    supportedActions: [
      {
        name: 'GetContainerSchemaChanges',
        displayName: GET_SCHEMA_CHANGES,
        fullyQualifiedName: 'eventSubscription.GetContainerSchemaChanges',
        description: GET_UPDATES_FOR_SCHEMA_CHANGES,
        effect: 'include',
        condition: "matchAnyFieldChange({'parent','children'})",
        arguments: [],
        inputType: 'none',
      },
    ],
  },
  {
    name: 'pipeline',
    supportedFilters: [
      {
        name: 'filterByFqn',
        displayName: 'Pipeline Name',
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYFQN,
        description: 'Event Filtering By Pipeline Name',
        effect: 'include',
        condition: MATCHANYENTITYFQN_FQNLIST,
        arguments: ['fqnList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByDomain',
        displayName: 'Domain',
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYDOMAIN,
        description: EVENT_FILTERING_BY_DOMAIN_A_ENTITY_BELONGS,
        effect: 'include',
        condition: MATCHANYDOMAIN_DOMAINLIST,
        arguments: ['domainList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByOwner',
        displayName: OWNER_NAME,
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYOWNER,
        description: EVENT_FILTERING_BY_OWNER_NAME_OF_ASSET,
        effect: 'include',
        condition: MATCHANYOWNERNAME_OWNERNAMELIST,
        arguments: ['ownerNameList'],
        inputType: 'runtime',
      },
    ],
    supportedActions: [
      {
        name: 'GetPipelineStatusUpdates',
        displayName: 'Get Pipeline Status Updates',
        fullyQualifiedName: 'eventSubscription.GetPipelineStatusUpdates',
        description: 'Get Updates for Pipeline Status Changes',
        effect: 'include',
        condition: 'matchIngestionPipelineState(${pipelineStateList})',
        arguments: ['pipelineStateList'],
        inputType: 'runtime',
      },
    ],
  },
  {
    name: 'table',
    supportedFilters: [
      {
        name: 'filterByFqn',
        displayName: 'Table Name',
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYFQN,
        description: 'Event Filtering By Table Name',
        effect: 'include',
        condition: MATCHANYENTITYFQN_FQNLIST,
        arguments: ['fqnList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByDomain',
        displayName: 'Domain',
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYDOMAIN,
        description: EVENT_FILTERING_BY_DOMAIN_A_ENTITY_BELONGS,
        effect: 'include',
        condition: MATCHANYDOMAIN_DOMAINLIST,
        arguments: ['domainList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByOwner',
        displayName: OWNER_NAME,
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYOWNER,
        description: EVENT_FILTERING_BY_OWNER_NAME_OF_ASSET,
        effect: 'include',
        condition: MATCHANYOWNERNAME_OWNERNAMELIST,
        arguments: ['ownerNameList'],
        inputType: 'runtime',
      },
    ],
    supportedActions: [
      {
        name: 'GetTableSchemaChanges',
        displayName: GET_SCHEMA_CHANGES,
        fullyQualifiedName: 'eventSubscription.GetTableSchemaChanges',
        description: GET_UPDATES_FOR_SCHEMA_CHANGES,
        effect: 'include',
        condition: "matchAnyFieldChange({'columns','dataModel','joins'})",
        arguments: [],
        inputType: 'none',
      },
      {
        name: 'GetTableMetricsUpdates',
        displayName: 'Get Table Metrics Updates',
        fullyQualifiedName: 'eventSubscription.GetTableMetricsUpdates',
        description: 'Get Updates About Table Metrics',
        effect: 'include',
        condition: "matchAnyFieldChange({'customMetrics', 'profile'})",
        arguments: [],
        inputType: 'none',
      },
    ],
  },
  {
    name: 'testCase',
    supportedFilters: [
      {
        name: 'filterByFqn',
        displayName: 'Test Case Name',
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYFQN,
        description: 'Event By Test Case Name',
        effect: 'include',
        condition: MATCHANYENTITYFQN_FQNLIST,
        arguments: ['fqnList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByDomain',
        displayName: 'Domain',
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYDOMAIN,
        description: EVENT_FILTERING_BY_DOMAIN_A_ENTITY_BELONGS,
        effect: 'include',
        condition: MATCHANYDOMAIN_DOMAINLIST,
        arguments: ['domainList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByOwner',
        displayName: OWNER_NAME,
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYOWNER,
        description: EVENT_FILTERING_BY_OWNER_NAME_OF_ASSET,
        effect: 'include',
        condition: MATCHANYOWNERNAME_OWNERNAMELIST,
        arguments: ['ownerNameList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByTableNameTestCaseBelongsTo',
        displayName: 'Table Name A Test Case Belongs To',
        fullyQualifiedName:
          'eventSubscription.filterByTableNameTestCaseBelongsTo',
        description: 'Event Filtering By Table Name A Test Case Belongs To',
        effect: 'include',
        condition: 'filterByTableNameTestCaseBelongsTo(${tableNameList})',
        arguments: ['tableNameList'],
        inputType: 'runtime',
      },
    ],
    supportedActions: [
      {
        name: 'GetTestCaseSchemaChanges',
        displayName: GET_SCHEMA_CHANGES,
        fullyQualifiedName: 'eventSubscription.filterBySchemaChange',
        description: GET_UPDATES_FOR_SCHEMA_CHANGES,
        effect: 'include',
        condition:
          "matchAnyFieldChange({'testDefinition','parameterValues','description'})",
        arguments: [],
        inputType: 'none',
      },
      {
        name: 'GetTestCaseStatusUpdates',
        displayName: 'Get Test Case Status Updates',
        fullyQualifiedName: 'eventSubscription.GetTestCaseStatusUpdates',
        description: 'Get Status Updates Test Cases',
        effect: 'include',
        condition: 'matchTestResult(${testResultList})',
        arguments: ['testResultList'],
        inputType: 'runtime',
      },
    ],
  },
  {
    name: 'testSuite',
    supportedFilters: [
      {
        name: 'filterByFqn',
        displayName: 'Test Suite Name',
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYFQN,
        description: 'Event Filtering By Test Suite Name',
        effect: 'include',
        condition: MATCHANYENTITYFQN_FQNLIST,
        arguments: ['fqnList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByOwner',
        displayName: OWNER_NAME,
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYOWNER,
        description: EVENT_FILTERING_BY_OWNER_NAME_OF_ASSET,
        effect: 'include',
        condition: MATCHANYOWNERNAME_OWNERNAMELIST,
        arguments: ['ownerNameList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByDomain',
        displayName: 'Domain',
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYDOMAIN,
        description: EVENT_FILTERING_BY_DOMAIN_A_ENTITY_BELONGS,
        effect: 'include',
        condition: MATCHANYDOMAIN_DOMAINLIST,
        arguments: ['domainList'],
        inputType: 'runtime',
      },
    ],
    supportedActions: [
      {
        name: 'GetTestSuiteSchemaChanges',
        displayName: GET_SCHEMA_CHANGES,
        fullyQualifiedName: 'eventSubscription.filterBySchemaChange',
        description: GET_UPDATES_FOR_SCHEMA_CHANGES,
        effect: 'include',
        condition:
          "matchAnyFieldChange({'connection','pipelines','description'})",
        arguments: [],
        inputType: 'none',
      },
      {
        name: 'GetTestCaseStatusUpdatesUnderSuite',
        displayName: 'Get Test Case Status Updates belonging to a Test Suite',
        fullyQualifiedName:
          'eventSubscription.GetTestCaseStatusUpdatesUnderSuite',
        description: 'Get Status Updates Test Cases belonging to a Test Suite',
        effect: 'include',
        condition:
          'getTestCaseStatusIfInTestSuite(${testSuiteList}, ${testStatusList})',
        arguments: ['testSuiteList', 'testStatusList'],
        inputType: 'runtime',
      },
    ],
  },
  {
    name: 'topic',
    supportedFilters: [
      {
        name: 'filterByFqn',
        displayName: 'Topic Name',
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYFQN,
        description: 'Event Filtering By Topic Name',
        effect: 'include',
        condition: MATCHANYENTITYFQN_FQNLIST,
        arguments: ['fqnList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByDomain',
        displayName: 'Domain',
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYDOMAIN,
        description: EVENT_FILTERING_BY_DOMAIN_A_ENTITY_BELONGS,
        effect: 'include',
        condition: MATCHANYDOMAIN_DOMAINLIST,
        arguments: ['domainList'],
        inputType: 'runtime',
      },
      {
        name: 'filterByOwner',
        displayName: OWNER_NAME,
        fullyQualifiedName: EVENTSUBSCRIPTION_FILTERBYOWNER,
        description: EVENT_FILTERING_BY_OWNER_NAME_OF_ASSET,
        effect: 'include',
        condition: MATCHANYOWNERNAME_OWNERNAMELIST,
        arguments: ['ownerNameList'],
        inputType: 'runtime',
      },
    ],
    supportedActions: [
      {
        name: 'GetTopicSchemaChanges',
        displayName: GET_SCHEMA_CHANGES,
        fullyQualifiedName: 'eventSubscription.GetTopicSchemaChanges',
        description: GET_UPDATES_FOR_SCHEMA_CHANGES,
        effect: 'include',
        condition: "matchAnyFieldChange({'messageSchema'})",
        arguments: [],
        inputType: 'none',
      },
    ],
  },
] as FilterResourceDescriptor[];
