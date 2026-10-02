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
 * The AI-mode service details page (`/connections/<category>/<fqn>`) must match classic service
 * details (#34260).
 *
 * Its data-assets table lists each asset's owners and tags, pages that move the rows, the Deleted
 * switch, a soft-deleted service's children, the list after a restore and after a search is
 * cleared, only the top level of nesting assets, and drive directories.
 *
 * It gates what classic gates: the Connection tab, which shows the connection config, only for
 * users who may edit the service; and no domain / owner / tier edits on a soft-deleted service.
 *
 * Every service here is the spec's own: the lists, pages and switches under test are scoped to
 * it, so no other worker's entities can shift a row.
 */

import { expect } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { DatabaseServiceClass } from '../../../support/entity/service/DatabaseServiceClass';
import { DriveServiceClass } from '../../../support/entity/service/DriveServiceClass';
import { StorageServiceClass } from '../../../support/entity/service/StorageServiceClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { okJson, settleAll } from '../../../utils/apiResponse';
import { uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForSearchIndexed } from '../../../utils/polling';
import { getRowByName } from '../../../utils/scopedLocators';
import {
  visitAiModeServiceDetailsPage,
  waitForServiceChildList,
} from '../../../utils/service';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { test } from '../../fixtures/pages';
import { enableAiAppMode } from '../../Utils/appMode';

type EntityRef = { id: string; fullyQualifiedName: string };

const PERSONAL_TAG = {
  tagFQN: 'PersonalData.Personal',
  source: 'Classification',
  labelType: 'Manual',
  state: 'Confirmed',
};

test.describe(
  'AI mode service details',
  { tag: [DOMAIN_TAGS.INTEGRATION] },
  () => {
    test.describe('database service', () => {
      let service: DatabaseServiceClass;
      let owner: UserClass;
      let serviceFqn = '';
      // Three live databases, so a two-row page has a second page, and one soft-deleted one.
      let databases: string[] = [];
      let deletedDatabase = '';

      test.beforeAll(async ({ browser }) => {
        test.setTimeout(120_000);
        const { apiContext, afterAction } = await performAdminLogin(browser);
        service = new DatabaseServiceClass();
        owner = new UserClass();
        await settleAll([service.create(apiContext), owner.create(apiContext)]);
        serviceFqn = service.entityResponseData.fullyQualifiedName;

        const prefix = `pw-ai-db-${uuid()}`;
        databases = [`${prefix}-1`, `${prefix}-2`, `${prefix}-3`];
        deletedDatabase = `${prefix}-4`;

        const [, searched, , toDelete] = await Promise.all(
          [...databases, deletedDatabase].map(async (name, index) =>
            okJson<EntityRef>(
              await apiContext.post('/api/v1/databases', {
                data: {
                  name,
                  service: serviceFqn,
                  ...(index === 0 && {
                    owners: [{ id: owner.responseData.id, type: 'user' }],
                    tags: [PERSONAL_TAG],
                  }),
                },
              }),
              `Create database ${name}`
            )
          )
        );

        await okJson(
          await apiContext.delete(
            `/api/v1/databases/${toDelete.id}?recursive=true&hardDelete=false`
          ),
          'Soft-delete database'
        );

        // The search step reads the database index; the REST list the rest of the spec reads does not.
        await waitForSearchIndexed(
          apiContext,
          searched.fullyQualifiedName,
          'database_search_index'
        );

        await afterAction();
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await settleAll([service.delete(apiContext), owner.delete(apiContext)]);
        await afterAction();
      });

      test.beforeEach(async ({ page }) => {
        await enableAiAppMode(page);
      });

      test('shows the owners and tags of each database', async ({ page }) => {
        await visitAiModeServiceDetailsPage(page, {
          category: 'databaseServices',
          fqn: serviceFqn,
        });

        const ownedRow = getRowByName(page, databases[0]);

        await expect(ownedRow).toContainText(owner.getUserDisplayName());
        await expect(ownedRow).toContainText('Personal');
      });

      test('pages through the databases and keeps the page across a reload', async ({
        page,
      }) => {
        await test.step('first page holds the first two databases', async () => {
          await visitAiModeServiceDetailsPage(page, {
            category: 'databaseServices',
            fqn: serviceFqn,
            query: '?pageSize=2',
          });

          await expect(getRowByName(page, databases[0])).toBeVisible();
          await expect(getRowByName(page, databases[1])).toBeVisible();
          await expect(getRowByName(page, databases[2])).toBeHidden();
        });

        await test.step('Next shows the next databases, not the same ones', async () => {
          const nextPage = waitForServiceChildList(
            page,
            'databaseServices',
            serviceFqn,
            (params) => params.has('after')
          );
          await page.getByTestId('next').click();
          await nextPage;

          await expect(getRowByName(page, databases[2])).toBeVisible();
          await expect(getRowByName(page, databases[0])).toBeHidden();
        });

        await test.step('a reload stays on the page the URL points at', async () => {
          const samePage = waitForServiceChildList(
            page,
            'databaseServices',
            serviceFqn,
            (params) => params.has('after')
          );
          await page.reload({ waitUntil: 'domcontentloaded' });
          await samePage;
          await waitForAllLoadersToDisappear(page);

          await expect(getRowByName(page, databases[2])).toBeVisible();
          await expect(getRowByName(page, databases[0])).toBeHidden();
        });
      });

      test('lists soft-deleted databases when the Deleted switch is on', async ({
        page,
      }) => {
        await visitAiModeServiceDetailsPage(page, {
          category: 'databaseServices',
          fqn: serviceFqn,
        });

        await expect(getRowByName(page, databases[0])).toBeVisible();
        await expect(getRowByName(page, deletedDatabase)).toBeHidden();

        const deletedSwitch = page.getByTestId('show-deleted');
        await expect(deletedSwitch.getByRole('switch')).not.toBeChecked();

        const deletedList = waitForServiceChildList(
          page,
          'databaseServices',
          serviceFqn,
          (params) => params.get('include') === 'deleted'
        );
        await deletedSwitch.click();
        await deletedList;

        await expect(deletedSwitch.getByRole('switch')).toBeChecked();
        await expect(getRowByName(page, deletedDatabase)).toBeVisible();
        await expect(getRowByName(page, databases[0])).toBeHidden();
      });

      test('clearing the search brings every database back', async ({
        page,
      }) => {
        await visitAiModeServiceDetailsPage(page, {
          category: 'databaseServices',
          fqn: serviceFqn,
        });

        const searchBar = page.getByTestId('searchbar');

        await test.step('search narrows the list', async () => {
          const searchResults = waitForResponseWithStatus(
            page,
            (response) =>
              response.request().method() === 'GET' &&
              response.url().includes('/api/v1/search/query') &&
              decodeURIComponent(response.url()).includes(databases[1]),
            200
          );
          await searchBar.fill(databases[1]);
          await searchResults;

          await expect(getRowByName(page, databases[1])).toBeVisible();
          await expect(getRowByName(page, databases[0])).toBeHidden();
        });

        await test.step('clearing it lists every database again', async () => {
          const fullList = waitForServiceChildList(
            page,
            'databaseServices',
            serviceFqn
          );
          await searchBar.fill('');
          await fullList;

          await expect(getRowByName(page, databases[0])).toBeVisible();
          await expect(getRowByName(page, databases[1])).toBeVisible();
        });
      });
    });

    test.describe('soft-deleted database service', () => {
      let service: DatabaseServiceClass;
      let serviceFqn = '';
      let database = '';

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        service = new DatabaseServiceClass();
        await service.create(apiContext);
        serviceFqn = service.entityResponseData.fullyQualifiedName;
        database = `pw-ai-db-${uuid()}`;

        await okJson(
          await apiContext.post('/api/v1/databases', {
            data: { name: database, service: serviceFqn },
          }),
          'Create database'
        );
        // Recursive, so the database is soft-deleted with its service.
        await okJson(
          await apiContext.delete(
            `/api/v1/services/databaseServices/${service.entityResponseData.id}?recursive=true&hardDelete=false`
          ),
          'Soft-delete database service'
        );

        await afterAction();
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await service.delete(apiContext);
        await afterAction();
      });

      test('lists its deleted databases, and the live list once it is restored', async ({
        page,
      }) => {
        await enableAiAppMode(page);

        await test.step('a deleted service lists its deleted databases', async () => {
          await visitAiModeServiceDetailsPage(page, {
            category: 'databaseServices',
            fqn: serviceFqn,
            include: 'deleted',
          });

          await expect(page.getByTestId('deleted-badge')).toBeVisible();
          await expect(getRowByName(page, database)).toBeVisible();
          await expect(
            page.getByTestId('show-deleted').getByRole('switch')
          ).toBeChecked();
        });

        await test.step('restoring it relists the live databases', async () => {
          await page.getByRole('button', { name: 'Settings' }).click();
          const restoreItem = page
            .getByRole('menu', { name: 'Settings' })
            .getByRole('menuitemradio', { name: 'Restore' });
          await expect(restoreItem).toBeVisible();

          const restore = waitForResponseWithStatus(
            page,
            (response) =>
              response.request().method() === 'PUT' &&
              response
                .url()
                .includes('/api/v1/services/databaseServices/restore'),
            200
          );
          const liveList = waitForServiceChildList(
            page,
            'databaseServices',
            serviceFqn,
            (params) => params.get('include') === 'non-deleted'
          );
          await restoreItem.click();
          await restore;
          await liveList;

          await expect(getRowByName(page, database)).toBeVisible();
          await expect(
            page.getByTestId('show-deleted').getByRole('switch')
          ).not.toBeChecked();
          await expect(page.getByTestId('deleted-badge')).toBeHidden();
        });
      });
    });

    test.describe('storage service', () => {
      let service: StorageServiceClass;
      let serviceFqn = '';
      let parent = '';
      let child = '';

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        service = new StorageServiceClass();
        await service.create(apiContext);
        serviceFqn = service.entityResponseData.fullyQualifiedName;
        const prefix = `pw-ai-container-${uuid()}`;
        parent = `${prefix}-parent`;
        child = `${prefix}-child`;

        const parentContainer = await okJson<EntityRef>(
          await apiContext.post('/api/v1/containers', {
            data: { name: parent, service: serviceFqn },
          }),
          'Create parent container'
        );
        await okJson(
          await apiContext.post('/api/v1/containers', {
            data: {
              name: child,
              service: serviceFqn,
              parent: { id: parentContainer.id, type: 'container' },
            },
          }),
          'Create child container'
        );

        await afterAction();
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await service.delete(apiContext);
        await afterAction();
      });

      test('lists only its top-level containers', async ({ page }) => {
        await enableAiAppMode(page);
        await visitAiModeServiceDetailsPage(page, {
          category: 'storageServices',
          fqn: serviceFqn,
        });

        await expect(getRowByName(page, parent)).toBeVisible();
        await expect(getRowByName(page, child)).toBeHidden();
      });
    });

    test.describe('drive service', () => {
      let service: DriveServiceClass;
      let serviceFqn = '';
      let directory = '';

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        service = new DriveServiceClass();
        await service.create(apiContext);
        serviceFqn = service.entityResponseData.fullyQualifiedName;
        directory = `pw-ai-directory-${uuid()}`;

        await okJson(
          await apiContext.post('/api/v1/drives/directories', {
            data: { name: directory, service: serviceFqn },
          }),
          'Create directory'
        );

        await afterAction();
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await service.delete(apiContext);
        await afterAction();
      });

      test('lists its directories', async ({ page }) => {
        await enableAiAppMode(page);
        await visitAiModeServiceDetailsPage(page, {
          category: 'driveServices',
          fqn: serviceFqn,
        });

        await expect(getRowByName(page, directory)).toBeVisible();
      });
    });

    test.describe('permissions', () => {
      // Header edit controls: asserted present on a live service first, so their absence on a
      // deleted one is not vacuous.
      const HEADER_EDIT_BUTTONS = [
        'edit-domain-button',
        'edit-owner-button',
        'edit-tier-button',
      ];
      let service: DatabaseServiceClass;
      let deletedService: DatabaseServiceClass;

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        service = new DatabaseServiceClass();
        deletedService = new DatabaseServiceClass();
        await settleAll([
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
        await settleAll([
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
        await enableAiAppMode(page);
        await enableAiAppMode(dataConsumerPage);

        await test.step('an admin has the tab', async () => {
          await visitAiModeServiceDetailsPage(page, {
            category: 'databaseServices',
            fqn,
          });

          await expect(
            page.getByRole('tab', { name: 'Connection', exact: true })
          ).toBeVisible();
        });

        await test.step('a data consumer does not', async () => {
          await visitAiModeServiceDetailsPage(dataConsumerPage, {
            category: 'databaseServices',
            fqn,
          });

          await expect(
            dataConsumerPage.getByRole('tab', { name: 'Databases' })
          ).toBeVisible();
          await expect(
            dataConsumerPage.getByRole('tab', {
              name: 'Connection',
              exact: true,
            })
          ).toBeHidden();
        });

        await test.step('nor through the tab URL', async () => {
          await visitAiModeServiceDetailsPage(dataConsumerPage, {
            category: 'databaseServices',
            fqn,
            tab: 'connection',
          });

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
        await enableAiAppMode(page);

        await test.step('a live service offers them', async () => {
          await visitAiModeServiceDetailsPage(page, {
            category: 'databaseServices',
            fqn: service.entityResponseData.fullyQualifiedName,
          });

          for (const testId of HEADER_EDIT_BUTTONS) {
            await expect(page.getByTestId(testId)).toBeVisible();
          }
        });

        await test.step('a deleted one does not', async () => {
          await visitAiModeServiceDetailsPage(page, {
            category: 'databaseServices',
            fqn: deletedService.entityResponseData.fullyQualifiedName,
            include: 'deleted',
          });

          await expect(page.getByTestId('deleted-badge')).toBeVisible();
          for (const testId of HEADER_EDIT_BUTTONS) {
            await expect(page.getByTestId(testId)).toBeHidden();
          }
        });
      });
    });
  }
);
