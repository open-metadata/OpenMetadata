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

/**
 * Regression tests for the entityReference custom property quoted-FQN bug.
 *
 * When the backend stores a custom property extension with a fullyQualifiedName
 * containing surrounding double-quotes (e.g. `"jsmith"`), PropertyValue.tsx
 * must strip those quotes before building the link — otherwise the rendered href
 * contains URL-encoded quotes (%22) and the display text shows literal quote
 * characters.
 */

import { expect, test } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe
  .serial('entityReference custom property — quoted FQN regression', () => {
  const table = new TableClass();
  const user = new UserClass();
  let customPropertyName: string;
  let entityRefTypeId: string;
  let entitySchemaId: string;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await table.create(apiContext);
    await user.create(apiContext);

    const typesRes = await apiContext.get(
      '/api/v1/metadata/types?category=field&limit=20'
    );
    const types = await typesRes.json();
    const entityRefType = types.data.find(
      (t: { name: string }) => t.name === 'entityReference'
    );
    entityRefTypeId = entityRefType.id;

    const schemaRes = await apiContext.get('/api/v1/metadata/types/name/table');
    const entitySchema = await schemaRes.json();
    entitySchemaId = entitySchema.id;

    customPropertyName = `cp-ref-quoted-${uuid()}`;
    await apiContext.put(`/api/v1/metadata/types/${entitySchemaId}`, {
      data: {
        name: customPropertyName,
        description: customPropertyName,
        propertyType: { id: entityRefTypeId, type: 'type' },
        customPropertyConfig: { config: ['user', 'team'] },
      },
    });

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    const schemaRes = await apiContext.get(
      `/api/v1/metadata/types/${entitySchemaId}`
    );
    const entitySchema = await schemaRes.json();
    const propIndex = (
      entitySchema.customProperties as Array<{ name: string }>
    ).findIndex((p) => p.name === customPropertyName);

    if (propIndex !== -1) {
      await apiContext.patch(`/api/v1/metadata/types/${entitySchemaId}`, {
        data: [{ op: 'remove', path: `/customProperties/${propIndex}` }],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });
    }

    await table.delete(apiContext);
    await user.delete(apiContext);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('strips quotes from FQN — link text and href are clean for single entityReference', async ({
    page,
  }) => {
    test.slow();
    const { apiContext, afterAction } = await getApiContext(page);

    const plainName = user.responseData.name;
    const quotedFqn = `"${plainName}"`;

    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/extension',
          value: {
            [customPropertyName]: {
              id: user.responseData.id,
              type: 'user',
              name: quotedFqn,
              fullyQualifiedName: quotedFqn,
            },
          },
        },
      ],
    });

    await table.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await test.step('navigate to custom properties tab', async () => {
      const cpTab = page.getByTestId('custom_properties');
      await cpTab.waitFor({ state: 'visible' });
      await cpTab.click();
    });

    const link = page.getByTestId(customPropertyName).getByRole('link').first();

    await expect(link).toBeVisible();

    await test.step('display text must not contain surrounding quotes', async () => {
      await expect(link).toContainText(plainName);
      await expect(link).not.toContainText(`"${plainName}"`);
    });

    await test.step('href must not contain URL-encoded quotes (%22)', async () => {
      const href = await link.getAttribute('href');

      expect(href).toContain(`/users/${plainName}`);
      expect(href).not.toContain('%22');
    });

    await test.step('clicking link navigates to the correct user profile URL', async () => {
      const userDetailsResponse = page.waitForResponse('/api/v1/users/name/*');
      await link.click();
      await userDetailsResponse;

      await expect(page).toHaveURL(new RegExp(`/users/${plainName}$`));
    });

    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'remove',
          path: `/extension/${customPropertyName}`,
        },
      ],
    });

    await afterAction();
  });

  test('strips quotes from name when fullyQualifiedName is absent', async ({
    page,
  }) => {
    test.slow();
    const { apiContext, afterAction } = await getApiContext(page);

    const plainName = user.responseData.name;
    const quotedName = `"${plainName}"`;

    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/extension',
          value: {
            [customPropertyName]: {
              id: user.responseData.id,
              type: 'user',
              name: quotedName,
            },
          },
        },
      ],
    });

    await table.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await test.step('navigate to custom properties tab', async () => {
      const cpTab = page.getByTestId('custom_properties');
      await cpTab.waitFor({ state: 'visible' });
      await cpTab.click();
    });

    const link = page.getByTestId(customPropertyName).getByRole('link').first();

    await expect(link).toBeVisible();

    await test.step('display text must not contain surrounding quotes', async () => {
      await expect(link).toContainText(plainName);
      await expect(link).not.toContainText(`"${plainName}"`);
    });

    await test.step('href must not contain URL-encoded quotes (%22)', async () => {
      const href = await link.getAttribute('href');

      expect(href).not.toContain('%22');
    });

    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'remove',
          path: `/extension/${customPropertyName}`,
        },
      ],
    });

    await afterAction();
  });
});
