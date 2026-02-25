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

import { expect } from '@playwright/test';
import {
  LONG_DESCRIPTION,
  LONG_DESCRIPTION_END_TEXT,
} from '../../constant/domain';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import {
  getApiContext,
  redirectToHomePage,
  uuid,
  visitGlossaryPage,
} from '../../utils/common';
import {
  selectDataProduct,
  selectDomain,
  verifyDescriptionRequiresScroll,
  verifyEndOfDescriptionReachable,
} from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

test.describe('Long Description Visibility', () => {
  test.slow(true);

  let domain: Domain;
  let dataProductData: DataProduct['data'];
  let glossary: Glossary;
  let glossaryTerm: GlossaryTerm;

  test.beforeAll(
    'Setup entities with long descriptions',
    async ({ browser }) => {
      const adminPage = await browser.newPage({
        storageState: 'playwright/.auth/admin.json',
      });
      await adminPage.goto('/');
      const { apiContext, afterAction } = await getApiContext(adminPage);

      const id = uuid();

      // Domain
      domain = new Domain({
        name: `PW_Domain_LongDesc_${id}`,
        displayName: `PW Domain LongDesc ${id}`,
        description: LONG_DESCRIPTION,
        domainType: 'Aggregate',
        fullyQualifiedName: `PW_Domain_LongDesc_${id}`,
      });
      await domain.create(apiContext);

      // Data Product
      const dpName = `PW_DataProduct_LongDesc_${id}`;
      const dpResponse = await apiContext.post('/api/v1/dataProducts', {
        data: {
          name: dpName,
          displayName: `PW Data Product LongDesc ${id}`,
          description: LONG_DESCRIPTION,
          domains: [domain.responseData.fullyQualifiedName],
        },
      });

      if (!dpResponse.ok()) {
        throw new Error(
          `Failed to create data product: ${dpResponse.status()} ${await dpResponse.text()}`
        );
      }

      dataProductData = await dpResponse.json();

      // Glossary
      glossary = new Glossary(`PW_Glossary_LongDesc_${id}`);
      glossary.data.description = LONG_DESCRIPTION;
      await glossary.create(apiContext);

      // Glossary Term
      glossaryTerm = new GlossaryTerm(
        glossary,
        undefined,
        `PW_GlossaryTerm_LongDesc_${id}`
      );
      glossaryTerm.data.description = LONG_DESCRIPTION;
      await glossaryTerm.create(apiContext);

      await afterAction();
      await adminPage.close();
    }
  );

  // ── Domain ──

  test('Domain long description is scrollable and end of text is visible after scroll', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, domain.responseData);

    const descContainer = page.getByTestId('asset-description-container');
    await expect(descContainer).toBeVisible();
    await expect(page.getByTestId('viewer-container')).toBeVisible();

    await expect(page.getByTestId('read-more-button')).not.toBeVisible();

    await verifyDescriptionRequiresScroll(descContainer, page);
  });

  test('Domain description card collapse hides content and expand restores scrollability', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, domain.responseData);

    const descContainer = page.getByTestId('asset-description-container');
    await expect(descContainer).toBeVisible();
    await expect(descContainer).toHaveClass(/\bexpanded\b/);

    await descContainer.getByTestId('expand-collapse-icon').click();
    await expect(descContainer).not.toHaveClass(/\bexpanded\b/);

    await descContainer.getByTestId('expand-collapse-icon').click();
    await expect(descContainer).toHaveClass(/\bexpanded\b/);

    await verifyDescriptionRequiresScroll(descContainer, page);
  });

  // ── Data Product ──

  test('Data Product truncates long description and end of text is not visible before expand', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, dataProductData);
    await page.waitForLoadState('networkidle');

    const descContainer = page.getByTestId('asset-description-container');
    await expect(descContainer).toBeVisible();

    await expect(
      descContainer.getByTestId('read-more-button')
    ).toBeVisible();

    await expect(
      descContainer.getByText(LONG_DESCRIPTION_END_TEXT)
    ).not.toBeVisible();
  });

  test('Data Product long description is scrollable and end of text is visible after expanding', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, dataProductData);
    await page.waitForLoadState('networkidle');

    const descContainer = page.getByTestId('asset-description-container');
    await expect(descContainer).toBeVisible();

    await descContainer.getByTestId('read-more-button').click();

    await verifyEndOfDescriptionReachable(descContainer, page);

    await expect(
      descContainer.getByTestId('read-less-button')
    ).toBeVisible();

    await descContainer.getByTestId('read-less-button').click();
    await expect(
      descContainer.getByText(LONG_DESCRIPTION_END_TEXT)
    ).not.toBeVisible();
    await expect(
      descContainer.getByTestId('read-more-button')
    ).toBeVisible();
  });

  test('Data Product description card collapse hides content and expand restores it', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, dataProductData);
    await page.waitForLoadState('networkidle');

    const descContainer = page.getByTestId('asset-description-container');
    await expect(descContainer).toBeVisible();
    await expect(descContainer).toHaveClass(/\bexpanded\b/);

    await descContainer.getByTestId('expand-collapse-icon').click();
    await expect(descContainer).not.toHaveClass(/\bexpanded\b/);

    await descContainer.getByTestId('expand-collapse-icon').click();
    await expect(descContainer).toHaveClass(/\bexpanded\b/);
  });

  // ── Glossary ──

  test('Glossary truncates long description and end of text is not visible before expand', async ({
    page,
  }) => {
    await visitGlossaryPage(page, glossary.responseData.displayName);

    const descContainer = page.getByTestId('asset-description-container');
    await expect(descContainer).toBeVisible();

    await expect(
      descContainer.getByTestId('read-more-button')
    ).toBeVisible();

    await expect(
      descContainer.getByText(LONG_DESCRIPTION_END_TEXT)
    ).not.toBeVisible();
  });

  test('Glossary long description is visible after expanding', async ({
    page,
  }) => {
    await visitGlossaryPage(page, glossary.responseData.displayName);

    const descContainer = page.getByTestId('asset-description-container');
    await expect(descContainer).toBeVisible();

    await descContainer.getByTestId('read-more-button').click();

    await verifyEndOfDescriptionReachable(descContainer, page);

    await expect(
      descContainer.getByTestId('read-less-button')
    ).toBeVisible();

    await descContainer.getByTestId('read-less-button').click();
    await expect(
      descContainer.getByText(LONG_DESCRIPTION_END_TEXT)
    ).not.toBeVisible();
    await expect(
      descContainer.getByTestId('read-more-button')
    ).toBeVisible();
  });

  test('Glossary description card collapse hides content and expand restores it', async ({
    page,
  }) => {
    await visitGlossaryPage(page, glossary.responseData.displayName);

    const descContainer = page.getByTestId('asset-description-container');
    await expect(descContainer).toBeVisible();
    await expect(descContainer).toHaveClass(/\bexpanded\b/);

    await descContainer.getByTestId('expand-collapse-icon').click();
    await expect(descContainer).not.toHaveClass(/\bexpanded\b/);

    await descContainer.getByTestId('expand-collapse-icon').click();
    await expect(descContainer).toHaveClass(/\bexpanded\b/);
  });

  // ── Glossary Term ──

  test('Glossary Term truncates long description and end of text is not visible before expand', async ({
    page,
  }) => {
    await glossaryTerm.visitPage(page);

    const descContainer = page.getByTestId('asset-description-container');
    await expect(descContainer).toBeVisible();

    await expect(
      descContainer.getByTestId('read-more-button')
    ).toBeVisible();

    await expect(
      descContainer.getByText(LONG_DESCRIPTION_END_TEXT)
    ).not.toBeVisible();
  });

  test('Glossary Term long description is visible after expanding', async ({
    page,
  }) => {
    await glossaryTerm.visitPage(page);

    const descContainer = page.getByTestId('asset-description-container');
    await expect(descContainer).toBeVisible();

    await descContainer.getByTestId('read-more-button').click();

    await verifyEndOfDescriptionReachable(descContainer, page);

    await expect(
      descContainer.getByTestId('read-less-button')
    ).toBeVisible();

    await descContainer.getByTestId('read-less-button').click();
    await expect(
      descContainer.getByText(LONG_DESCRIPTION_END_TEXT)
    ).not.toBeVisible();
    await expect(
      descContainer.getByTestId('read-more-button')
    ).toBeVisible();
  });

  test('Glossary Term description card collapse hides content and expand restores it', async ({
    page,
  }) => {
    await glossaryTerm.visitPage(page);

    const descContainer = page.getByTestId('asset-description-container');
    await expect(descContainer).toBeVisible();
    await expect(descContainer).toHaveClass(/\bexpanded\b/);

    await descContainer.getByTestId('expand-collapse-icon').click();
    await expect(descContainer).not.toHaveClass(/\bexpanded\b/);

    await descContainer.getByTestId('expand-collapse-icon').click();
    await expect(descContainer).toHaveClass(/\bexpanded\b/);
  });
});
