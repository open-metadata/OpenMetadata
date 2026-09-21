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

import { APIRequestContext, expect, Page } from '@playwright/test';
import { enableAiAppMode } from '../e2e/Utils/appMode';
import { redirectToHomePage } from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { getElementWithPagination } from './roles';

/**
 * Polls a GET endpoint until it returns 2xx, used to wait for server-side
 * entity creation to propagate before the browser navigates to it.
 */
export const waitUntilAccessible = async (
  apiContext: APIRequestContext,
  path: string,
  timeout = 10_000
): Promise<void> => {
  await expect
    .poll(async () => (await apiContext.get(path)).ok(), {
      intervals: [200, 500, 1_000, 2_000],
      timeout,
      message: `API path "${path}" not accessible after ${timeout}ms`,
    })
    .toBe(true);
};

/**
 * Enable AI app mode, navigate home, then open the personal-space modal and
 * navigate to the Access Control section.
 *
 * NOTE: This function calls redirectToHomePage internally, which populates
 * IndexedDB with the auth token. Call getApiContext AFTER this function, or
 * call redirectToHomePage first before getApiContext when pre-creating API data.
 */
export const openAccessControlSettings = async (page: Page): Promise<void> => {
  await enableAiAppMode(page);
  await redirectToHomePage(page);
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await page.getByTestId('ai-profile-page').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('profile-nav-access-control').click();
  await page
    .getByTestId('access-control-landing')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

export const navigateToRolesPanel = async (page: Page): Promise<void> => {
  await page.getByTestId('access-control-card-roles').click();
  await page.getByTestId('roles-list-container').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

export const navigateToPoliciesPanel = async (page: Page): Promise<void> => {
  await page.getByTestId('access-control-card-policies').click();
  await page
    .getByTestId('policies-list-container')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

/**
 * Use getElementWithPagination scoped to the roles container to avoid strict-mode
 * violations from other paginated components on the page.
 */
export const navigateToRoleDetail = async (
  page: Page,
  roleName: string
): Promise<void> => {
  const container = page.getByTestId('roles-list-container');
  const roleRow = container.getByTestId(`role-${roleName}`);
  await getElementWithPagination(page, roleRow, false, 50, container);
  await roleRow.getByTestId('role-name').click();
  await page.getByTestId('role-detail-container').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

/**
 * Use getElementWithPagination scoped to the policies container to avoid strict-mode
 * violations from other paginated components on the page.
 */
export const navigateToPolicyDetail = async (
  page: Page,
  policyName: string
): Promise<void> => {
  const container = page.getByTestId('policies-list-container');
  const policyRow = container.getByTestId(`policy-${policyName}`);
  await getElementWithPagination(page, policyRow, false, 50, container);
  await policyRow.getByTestId('policy-name').click();
  await page
    .getByTestId('policy-detail-container')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

export const clickDetailTab = async (
  page: Page,
  tabText: string
): Promise<void> => {
  await page.getByRole('tab', { name: new RegExp(tabText, 'i') }).click();
  await waitForAllLoadersToDisappear(page);
};
