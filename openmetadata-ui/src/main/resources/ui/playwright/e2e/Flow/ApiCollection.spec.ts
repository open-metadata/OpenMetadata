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
import { test } from '@playwright/test';
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  addMultiOwner,
  addOwner,
  removeOwner,
  updateOwner,
} from '../../utils/entity';

const entity = new ApiCollectionClass();

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('API Collection Entity Special Test Cases', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await EntityDataClass.preRequisitesForTests(apiContext);
    await entity.create(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
    await entity.visitEntityPage(page);
  });

  test("Verify Owner Propagation: owner should be propagated to the API Collection's API Endpoint", async ({
    page,
  }) => {
    test.slow(true);

    await test.step(
      "Verify user Owner Propagation: owner should be propagated to the API Collection's API Endpoint",
      async () => {
        const OWNER1 = EntityDataClass.user1.getUserName();
        const OWNER2 = EntityDataClass.user2.getUserName();
        await addMultiOwner({
          page,
          ownerNames: [OWNER1, OWNER2],
          activatorBtnDataTestId: 'edit-owner',
          resultTestId: 'data-assets-header',
          endpoint: entity.endpoint,
          type: 'Users',
        });

        // Verify Owner Propagation
        await entity.verifyOwnerPropagation(page, OWNER2);

        await removeOwner({
          page,
          endpoint: entity.endpoint,
          ownerName: OWNER2,
          type: 'Users',
          dataTestId: 'data-assets-header',
        });
      }
    );

    await test.step(
      "Verify team Owner Propagation: owner should be propagated to the API Collection's API Endpoint",
      async () => {
        test.slow(true);

        const OWNER1 = EntityDataClass.team1.data.displayName;
        const OWNER2 = EntityDataClass.team2.data.displayName;

        await addOwner({
          page,
          owner: OWNER1,
          type: 'Teams',
          endpoint: entity.endpoint,
          dataTestId: 'data-assets-header',
        });
        // Verify Owner Propagation
        await entity.verifyOwnerPropagation(page, OWNER1);

        // Update the owner
        await updateOwner({
          page,
          owner: OWNER2,
          type: 'Teams',
          endpoint: entity.endpoint,
          dataTestId: 'data-assets-header',
        });

        // Verify updated Owner Propagation
        await entity.verifyOwnerPropagation(page, OWNER2);

        await removeOwner({
          page,
          endpoint: entity.endpoint,
          ownerName: OWNER2,
          type: 'Teams',
          dataTestId: 'data-assets-header',
        });
      }
    );
  });
});
