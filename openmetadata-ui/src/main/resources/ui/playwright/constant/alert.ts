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

import { uuid } from '../utils/common';

export const ALERT_DESCRIPTION = 'This is alert description';
export const ALERT_UPDATED_DESCRIPTION = 'New alert description';
export const TEST_SUITE_NAME = `0-pw-test-suite-${uuid()}`;
export const TEST_CASE_NAME = `0-pw-test-case-${uuid()}`;

export const INGESTION_PIPELINE_NAME = `0-playwright-ingestion-pipeline-${uuid()}`;

export const ALERT_WITH_PERMISSION_POLICY_NAME = `alert-policy-${uuid()}`;
export const ALERT_WITH_PERMISSION_ROLE_NAME = `alert-role-${uuid()}`;
export const ALERT_WITHOUT_PERMISSION_POLICY_NAME = `alert-policy-${uuid()}`;
export const ALERT_WITHOUT_PERMISSION_ROLE_NAME = `alert-role-${uuid()}`;

export const ALERT_WITH_PERMISSION_POLICY_DETAILS = {
  name: ALERT_WITH_PERMISSION_POLICY_NAME,
  description: 'Alert Policy Description',
  rules: [
    {
      name: 'Alert Rule',
      description: 'Alert Rule Description',
      resources: ['eventsubscription'],
      operations: ['Create', 'EditAll', 'ViewAll', 'Delete'],
      effect: 'allow',
    },
  ],
};

export const ALERT_WITHOUT_PERMISSION_POLICY_DETAILS = {
  name: ALERT_WITHOUT_PERMISSION_POLICY_NAME,
  description: 'Alert Policy Description',
  rules: [
    {
      name: 'Deny Rules',
      description: 'Alert Rule Description',
      resources: ['eventsubscription'],
      operations: [
        'Create',
        'EditAll',
        'Delete',
        'EditOwners',
        'EditDescription',
      ],
      effect: 'deny',
    },
    {
      name: 'Allow Rules',
      description: 'Alert Rule Description',
      resources: ['eventsubscription'],
      operations: ['ViewAll'],
      effect: 'allow',
    },
  ],
};

export const ALERT_WITH_PERMISSION_ROLE_DETAILS = {
  name: ALERT_WITH_PERMISSION_ROLE_NAME,
  description: 'Alert Role Description',
  policies: [ALERT_WITH_PERMISSION_POLICY_NAME],
};

export const ALERT_WITHOUT_PERMISSION_ROLE_DETAILS = {
  name: ALERT_WITHOUT_PERMISSION_ROLE_NAME,
  description: 'Alert Role Description',
  policies: [ALERT_WITHOUT_PERMISSION_POLICY_NAME],
};
