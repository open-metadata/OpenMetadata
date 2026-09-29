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
import { APIRequestContext, expect, Page, Response } from '@playwright/test';
import { DOMAIN_TAGS } from '../../constant/config';
import { MetricClass } from '../../support/entity/MetricClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

type LinkableAsset = TableClass | TopicClass;

const metricToAdd = new MetricClass();
const metricWithAssets = new MetricClass();
const metricToRemove = new MetricClass();
const table = new TableClass();
const secondTable = new TableClass();
const topic = new TopicClass();

const assetFqn = (asset: LinkableAsset) =>
  asset.entityResponseData.fullyQualifiedName ?? '';

const assetCard = (page: Page, asset: LinkableAsset) =>
  page.getByTestId(`table-data-card_${assetFqn(asset)}`);

const assetSelectionModal = (page: Page) =>
  page.getByTestId('asset-selection-modal');

// The Assets tab searches the linked assets by search document id, which is the only
// search request on the metric page that carries an `ids` query.
const isLinkedAssetsSearch = (response: Response) =>
  response.url().includes('/api/v1/search/query') &&
  decodeURIComponent(response.url()).includes('"ids"') &&
  response.status() === 200;

const linkAssets = async (
  apiContext: APIRequestContext,
  metric: MetricClass,
  assets: { asset: LinkableAsset; type: string }[]
) => {
  const response = await apiContext.put(
    `/api/v1/metrics/${encodeURIComponent(
      metric.entityResponseData.fullyQualifiedName ?? ''
    )}/assets/add`,
    {
      data: {
        assets: assets.map(({ asset, type }) => ({
          id: asset.entityResponseData.id,
          type,
        })),
      },
    }
  );

  expect(response.status()).toBe(200);
};

const openAssetsTab = async (page: Page, metric: MetricClass) => {
  await metric.visitEntityPage(page);
  const linkedAssetsSearch = page.waitForResponse(isLinkedAssetsSearch);
  await page.getByRole('tab', { name: /^Assets/ }).click();
  await linkedAssetsSearch;
  await waitForAllLoadersToDisappear(page);
};

const selectAssetInPicker = async (page: Page, asset: LinkableAsset) => {
  const searchResponse = page.waitForResponse('/api/v1/search/query?*');
  await assetSelectionModal(page)
    .getByTestId('searchbar')
    .fill(asset.entityResponseData.name);
  await searchResponse;

  const card = assetCard(page, asset);
  await expect(card).toBeVisible();
  await card.locator('input[type="checkbox"]').check();
  await expect(card.locator('input[type="checkbox"]')).toBeChecked();
};

