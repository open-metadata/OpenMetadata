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
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
  visitGlossaryPage,
} from '../../utils/common';
import {
  selectDataProduct,
  selectDomain,
  verifyDescriptionRequiresScroll,
  verifyEndOfDescriptionReachable,
} from '../../utils/domain';
import { navigateToPersonaWithPagination } from '../../utils/persona';
import { settingClick, sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

test.describe('Long Description Visibility', () => {
  test.slow(true);

  let domain: Domain;
  let dataProductData: DataProduct['data'];
  let glossary: Glossary;
  let glossaryTerm: GlossaryTerm;
  let persona: PersonaClass;
  let adminUser: AdminClass;
  let regularUser: UserClass;
  let table: TableClass;

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

      // Persona + Table for customized detail page test
      persona = new PersonaClass();
      await persona.create(apiContext);

      adminUser = new AdminClass();
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);

      regularUser = new UserClass();
      await regularUser.create(apiContext);
      await regularUser.setAdminRole(apiContext);

      await regularUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/personas/0',
            value: {
              id: persona.responseData.id,
              name: persona.responseData.name,
              displayName: persona.responseData.displayName,
              fullyQualifiedName:
                persona.responseData.fullyQualifiedName,
              type: 'persona',
            },
          },
          {
            op: 'add',
            path: '/defaultPersona',
            value: {
              id: persona.responseData.id,
              name: persona.responseData.name,
              displayName: persona.responseData.displayName,
              fullyQualifiedName:
                persona.responseData.fullyQualifiedName,
              type: 'persona',
            },
          },
        ],
      });

      table = new TableClass();
      table.entity.description = LONG_DESCRIPTION;
      await table.create(apiContext);

      await afterAction();
      await adminPage.close();
    }
  );

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await persona.delete(apiContext);
    await adminUser.delete(apiContext);
    await regularUser.delete(apiContext);
    await table.delete(apiContext);
    await afterAction();
  });

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

  // ── Customized Table Detail Page ──

  test('Customized Table detail page Description widget shows long description', async ({
    browser,
  }) => {
    // Admin: Customize Table detail page for persona
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await redirectToHomePage(adminPage);

    const personaListResponse =
      adminPage.waitForResponse('/api/v1/personas?*');
    await settingClick(adminPage, GlobalSettingOptions.PERSONA);
    await personaListResponse;
    await navigateToPersonaWithPagination(
      adminPage,
      persona.data.name,
      true
    );
    await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
    await adminPage.waitForLoadState('networkidle');

    await adminPage.getByText('Data Assets').click();
    await adminPage.getByText('Table', { exact: true }).click();
    await adminPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Add custom tab
    await adminPage.getByRole('button', { name: 'Add tab' }).click();
    await expect(adminPage.getByRole('dialog')).toBeVisible();
    await adminPage.getByTestId('add-tab-input').fill('Description Tab');

    const addButton = adminPage
      .getByRole('dialog')
      .getByRole('button', { name: 'Add' });
    await adminPage.locator('.ant-modal').waitFor({ state: 'visible' });
    await expect(addButton).toBeEnabled();
    await addButton.click();

    await expect(
      adminPage.getByTestId('tab-Description Tab')
    ).toBeVisible();

    // Wait for dialog to close
    await adminPage.getByRole('dialog').waitFor({ state: 'hidden' });
    await adminPage
      .locator('.ant-modal-wrap')
      .waitFor({ state: 'detached' });

    // Add Description widget to custom tab
    const addWidgetButton = adminPage
      .getByTestId('ExtraWidget.EmptyWidgetPlaceholder')
      .getByTestId('add-widget-button');
    await addWidgetButton.waitFor({ state: 'visible' });
    await expect(addWidgetButton).toBeEnabled();
    await addWidgetButton.click();
    await adminPage
      .getByTestId('widget-info-tabs')
      .waitFor({ state: 'visible' });

    await adminPage
      .getByTestId('add-widget-modal')
      .getByTestId('Description-widget')
      .click();
    await adminPage
      .getByTestId('add-widget-modal')
      .getByTestId('add-widget-button')
      .click();

    await adminPage
      .getByTestId('widget-info-tabs')
      .waitFor({ state: 'hidden' });

    // Save customization
    await adminPage.getByTestId('save-button').click();
    await toastNotification(
      adminPage,
      /^Page layout (created|updated) successfully\.$/
    );
    await adminPage.close();

    // User: Validate long description in custom tab
    const userPage = await browser.newPage();
    await regularUser.login(userPage);
    await redirectToHomePage(userPage);

    await table.visitEntityPage(userPage);
    await userPage.waitForLoadState('networkidle');
    await userPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(
      userPage.getByRole('tab', { name: 'Description Tab' })
    ).toBeVisible();
    await userPage.getByRole('tab', { name: 'Description Tab' }).click();

    const descriptionWidget = userPage
      .getByTestId(/KnowledgePanel.Description-/)
      .locator('visible=true');
    await expect(descriptionWidget).toBeVisible();

    // Widget truncates long content behind a "more" button
    const moreButton = descriptionWidget.getByRole('button', {
      name: 'more',
    });
    await expect(moreButton).toBeVisible();
    await moreButton.click();

    await verifyEndOfDescriptionReachable(descriptionWidget, userPage);

    await userPage.close();
  });
});
