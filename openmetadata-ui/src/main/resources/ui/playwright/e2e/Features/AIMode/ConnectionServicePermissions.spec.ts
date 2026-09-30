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

/**
 * The AI-mode service details page (`/connections/<category>/<fqn>`) must gate what classic
 * service details gates: the Connection tab, which shows the connection config, only for users
 * who may edit the service; and no domain / owner / tier edits on a soft-deleted service.
 */

import { expect, Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { DatabaseServiceClass } from '../../../support/entity/service/DatabaseServiceClass';
import { performAdminLogin } from '../../../utils/admin';
import { okJson } from '../../../utils/apiResponse';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { test } from '../../fixtures/pages';
import { enableAiAppMode } from '../../Utils/appMode';

const HEADER_EDIT_BUTTONS = [
  'edit-domain-button',
  'edit-owner-button',
  'edit-tier-button',
];

const openServiceDetails = async (page: Page, fqn: string, tab = '') => {
  await enableAiAppMode(page);
  await page.goto(
    `/connections/databaseServices/${encodeURIComponent(fqn)}${tab}`,
    { waitUntil: 'domcontentloaded' }
  );
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('entity-header-display-name')).toBeVisible();
};

test.describe(
  'AI mode service details — permissions',
  { tag: [DOMAIN_TAGS.INTEGRATION] },
  () => {
    let service: DatabaseServiceClass;
    let deletedService: DatabaseServiceClass;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      service = new DatabaseServiceClass();
      deletedService = new DatabaseServiceClass();
      await Promise.all([
        service.create(apiContext),
        deletedService.create(apiContext),
      ]);
      await okJson(
        await apiContext.delete(
          `/api/v1/services/databaseServices/${deletedService.entityResponseData.id}?recursive=true&hardDelete=false`
        ),
        'Soft-delete database service'
      );
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await Promise.all([
        service.delete(apiContext),
        deletedService.delete(apiContext),
      ]);
      await afterAction();
    });

    test('a read-only user gets no Connection tab, even from a deep link', async ({
      page,
      dataConsumerPage,
    }) => {
      const fqn = service.entityResponseData.fullyQualifiedName;

      await test.step('an admin has the tab', async () => {
        await openServiceDetails(page, fqn);

        await expect(
          page.getByRole('tab', { name: 'Connection', exact: true })
        ).toBeVisible();
      });

      await test.step('a data consumer does not', async () => {
        await openServiceDetails(dataConsumerPage, fqn);

        await expect(
          dataConsumerPage.getByRole('tab', { name: 'Databases' })
        ).toBeVisible();
        await expect(
          dataConsumerPage.getByRole('tab', { name: 'Connection', exact: true })
        ).toBeHidden();
      });

      await test.step('nor through the tab URL', async () => {
        await openServiceDetails(dataConsumerPage, fqn, '/connection');

        await expect(
          dataConsumerPage.getByRole('tab', { name: 'Databases' })
        ).toHaveAttribute('aria-selected', 'true');
        await expect(
          dataConsumerPage.getByTestId('edit-connection-button')
        ).toBeHidden();
      });
    });

    test('a soft-deleted service offers no domain, owner or tier edits', async ({
      page,
    }) => {
      await test.step('a live service offers them', async () => {
        await openServiceDetails(
          page,
          service.entityResponseData.fullyQualifiedName
        );

        for (const testId of HEADER_EDIT_BUTTONS) {
          await expect(page.getByTestId(testId)).toBeVisible();
        }
      });

      await test.step('a deleted one does not', async () => {
        await openServiceDetails(
          page,
          deletedService.entityResponseData.fullyQualifiedName
        );

        await expect(page.getByTestId('deleted-badge')).toBeVisible();
        for (const testId of HEADER_EDIT_BUTTONS) {
          await expect(page.getByTestId(testId)).toBeHidden();
        }
      });
    });
  }
);
