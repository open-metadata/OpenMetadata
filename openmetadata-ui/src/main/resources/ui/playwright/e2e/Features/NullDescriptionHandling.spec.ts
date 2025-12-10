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
import test, { expect } from '@playwright/test';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { performAdminLogin } from '../../utils/admin';
import { visitGlossaryPage } from '../../utils/common';

/**
 * This test verifies that the UI handles entities with deleted descriptions
 * gracefully. The issue occurs when:
 * 1. An entity is created with a description
 * 2. The description is later deleted/cleared via API patch
 * 3. The API returns the entity without a description field (due to @JsonInclude(NON_NULL))
 * 4. UI should handle this gracefully instead of crashing
 */
test.describe('Null Description Handling - Delete Description Flow', () => {
  test.describe('Glossary Term', () => {
    const glossary = new Glossary();
    let glossaryTerm: GlossaryTerm;

    test.beforeAll(async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);

      // Create glossary with description
      await glossary.create(apiContext);

      // Create glossary term with description
      glossaryTerm = new GlossaryTerm(glossary);
      await glossaryTerm.create(apiContext);

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    });

    test('should handle glossary term after description is deleted', async ({
      browser,
    }) => {
      const { page, afterAction, apiContext } = await performAdminLogin(
        browser
      );

      // Delete the description via API PATCH to simulate the scenario
      await apiContext.patch(
        `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
        {
          data: [
            {
              op: 'remove',
              path: '/description',
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      // Navigate to the glossary page using displayName
      await visitGlossaryPage(page, glossary.responseData.displayName);

      // Wait for the table to load
      await page.waitForSelector('[data-testid="glossary-terms-table"]');

      // Verify the table renders without crashing
      const table = page.getByTestId('glossary-terms-table');

      await expect(table).toBeVisible();

      // Verify no error page is shown
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
      await expect(
        page.locator('text=Cannot read properties of undefined')
      ).not.toBeVisible();

      // Click on the term to view details
      await page.getByTestId(glossaryTerm.responseData.displayName).click();

      // Verify the term details page loads without error
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();

      // Verify no error on details page
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();

      await afterAction();
    });
  });

  test.describe('Domain', () => {
    const domain = new Domain();

    test.beforeAll(async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);
      await domain.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);
      await domain.delete(apiContext);
      await afterAction();
    });

    test('should handle domain after description is deleted', async ({
      browser,
    }) => {
      const { page, afterAction, apiContext } = await performAdminLogin(
        browser
      );

      // Delete the description via API PATCH
      await apiContext.patch(`/api/v1/domains/${domain.responseData.id}`, {
        data: [
          {
            op: 'remove',
            path: '/description',
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      });

      // Navigate to the domain page
      await domain.visitEntityPage(page);

      // Verify the domain page loads without error
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();

      // Verify no error page is shown
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
      await expect(
        page.locator('text=Cannot read properties of undefined')
      ).not.toBeVisible();

      await afterAction();
    });
  });

  test.describe('Glossary', () => {
    const glossary = new Glossary();

    test.beforeAll(async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);
      await glossary.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);
      await glossary.delete(apiContext);
      await afterAction();
    });

    test('should handle glossary after description is deleted', async ({
      browser,
    }) => {
      const { page, afterAction, apiContext } = await performAdminLogin(
        browser
      );

      // Delete the description via API PATCH
      await apiContext.patch(`/api/v1/glossaries/${glossary.responseData.id}`, {
        data: [
          {
            op: 'remove',
            path: '/description',
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      });

      // Navigate to the glossary page using displayName
      await visitGlossaryPage(page, glossary.responseData.displayName);

      // Verify the glossary page loads without error
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();

      // Verify no error page is shown
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
      await expect(
        page.locator('text=Cannot read properties of undefined')
      ).not.toBeVisible();

      await afterAction();
    });
  });

  test.describe('Data Product', () => {
    const domain = new Domain();
    let dataProduct: DataProduct;

    test.beforeAll(async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);
      await domain.create(apiContext);
      dataProduct = new DataProduct([domain]);
      await dataProduct.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    });

    test('should handle data product after description is deleted', async ({
      browser,
    }) => {
      const { page, afterAction, apiContext } = await performAdminLogin(
        browser
      );

      // Delete the description via API PATCH
      await apiContext.patch(
        `/api/v1/dataProducts/${dataProduct.responseData.id}`,
        {
          data: [
            {
              op: 'remove',
              path: '/description',
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      // Navigate to the domain page
      await domain.visitEntityPage(page);

      // Navigate to data products tab
      await page.getByTestId('data_products').click();

      // Click on the data product using displayName
      await page.getByText(dataProduct.responseData.displayName).click();

      // Verify the data product page loads without error
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();

      // Verify no error page is shown
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
      await expect(
        page.locator('text=Cannot read properties of undefined')
      ).not.toBeVisible();

      await afterAction();
    });
  });
});
