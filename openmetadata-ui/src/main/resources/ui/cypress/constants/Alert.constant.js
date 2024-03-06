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

// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />

import { uuid } from '../common/common';
import {
  DATABASE_SERVICE,
  DOMAIN_CREATION_DETAILS,
  USER_DETAILS,
} from './EntityConstant';

export const ALERT_NAME = `0%alert-cy-${uuid()}`;
export const ALERT_DESCRIPTION = 'This is alert description';
export const ALERT_UPDATED_DESCRIPTION = 'New alert description';
export const TEST_CASE_NAME = `0%test-case-${uuid()}`;
export const TABLE_FQN = `${DATABASE_SERVICE.entity.databaseSchema}.${DATABASE_SERVICE.entity.name}`;
export const TEST_SUITE_FQN = `${TABLE_FQN}.testSuite`;

export const INGESTION_PIPELINE_NAME = `0-cy-ingestion-pipeline-${uuid()}`;

export const OBSERVABILITY_CREATION_DETAILS = {
  table: {
    sourceDisplayName: 'Table',
    filters: [
      {
        name: 'Table Name',
        inputSelector: 'fqn-list-select',
        inputValue: DATABASE_SERVICE.entity.name,
        exclude: true,
      },
      {
        name: 'Domain',
        inputSelector: 'domain-select',
        inputValue: DOMAIN_CREATION_DETAILS.name,
        exclude: false,
      },
      {
        name: 'Owner Name',
        inputSelector: 'owner-name-select',
        inputValue: `${USER_DETAILS.firstName}${USER_DETAILS.lastName}`,
        exclude: true,
      },
    ],
    actions: [
      {
        name: 'Get Schema Changes',
        exclude: false,
      },
      {
        name: 'Get Table Metrics Updates',
        exclude: false,
      },
    ],
    destinations: [
      {
        mode: 'internal',
        category: 'Owners',
        type: 'Email',
      },
      {
        mode: 'external',
        category: 'Email',
        inputValue: 'test@example.com',
      },
    ],
  },
  ingestionPipeline: {
    sourceDisplayName: 'Ingestion Pipeline',
    filters: [
      {
        name: 'Ingestion Pipeline Name',
        inputSelector: 'fqn-list-select',
        inputValue: INGESTION_PIPELINE_NAME,
        exclude: false,
      },
      {
        name: 'Domain',
        inputSelector: 'domain-select',
        inputValue: DOMAIN_CREATION_DETAILS.name,
        exclude: false,
      },
      {
        name: 'Owner Name',
        inputSelector: 'owner-name-select',
        inputValue: `${USER_DETAILS.firstName}${USER_DETAILS.lastName}`,
        exclude: true,
      },
    ],
    actions: [
      {
        name: 'Get Ingestion Pipeline Status Updates',
        inputs: [
          {
            inputSelector: 'pipeline-status-select',
            inputValue: 'Queued',
          },
        ],
        exclude: false,
      },
    ],
    destinations: [
      {
        mode: 'internal',
        category: 'Owners',
        type: 'Email',
      },
      {
        mode: 'external',
        category: 'Email',
        inputValue: 'test@example.com',
      },
    ],
  },
  testCase: {
    sourceDisplayName: 'Test Case',
    filters: [
      {
        name: 'Test Case Name',
        inputSelector: 'fqn-list-select',
        inputValue: TEST_CASE_NAME,
        exclude: true,
      },
      {
        name: 'Domain',
        inputSelector: 'domain-select',
        inputValue: DOMAIN_CREATION_DETAILS.name,
        exclude: false,
      },
      {
        name: 'Owner Name',
        inputSelector: 'owner-name-select',
        inputValue: `${USER_DETAILS.firstName}${USER_DETAILS.lastName}`,
        exclude: true,
      },
      {
        name: 'Table Name A Test Case Belongs To',
        inputSelector: 'table-name-select',
        inputValue: DATABASE_SERVICE.entity.name,
        exclude: false,
      },
    ],
    actions: [
      {
        name: 'Get Schema Changes',
        exclude: true,
      },
      {
        name: 'Get Test Case Status Updates',
        inputs: [
          {
            inputSelector: 'test-result-select',
            inputValue: 'Failed',
          },
        ],
        exclude: false,
      },
    ],
    destinations: [
      {
        mode: 'internal',
        category: 'Users',
        inputSelector: 'User-select',
        inputValue: `${USER_DETAILS.firstName}${USER_DETAILS.lastName}`,
        type: 'Email',
      },
      {
        mode: 'external',
        category: 'G Chat',
        inputValue: 'https://gchat.com',
      },
      {
        mode: 'external',
        category: 'Generic',
        inputValue: 'https://generic.com',
      },
    ],
  },
  testSuite: {
    sourceDisplayName: 'Test Suite',
    filters: [
      {
        name: 'Test Suite Name',
        inputSelector: 'fqn-list-select',
        inputValue: TEST_SUITE_FQN,
        exclude: true,
      },
      {
        name: 'Domain',
        inputSelector: 'domain-select',
        inputValue: DOMAIN_CREATION_DETAILS.name,
        exclude: false,
      },
      {
        name: 'Owner Name',
        inputSelector: 'owner-name-select',
        inputValue: `${USER_DETAILS.firstName}${USER_DETAILS.lastName}`,
        exclude: false,
      },
    ],
    actions: [
      {
        name: 'Get Schema Changes',
        exclude: true,
      },
      {
        name: 'Get Test Case Status Updates belonging to a Test Suite',
        inputs: [
          {
            inputSelector: 'test-suite-select',
            inputValue: TEST_SUITE_FQN,
            waitForAPI: true,
          },
          {
            inputSelector: 'test-status-select',
            inputValue: 'Failed',
          },
        ],
        exclude: false,
      },
    ],
    destinations: [
      {
        mode: 'external',
        category: 'Ms Teams',
        inputValue: 'https://msteams.com',
      },
      {
        mode: 'external',
        category: 'Slack',
        inputValue: 'https://slack.com',
      },
    ],
  },
};
