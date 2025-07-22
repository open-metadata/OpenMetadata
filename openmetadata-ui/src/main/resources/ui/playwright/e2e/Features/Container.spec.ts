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
import { expect } from '@playwright/test';
import { CONTAINER_CHILDREN } from '../../constant/contianer';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { test } from '../fixtures/pages';

const container = new ContainerClass();

test.slow(true);

test.describe('Container entity specific tests ', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);
    await container.create(apiContext, CONTAINER_CHILDREN);

    await afterAction();
  });

  test.afterAll('Clean up', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    await container.delete(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ dataConsumerPage: page }) => {
    await redirectToHomePage(page);
  });

  test('Container page should show Schema and Children count', async ({
    dataConsumerPage: page,
  }) => {
    await container.visitEntityPageWithCustomSearchBox(page);

    await expect(page.getByTestId('schema').getByTestId('count')).toBeVisible();
    await expect(
      page.getByTestId('children').getByTestId('count')
    ).toBeVisible();
  });

  test('Container page children pagination', async ({
    dataConsumerPage: page,
  }) => {
    await container.visitEntityPageWithCustomSearchBox(page);

    await page.getByText('Children').click();

    await expect(page.getByTestId('pagination')).toBeVisible();
    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 2 '
    );

    // Check the second page pagination
    const childrenResponse = page.waitForResponse(
      '/api/v1/containers/name/*/children?limit=15&offset=15'
    );
    await page.getByTestId('next').click();
    await childrenResponse;

    await expect(page.getByTestId('next')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 2 of 2 '
    );

    // Check around the page sizing change
    const childrenResponseSizeChange = page.waitForResponse(
      '/api/v1/containers/name/*/children?limit=25&offset=0'
    );
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByText('25 / Page').click();
    await childrenResponseSizeChange;

    await page.waitForSelector('.ant-spin', {
      state: 'detached',
    });

    await expect(page.getByTestId('next')).toBeDisabled();
    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 1'
    );

    // Back to the original page size
    const childrenResponseSizeChange2 = page.waitForResponse(
      '/api/v1/containers/name/*/children?limit=15&offset=0'
    );
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByText('15 / Page').click();
    await childrenResponseSizeChange2;

    await page.waitForSelector('.ant-spin', {
      state: 'detached',
    });

    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 2'
    );
  });
});
