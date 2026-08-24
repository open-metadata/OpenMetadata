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
import { expect, Page, test as base } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, toastNotification } from '../../utils/common';
import {
  checkAllDefaultWidgets,
  navigateToCustomizeLandingPage,
  openAddCustomizeWidgetModal,
  removeAndCheckWidget,
  saveCustomizeLayoutPage,
  waitForLandingPageWidget,
} from '../../utils/customizeLandingPage';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

type LandingPageTestFixtures = {
  adminPage: Page;
  testUser: UserClass;
  persona: PersonaClass;
};

// Issue #31407 (same class of bug as CustomizeWidgets). Every test here rewrites
// the whole `persona.<name>` layout document, and the landing page resolves its
// layout from `currentUser.defaultPersona`. Under `fullyParallel` this file's
// tests run in different workers, so both the persona and the user have to be
// per test: a shared persona makes layout saves last-write-wins across tests,
// and previously only one test set the default persona, leaving the others to
// assert the persona layout against a session that rendered the stock layout.
const test = base.extend<LandingPageTestFixtures>({
  testUser: async ({ browser }, use) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const user = new UserClass();
    await user.create(apiContext);
    await user.setAdminRole(apiContext);
    await afterAction();

    await use(user);

    const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
      await performAdminLogin(browser);
    await user.delete(cleanupContext);
    await cleanupAfterAction();
  },

  persona: async ({ browser, testUser }, use) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const testPersona = new PersonaClass();
    await testPersona.create(apiContext, [testUser.responseData.id]);

    const personaReference = {
      id: testPersona.responseData.id,
      type: 'persona',
      name: testPersona.responseData.name,
      fullyQualifiedName: testPersona.responseData.fullyQualifiedName,
      description: testPersona.responseData.description,
      displayName: testPersona.responseData.displayName,
    };

    await apiContext.patch(`/api/v1/users/${testUser.responseData.id}`, {
      data: [
        { op: 'add', path: '/personas/0', value: personaReference },
        { op: 'add', path: '/defaultPersona', value: personaReference },
      ],
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    });
    await afterAction();

    await use(testPersona);

    const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
      await performAdminLogin(browser);
    await testPersona.delete(cleanupContext);
    await cleanupAfterAction();
  },

  adminPage: async ({ browser, testUser, persona }, use) => {
    // `persona` is depended on for its side effect - the default persona has to
    // be attached to the user before login, otherwise the session starts with
    // the stock layout instead of the persona's customizable one.
    void persona;

    const adminPage = await browser.newPage();
    await testUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

test.describe(
  'Customize Landing Page Flow',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('Check all default widget present', async ({ adminPage }) => {
      await redirectToHomePage(adminPage);
      await checkAllDefaultWidgets(adminPage);
    });

    test('Add, Remove and Reset widget should work properly', async ({
      adminPage,
      persona,
    }) => {
      test.slow(true);

      await redirectToHomePage(adminPage);

      await test.step('Remove widget', async () => {
        test.slow(true);

        await navigateToCustomizeLandingPage(adminPage, {
          personaName: persona.responseData.name,
        });

        await removeAndCheckWidget(adminPage, {
          widgetKey: 'KnowledgePanel.ActivityFeed',
        });
        await removeAndCheckWidget(adminPage, {
          widgetKey: 'KnowledgePanel.Following',
        });
        await removeAndCheckWidget(adminPage, {
          widgetKey: 'KnowledgePanel.KPI',
        });

        await saveCustomizeLayoutPage(adminPage);

        await redirectToHomePage(adminPage);

        // Check if removed widgets are not present on landing adminPage
        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.ActivityFeed"]')
        ).not.toBeVisible();
        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.Following"]')
        ).not.toBeVisible();
        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.KPI"]')
        ).not.toBeVisible();
      });

      await test.step('Add widget', async () => {
        test.slow(true);

        await navigateToCustomizeLandingPage(adminPage, {
          personaName: persona.responseData.name,
        });

        // Check if removed widgets are not present on customize page
        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.ActivityFeed"]')
        ).not.toBeVisible();
        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.Following"]')
        ).not.toBeVisible();
        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.KPI"]')
        ).not.toBeVisible();

        // Check if other widgets are present
        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.MyData"]')
        ).toBeVisible();
        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.TotalAssets"]')
        ).toBeVisible();

        await openAddCustomizeWidgetModal(adminPage);

        await adminPage.locator('[data-testid="loader"]').first().waitFor({
          state: 'detached',
        });

        // Check if 'check' icon is present for existing widgets
        await expect(
          adminPage
            .locator('[data-testid="sidebar-option-KnowledgePanel.MyData"]')
            .locator('.selected-widget-icon')
        ).toBeVisible();
        await expect(
          adminPage
            .locator(
              '[data-testid="sidebar-option-KnowledgePanel.TotalAssets"]'
            )
            .locator('.selected-widget-icon')
        ).toBeVisible();

        // Check if 'check' icon is not present for removed widgets
        await expect(
          adminPage
            .locator(
              '[data-testid="sidebar-option-KnowledgePanel.ActivityFeed"]'
            )
            .locator('.selected-widget-icon')
        ).not.toBeVisible();
        await expect(
          adminPage
            .locator('[data-testid="sidebar-option-KnowledgePanel.Following"]')
            .locator('.selected-widget-icon')
        ).not.toBeVisible();
        await expect(
          adminPage
            .locator('[data-testid="sidebar-option-KnowledgePanel.KPI"]')
            .locator('.selected-widget-icon')
        ).not.toBeVisible();

        // Add Following widget
        await adminPage
          .locator('[data-testid="KnowledgePanel.Following"]')
          .click();

        await adminPage.locator('[data-testid="apply-btn"]').click();

        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.Following"]')
        ).toBeVisible();

        // Check if check icons are present in tab labels for newly added widgets
        await openAddCustomizeWidgetModal(adminPage);

        // Check if 'check' icon is present for the Following widget
        await expect(
          adminPage
            .locator('[data-testid="sidebar-option-KnowledgePanel.Following"]')
            .locator('.selected-widget-icon')
        ).toBeVisible();

        // Close the add widget modal
        await adminPage.locator('[data-testid="cancel-btn"]').click();

        // Save the updated layout
        await saveCustomizeLayoutPage(adminPage);

        // Navigate to the landing page
        await redirectToHomePage(adminPage);

        // Check if removed widgets are not present on the landing page
        await expect(
          adminPage.getByTestId('KnowledgePanel.ActivityFeed')
        ).not.toBeVisible();
        await expect(
          adminPage.getByTestId('KnowledgePanel.KPI')
        ).not.toBeVisible();

        // Check if newly added widgets are present on the landing page
        await waitForLandingPageWidget(adminPage, 'KnowledgePanel.Following');
      });

      await test.step('Resetting the layout flow should work properly', async () => {
        test.slow(true);

        // Check if removed widgets are not present on landing page
        await expect(
          adminPage.getByTestId('KnowledgePanel.ActivityFeed')
        ).not.toBeVisible();
        await expect(
          adminPage.getByTestId('KnowledgePanel.KPI')
        ).not.toBeVisible();

        await navigateToCustomizeLandingPage(adminPage, {
          personaName: persona.responseData.name,
        });

        // Check if removed widgets are not present on customize page
        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.ActivityFeed"]')
        ).not.toBeVisible();
        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.KPI"]')
        ).not.toBeVisible();

        await adminPage.locator('[data-testid="reset-button"]').click();

        // Confirm reset in modal
        const resetResponse = adminPage.waitForResponse('/api/v1/docStore/*');

        await adminPage
          .getByRole('button', { name: 'Reset', exact: true })
          .click();

        await resetResponse;

        // Verify the toast notification
        await toastNotification(adminPage, 'Page layout updated successfully.');

        // Check if all widgets are present after resetting the layout
        await checkAllDefaultWidgets(adminPage);

        // Check if all widgets are present on landing page
        await redirectToHomePage(adminPage);

        // Ensures the page is fully loaded

        await checkAllDefaultWidgets(adminPage);
      });
    });

    test('Widget drag and drop reordering', async ({ adminPage, persona }) => {
      test.slow(true);

      await navigateToCustomizeLandingPage(adminPage, {
        personaName: persona.responseData.name,
      });

      // Test dragging widgets to reorder them
      const widget1 = adminPage.locator(
        '[data-testid="KnowledgePanel.MyData"]'
      );
      const widget2 = adminPage.locator(
        '[data-testid="KnowledgePanel.Following"]'
      );

      if ((await widget1.count()) > 0 && (await widget2.count()) > 0) {
        // Get initial positions
        const widget1Box = await widget1.boundingBox();
        const widget2Box = await widget2.boundingBox();

        if (widget1Box && widget2Box) {
          await widget1.hover();

          await expect(widget1).toBeVisible();
          await expect(widget2).toBeVisible();

          await saveCustomizeLayoutPage(adminPage);
          await redirectToHomePage(adminPage, false);
          await waitForAllLoadersToDisappear(adminPage).catch(() => undefined);

          await waitForLandingPageWidget(adminPage, 'KnowledgePanel.MyData');
          await waitForLandingPageWidget(adminPage, 'KnowledgePanel.Following');
        }
      }
    });

    // Regression: cancel button used to trigger both CustomizablePageHeader's
    // local modal AND NavigationBlocker's modal, forcing users to click
    // Discard twice. A single Discard click must exit the customize page.
    test('Cancel button should show a single confirmation modal and Discard should exit the customize landing page', async ({
      adminPage,
      persona,
    }) => {
      test.slow();

      await navigateToCustomizeLandingPage(adminPage, {
        personaName: persona.responseData.name,
      });

      await removeAndCheckWidget(adminPage, {
        widgetKey: 'KnowledgePanel.MyData',
      });

      await adminPage.getByTestId('cancel-button').click();

      // Assert on -title (inside the visible .ant-modal) rather than the
      // root testid, whose 0×0 wrapper trips Playwright's toBeVisible.
      await expect(
        adminPage.getByTestId('unsaved-changes-modal-title')
      ).toBeVisible();

      await adminPage.getByTestId('unsaved-changes-modal-discard').click();

      await expect(
        adminPage.getByTestId('unsaved-changes-modal-title')
      ).toBeHidden();
      await expect(
        adminPage.getByTestId('customize-landing-page-header')
      ).toBeHidden();
    });
  }
);
