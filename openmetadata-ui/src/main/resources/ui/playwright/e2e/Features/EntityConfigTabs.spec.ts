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
import { expect, Page, test } from '@playwright/test';
import { DOMAIN_TAGS } from '../../constant/config';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

const TOPIC_CONFIG = {
  'cleanup.policy': 'delete',
  'retention.ms': '604800000',
  'min.insync.replicas': '2',
};

const SEARCH_INDEX_SETTINGS = {
  number_of_shards: 1,
  analysis: { analyzer: { om_analyzer: { tokenizer: 'letter' } } },
};

const formattedLineCount = (value: object) =>
  JSON.stringify(value, null, 2).split('\n').length;

const openTab = async (page: Page, tabId: string, tabName: string) => {
  await page.getByTestId(tabId).click();
  await waitForAllLoadersToDisappear(page);

  return page.getByRole('tabpanel', { name: tabName });
};

test.describe(
  'Entity config tabs',
  { tag: ['@Features', DOMAIN_TAGS.DISCOVERY] },
  () => {
    const topicWithConfig = new TopicClass();
    const topicWithEmptyConfig = new TopicClass();
    const searchIndexWithSettings = new SearchIndexClass();
    const searchIndexWithoutSettings = new SearchIndexClass();

    test.beforeAll('Create entities', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await Promise.all([
        topicWithConfig.create(apiContext),
        topicWithEmptyConfig.create(apiContext),
        searchIndexWithSettings.create(apiContext),
        searchIndexWithoutSettings.create(apiContext),
      ]);
      await topicWithConfig.patch({
        apiContext,
        patchData: [{ op: 'add', path: '/topicConfig', value: TOPIC_CONFIG }],
      });
      await topicWithEmptyConfig.patch({
        apiContext,
        patchData: [{ op: 'add', path: '/topicConfig', value: {} }],
      });
      await searchIndexWithSettings.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/searchIndexSettings',
            value: SEARCH_INDEX_SETTINGS,
          },
        ],
      });

      await afterAction();
    });

    test.afterAll('Delete entities', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await Promise.all([
        topicWithConfig.delete(apiContext),
        topicWithEmptyConfig.delete(apiContext),
        searchIndexWithSettings.delete(apiContext),
        searchIndexWithoutSettings.delete(apiContext),
      ]);

      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('Topic config tab shows formatted config with its line count', async ({
      page,
    }) => {
      await topicWithConfig.visitEntityPage(page);
      const panel = await openTab(page, 'config', 'Config');

      await expect(panel.getByTestId('query-line')).toHaveText(
        `${formattedLineCount(TOPIC_CONFIG)} Lines`
      );
      await expect(panel.getByTestId('code-mirror-container')).toContainText(
        '"cleanup.policy": "delete"'
      );
      await expect(panel.getByText('Config', { exact: true })).toHaveCount(0);
    });

    test('Topic config tab shows a placeholder when the topic config is empty', async ({
      page,
    }) => {
      await topicWithEmptyConfig.visitEntityPage(page);
      const panel = await openTab(page, 'config', 'Config');

      await expect(panel.getByTestId('no-data-placeholder')).toBeVisible();
      await expect(panel.getByTestId('query-line')).toHaveCount(0);
    });

    test('Search index settings tab shows formatted settings with its line count', async ({
      page,
    }) => {
      await searchIndexWithSettings.visitEntityPage(page);
      const panel = await openTab(
        page,
        'search-index-settings',
        'Search Index Settings'
      );

      await expect(panel.getByTestId('query-line')).toHaveText(
        `${formattedLineCount(SEARCH_INDEX_SETTINGS)} Lines`
      );
      await expect(panel.getByTestId('code-mirror-container')).toContainText(
        '"tokenizer": "letter"'
      );
      await expect(
        panel.getByText('Search Index Settings', { exact: true })
      ).toHaveCount(0);
    });

    test('Search index settings tab shows a placeholder when the index has no settings', async ({
      page,
    }) => {
      await searchIndexWithoutSettings.visitEntityPage(page);
      const panel = await openTab(
        page,
        'search-index-settings',
        'Search Index Settings'
      );

      await expect(panel.getByTestId('no-data-placeholder')).toBeVisible();
      await expect(panel.getByTestId('query-line')).toHaveCount(0);
    });
  }
);
