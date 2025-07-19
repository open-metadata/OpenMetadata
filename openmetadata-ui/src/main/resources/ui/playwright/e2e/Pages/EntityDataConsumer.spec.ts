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
import { isUndefined } from 'lodash';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';

const user = new UserClass();

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

// Create 2 page and authenticate 1 with admin and another with normal user
const test = base.extend<{
  page: Page;
}>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user.login(page);
    await use(page);
    await page.close();
  },
});

entities.forEach((EntityClass) => {
  const entity = new EntityClass();

  const rowSelector =
    entity.type === 'MlModel' ? 'data-testid' : 'data-row-key';

  test.describe(entity.getType(), () => {
    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await user.create(apiContext);

      await EntityDataClass.preRequisitesForTests(apiContext);
      await entity.create(apiContext);
      await afterAction();
    });

    test.beforeEach('Visit entity details page', async ({ page }) => {
      await redirectToHomePage(page);
      await entity.visitEntityPageWithCustomSearchBox(page);
    });

    // Running following 2 tests serially since they are dependent on each other
    test.describe.serial('Owner permission tests', () => {
      test('User as Owner Add, Update and Remove', async ({ page }) => {
        test.slow(true);

        const OWNER1 = EntityDataClass.user1.getUserName();
        const OWNER2 = EntityDataClass.user2.getUserName();
        const OWNER3 = EntityDataClass.user3.getUserName();
        await entity.owner(page, [OWNER1, OWNER3], [OWNER2], undefined, false);
      });

      test('No edit owner permission', async ({ page }) => {
        await page.reload();
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(page.getByTestId('edit-owner')).not.toBeAttached();
      });
    });

    test('Tier Add, Update and Remove', async ({ page }) => {
      await entity.tier(
        page,
        'Tier1',
        EntityDataClass.tierTag1.data.displayName
      );
    });

    test('Update description', async ({ page }) => {
      await entity.descriptionUpdate(page);
    });

    test('Tag Add, Update and Remove', async ({ page }) => {
      await entity.tag(page, 'PersonalData.Personal', 'PII.None', entity);
    });

    test('Glossary Term Add, Update and Remove', async ({ page }) => {
      await entity.glossaryTerm(
        page,
        EntityDataClass.glossaryTerm1.responseData,
        EntityDataClass.glossaryTerm2.responseData
      );
    });

    // Run only if entity has children
    if (!isUndefined(entity.childrenTabId)) {
      test('Tag Add, Update and Remove for child entities', async ({
        page,
      }) => {
        await page.getByTestId(entity.childrenTabId ?? '').click();

        await entity.tagChildren({
          page,
          tag1: 'PersonalData.Personal',
          tag2: 'PII.None',
          rowId: entity.childrenSelectorId ?? '',
          rowSelector,
          entityEndpoint: entity.endpoint,
        });
      });

      if (['Table', 'Dashboard Data Model'].includes(entity.type)) {
        test('DisplayName edit for child entities should not be allowed', async ({
          page,
        }) => {
          await page.getByTestId(entity.childrenTabId ?? '').click();

          await expect(
            page
              .locator(`[${rowSelector}="${entity.childrenSelectorId ?? ''}"]`)
              .getByTestId('edit-displayName-button')
          ).not.toBeVisible();
        });
      }

      test('Description Add, Update and Remove for child entities', async ({
        page,
      }) => {
        await page.getByTestId(entity.childrenTabId ?? '').click();

        await entity.descriptionUpdateChildren(
          page,
          entity.childrenSelectorId ?? '',
          rowSelector,
          entity.endpoint
        );
      });
    }

    // Run only if entity has children
    if (!isUndefined(entity.childrenTabId)) {
      test('Glossary Term Add, Update and Remove for child entities', async ({
        page,
      }) => {
        await page.getByTestId(entity.childrenTabId ?? '').click();

        await entity.glossaryTermChildren({
          page,
          glossaryTerm1: EntityDataClass.glossaryTerm1.responseData,
          glossaryTerm2: EntityDataClass.glossaryTerm2.responseData,
          rowId: entity.childrenSelectorId ?? '',
          entityEndpoint: entity.endpoint,
          rowSelector:
            entity.type === 'MlModel' ? 'data-testid' : 'data-row-key',
        });
      });
    }

    test(`UpVote & DownVote entity`, async ({ page }) => {
      await entity.upVote(page);
      await entity.downVote(page);
    });

    test(`Follow & Un-follow entity`, async ({ page }) => {
      test.slow(true);

      const entityName = entity.entityResponseData?.['displayName'];
      await entity.followUnfollowEntity(page, entityName);
    });

    test.afterAll('Cleanup', async ({ browser }) => {
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);
      await user.delete(apiContext);
      await entity.delete(apiContext);
      await EntityDataClass.postRequisitesForTests(apiContext);
      await afterAction();
    });
  });
});
