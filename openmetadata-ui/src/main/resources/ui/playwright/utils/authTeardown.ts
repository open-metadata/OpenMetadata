/*
 *  Copyright 2025 Collate.
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
import { APIRequestContext, Page } from '@playwright/test';
import {
  ORGANIZATION_POLICY_RULES,
  VIEW_ALL_RULE,
} from '../constant/permission';
import { AdminClass } from '../support/user/AdminClass';
import { enableDisableAutoPilotApplication } from './applications';
import { getApiContext } from './common';

export const restoreOrganizationDefaultRole = async (
  apiContext: APIRequestContext
) => {
  const organizationTeamResponse = await apiContext
    .get(`/api/v1/teams/name/Organization`)
    .then((res) => res.json());

  const dataConsumerRoleResponse = await apiContext
    .get('/api/v1/roles/name/DataConsumer')
    .then((res) => res.json());

  await apiContext.patch(`/api/v1/teams/${organizationTeamResponse.id}`, {
    data: [
      {
        op: 'replace',
        path: '/defaultRoles',
        value: [
          {
            id: dataConsumerRoleResponse.id,
            type: 'role',
          },
        ],
      },
    ],
    headers: {
      'Content-Type': 'application/json-patch+json',
    },
  });
};

export const updateDefaultOrganizationPolicy = async (
  apiContext: APIRequestContext
) => {
  const orgPolicyResponse = await apiContext
    .get('/api/v1/policies/name/OrganizationPolicy')
    .then((response) => response.json());

  await apiContext.patch(`/api/v1/policies/${orgPolicyResponse.id}`, {
    data: [
      {
        op: 'replace',
        path: '/rules',
        value: [...ORGANIZATION_POLICY_RULES, ...VIEW_ALL_RULE],
      },
    ],
    headers: {
      'Content-Type': 'application/json-patch+json',
    },
  });
};

const restoreRolesAndPolicies = async (page: Page) => {
  const { apiContext, afterAction } = await getApiContext(page);
  // Remove organization policy and role
  await restoreOrganizationDefaultRole(apiContext);
  // update default Organization policy
  await updateDefaultOrganizationPolicy(apiContext);
  // enable the AutoPilot application
  await enableDisableAutoPilotApplication(apiContext);

  await afterAction();
};

export const resetPolicyChanges = async (page: Page, admin: AdminClass) => {
  await admin.login(page);
  await page.waitForURL('**/my-data');
  await restoreRolesAndPolicies(page);
  await admin.logout(page);
  await page.waitForURL('**/signin');
};
