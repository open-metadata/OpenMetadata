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
import { expect, Page, test as base } from '@playwright/test';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, uuid } from '../../utils/common';

const policy = new PolicyClass();
const role = new RolesClass();
const user = new UserClass();
const table = new TableClass();

const entities = [
  ApiEndpointClass,
  TableClass,
  StoredProcedureClass,
  DashboardClass,
  PipelineClass,
  TopicClass,
  MlModelClass,
  ContainerClass,
  SearchIndexClass,
  DashboardDataModelClass,
  MetricClass,
] as const;

const test = base.extend<{
  userWithPermissionPage: Page;
  userWithoutPermissionPage: Page;
}>({
  userWithPermissionPage: async ({ browser }, use) => {
    const { page } = await performAdminLogin(browser);
    await use(page);
    await page.close();
  },
  userWithoutPermissionPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user.login(page);
    await use(page);
    await page.close();
  },
});

const searchForEntityShouldWork = async (
  fqn: string,
  displayName: string,
  page: Page
) => {
  // Wait for welcome screen and close it if visible
  const isWelcomeScreenVisible = await page
    .waitForSelector('[data-testid="welcome-screen-img"]', {
      state: 'visible',
      timeout: 5000,
    })
    .catch(() => false);

  if (isWelcomeScreenVisible) {
    await page.getByTestId('welcome-screen-close-btn').click();
  }
  await page.getByTestId('customise-searchbox').click();
  await page.getByTestId('customise-searchbox').fill(fqn);
  await page.getByTestId('customise-searchbox').press('Enter');

  await expect(page.getByTestId('entity-header-display-name')).toContainText(
    displayName
  );

  await page
    .getByTestId('navbar-search-container')
    .getByTestId('cancel-icon')
    .click();
  await page.waitForLoadState('networkidle');
};

const searchForEntityShouldWorkShowNoResult = async (
  fqn: string,
  displayName: string,
  page: Page
) => {
  // Wait for welcome screen and close it if visible
  const isWelcomeScreenVisible = await page
    .waitForSelector('[data-testid="welcome-screen-img"]', {
      state: 'visible',
      timeout: 5000,
    })
    .catch(() => false);

  if (isWelcomeScreenVisible) {
    await page.getByTestId('welcome-screen-close-btn').click();
  }
  await page.getByTestId('customise-searchbox').click();
  await page.getByTestId('customise-searchbox').fill(fqn);
  await page.getByTestId('customise-searchbox').press('Enter');

  await page.waitForResponse(`api/v1/search/query?**`);

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('loader', { state: 'hidden' });

  await expect(page.getByTestId('entity-header-display-name')).not.toHaveText(
    displayName
  );

  await expect(
    page.getByText(`No result found.
Try adjusting your search or filter to find what you are looking for.`)
  ).toBeVisible();

  await page
    .getByTestId('navbar-search-container')
    .getByTestId('cancel-icon')
    .click();

  await page.waitForLoadState('networkidle');
};

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await user.create(apiContext);
  const policyResponse = await policy.create(apiContext, [
    {
      name: `pw-permission-rule-${uuid()}`,
      resources: ['All'],
      operations: ['All'],
      effect: 'deny',
    },
  ]);

  const roleResponse = await role.create(apiContext, [
    policyResponse.fullyQualifiedName,
  ]);
  await user.patch({
    apiContext,
    patchData: [
      {
        op: 'replace',
        path: '/roles',
        value: [
          {
            id: roleResponse.id,
            type: 'role',
            name: roleResponse.name,
          },
        ],
      },
    ],
  });
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await user.delete(apiContext);
  await role.delete(apiContext);
  await policy.delete(apiContext);
  await table.delete(apiContext);
  await afterAction();
});

for (const Entity of entities) {
  const entityObj = new Entity();

  test(`Search RBAC for ${entityObj.getType()}`, async ({
    userWithPermissionPage,
    userWithoutPermissionPage,
  }) => {
    const { apiContext } = await getApiContext(userWithPermissionPage);
    try {
      await entityObj.create(apiContext);

      // verify service search
      await searchForEntityShouldWork(
        entityObj.entityResponseData?.fullyQualifiedName,
        entityObj.entityResponseData?.displayName,
        userWithPermissionPage
      );
      await searchForEntityShouldWorkShowNoResult(
        entityObj.entityResponseData?.fullyQualifiedName,
        entityObj.entityResponseData?.displayName,
        userWithoutPermissionPage
      );
    } catch (_e) {
      // remove entity
    } finally {
      await entityObj.delete(apiContext);
    }
  });
}
