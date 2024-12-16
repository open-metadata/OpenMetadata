import { test } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  getApiContext,
  toastNotification,
} from '../../utils/common';
import { updateServiceNameFilter } from '../../utils/queryBuilder';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const table1 = new TableClass();

test.describe('Query Builder Widget', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { page } = await createNewPage(browser);
    const { apiContext, afterAction } = await getApiContext(page);
    await table1.create(apiContext);
    await afterAction();
  });

  test.afterAll('Clean up', async ({ browser }) => {
    const { page } = await createNewPage(browser);
    const { apiContext, afterAction } = await getApiContext(page);
    await table1.delete(apiContext);
    await afterAction();
  });

  // Don't need for OSS
  if (!process.env.PLAYWRIGHT_IS_OSS) {
    test('should persist the value in query builder widget', async ({
      page,
    }) => {
      await sidebarClick(page, SidebarItem.SETTINGS);
      const res = page.waitForResponse('/api/v1/apps?*');
      await page.getByTestId('apps').click();
      await res;

      const appRes = page.waitForResponse(
        '/api/v1/apps/name/CollateAIApplication?*'
      );

      await page
        .getByTestId('collate-ai-application-card')
        .getByTestId('config-btn')
        .click();

      await appRes;

      const customPropRes = page.waitForResponse(
        '/api/v1/metadata/types/customProperties'
      );
      await page.getByTestId('configuration').click();
      await customPropRes;

      await updateServiceNameFilter(page, table1.service.name);

      const saveRes = page.waitForResponse(
        '/api/v1/apps/configure/CollateAIApplication'
      );
      await page.click('[data-testid="submit-btn"]');
      await saveRes;

      await toastNotification(page, 'Configuration saved successfully');
    });
  }
});