test.describe(
  'Metric Assets',
  { tag: ['@Features', DOMAIN_TAGS.GOVERNANCE] },
  () => {
    test.beforeAll('Setup metrics and assets', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await Promise.all([
        metricToAdd.create(apiContext),
        metricWithAssets.create(apiContext),
        metricToRemove.create(apiContext),
        table.create(apiContext),
        secondTable.create(apiContext),
        topic.create(apiContext),
      ]);

      await linkAssets(apiContext, metricWithAssets, [
        { asset: table, type: 'table' },
        { asset: topic, type: 'topic' },
      ]);
      await linkAssets(apiContext, metricToRemove, [
        { asset: table, type: 'table' },
        { asset: secondTable, type: 'table' },
      ]);

      await afterAction();
    });

    test.afterAll('Cleanup metrics and assets', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await Promise.all([
        metricToAdd.delete(apiContext),
        metricWithAssets.delete(apiContext),
        metricToRemove.delete(apiContext),
        table.delete(apiContext),
        secondTable.delete(apiContext),
        topic.delete(apiContext),
      ]);

      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('admin links assets from the header and sees them on the Assets tab', async ({
      page,
    }) => {
      test.slow();

      await test.step('Open the asset picker from the metric header', async () => {
        await metricToAdd.visitEntityPage(page);
        await page.getByTestId('metric-add-assets-button').click();

        await expect(assetSelectionModal(page)).toBeVisible();
      });

      await test.step('Link a table and a topic', async () => {
        await selectAssetInPicker(page, table);
        await selectAssetInPicker(page, topic);

        const addResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/assets/add') &&
            response.request().method() === 'PUT'
        );
        const linkedAssetsSearch = page.waitForResponse(isLinkedAssetsSearch);
        await assetSelectionModal(page).getByTestId('save-btn').click();

        expect((await addResponse).status()).toBe(200);

        await linkedAssetsSearch;
        await expect(assetSelectionModal(page)).not.toBeVisible();
      });

      await test.step('Land on the Assets tab with both assets listed', async () => {
        await expect(page).toHaveURL(/\/assets$/);
        await expect(
          page.getByTestId('assets').getByTestId('count')
        ).toContainText('2');
        await expect(assetCard(page, table)).toBeVisible();
        await expect(assetCard(page, topic)).toBeVisible();
      });

      await test.step('Keep linked assets out of the picker', async () => {
        await page.getByTestId('metric-add-assets-button').click();
        await expect(assetSelectionModal(page)).toBeVisible();

        const searchResponse = page.waitForResponse('/api/v1/search/query?*');
        await assetSelectionModal(page)
          .getByTestId('searchbar')
          .fill(table.entityResponseData.name);
        await searchResponse;
        await waitForAllLoadersToDisappear(page);

        await expect(
          assetSelectionModal(page).getByTestId(
            `table-data-card_${assetFqn(table)}`
          )
        ).not.toBeVisible();

        await assetSelectionModal(page)
          .getByRole('button', { name: 'Cancel' })
          .click();
        await expect(assetSelectionModal(page)).not.toBeVisible();
      });
    });

    test('metric tabs keep Assets between Lineage and Activity Feed', async ({
      page,
    }) => {
      await metricWithAssets.visitEntityPage(page);

      await expect(
        page.getByTestId('tabs').getByRole('tablist').getByRole('tab')
      ).toHaveText([
        /^Overview/,
        /^Lineage/,
        /^Assets/,
        /^Activity Feeds & Tasks/,
        /^Custom Properties/,
      ]);
    });

    test('admin searches the linked assets and previews one', async ({
      page,
    }) => {
      await openAssetsTab(page, metricWithAssets);

      await test.step('Search narrows the list to the matching asset', async () => {
        const searchResponse = page.waitForResponse(isLinkedAssetsSearch);
        await page
          .getByTestId('table-container')
          .getByTestId('searchbar')
          .fill(topic.entityResponseData.name);
        await searchResponse;
        await waitForAllLoadersToDisappear(page);

        await expect(assetCard(page, topic)).toBeVisible();
        await expect(assetCard(page, table)).not.toBeVisible();
      });

      await test.step('Summary panel shows the selected asset', async () => {
        await expect(
          page.getByTestId('entity-summary-panel-container')
        ).toContainText(topic.entityResponseData.name);
      });
    });

    test('admin unlinks assets one at a time and in bulk', async ({ page }) => {
      test.slow();

      await openAssetsTab(page, metricToRemove);

      await test.step('Unlink one asset from its card menu', async () => {
        await page
          .getByTestId(`manage-button-${assetFqn(secondTable)}`)
          .click();
        await page.getByTestId('delete-button').click();

        const removeResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/assets/remove') &&
            response.request().method() === 'PUT'
        );
        await page.getByRole('dialog').getByTestId('save-button').click();

        expect((await removeResponse).status()).toBe(200);

        await expect(assetCard(page, secondTable)).not.toBeVisible();
        await expect(
          page.getByTestId('assets').getByTestId('count')
        ).toContainText('1');
      });

      await test.step('Unlinked asset stays gone after reload', async () => {
        const linkedAssetsSearch = page.waitForResponse(isLinkedAssetsSearch);
        await page.reload();
        await linkedAssetsSearch;
        await waitForAllLoadersToDisappear(page);

        await expect(assetCard(page, table)).toBeVisible();
        await expect(assetCard(page, secondTable)).not.toBeVisible();
      });

      await test.step('Bulk unlink the remaining asset', async () => {
        await assetCard(page, table).locator('input[type="checkbox"]').check();

        const removeResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/assets/remove') &&
            response.request().method() === 'PUT'
        );
        await page.getByTestId('delete-all-button').click();

        expect((await removeResponse).status()).toBe(200);

        await expect(page.getByText('No assets linked yet')).toBeVisible();
        await expect(
          page.getByTestId('assets').getByTestId('count')
        ).toContainText('0');
      });
    });

    test('data consumer sees linked assets but cannot change them', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);
      await openAssetsTab(dataConsumerPage, metricWithAssets);

      await expect(assetCard(dataConsumerPage, table)).toBeVisible();
      await expect(assetCard(dataConsumerPage, topic)).toBeVisible();
      await expect(
        dataConsumerPage.getByTestId('metric-add-assets-button')
      ).not.toBeVisible();
      await expect(
        dataConsumerPage.getByTestId(`manage-button-${assetFqn(table)}`)
      ).not.toBeVisible();
      await expect(
        assetCard(dataConsumerPage, table).locator('input[type="checkbox"]')
      ).not.toBeVisible();
    });
  }
);
