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
import { expect, Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../constant/config';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { performAdminLogin } from '../../utils/admin';
import { toastNotification, uuid } from '../../utils/common';
import {
  createCustomPropertyForEntity,
  CustomPropertyTypeByName,
  removeCustomPropertyViaApi,
} from '../../utils/customProperty';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  clickUntilVisible,
  waitForAntOverlayToOpen,
  waitForAriaOverlayToSettle,
} from '../../utils/waitHelpers';
import { test } from '../fixtures/pages';

interface PersonaFixture {
  persona: PersonaClass;
  propertyNames: string[];
}

/**
 * Creates a persona and Table custom properties of `propertyTypes` for the
 * tests of the enclosing describe, and removes them afterwards. Under
 * fullyParallel the hooks run again for every test, even in the same worker,
 * so each run builds a fresh persona and name list instead of reusing the
 * previous run's: its names are unique, and the create never conflicts.
 */
const setupPersonaFixture = (
  propertyTypes: CustomPropertyTypeByName[]
): PersonaFixture => {
  const fixture: PersonaFixture = {
    persona: new PersonaClass(),
    propertyNames: [],
  };

  test.beforeAll('Setup persona and properties', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    fixture.persona = new PersonaClass();
    await fixture.persona.create(apiContext);
    const { customProperties } = await createCustomPropertyForEntity(
      apiContext,
      EntityTypeEndpoint.Table,
      propertyTypes
    );
    fixture.propertyNames = Object.values(customProperties).map(
      ({ property }) => property.name
    );
    await afterAction();
  });

  test.afterAll('Cleanup persona and properties', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    for (const name of fixture.propertyNames) {
      await removeCustomPropertyViaApi(apiContext, 'table', name);
    }
    await fixture.persona.delete(apiContext);
    await afterAction();
  });

  return fixture;
};

const openTableCustomizePage = async (page: Page, persona: PersonaClass) => {
  await page.goto(
    `/customize-page/${encodeURIComponent(
      persona.responseData.fullyQualifiedName ?? persona.data.name
    )}/Table`
  );
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('customize-tab-card')).toBeVisible();
};

const openTabForEditing = async (page: Page, tabTestId: string) => {
  await page.getByTestId('customize-tab-card').getByTestId(tabTestId).click();
  await page.getByRole('menuitem', { name: 'Edit Widgets' }).click();
};

const savePageLayout = async (page: Page) => {
  await page.getByTestId('save-button').click();
  await toastNotification(
    page,
    /^Page layout (created|updated) successfully\.$/
  );
};

const sizeTab = (page: Page, propertyName: string, label: 'Small' | 'Large') =>
  page
    .getByTestId(`layout-item-${propertyName}-size`)
    .getByRole('tab', { name: label });

test.describe(
  'Custom Properties persona widget',
  { tag: [DOMAIN_TAGS.PLATFORM] },
  () => {
    test.describe('Custom Properties widget', () => {
      const fixture = setupPersonaFixture([
        CustomPropertyTypeByName.STRING,
        CustomPropertyTypeByName.INTEGER,
      ]);

      test('adds a full-width widget and arranges its cards in place', async ({
        page,
      }) => {
        test.slow();

        const [firstProperty, secondProperty] = fixture.propertyNames;
        const tabName = `CP Widgets ${uuid()}`;

        await test.step('add a tab with a widget placeholder', async () => {
          await openTableCustomizePage(page, fixture.persona);
          await page.getByRole('button', { name: 'Add tab' }).click();

          const addTabDialog = page.getByRole('dialog', { name: 'Add Tab' });
          await waitForAntOverlayToOpen(addTabDialog);
          await addTabDialog.getByTestId('add-tab-input').fill(tabName);
          await addTabDialog
            .getByRole('button', { name: 'Add', exact: true })
            .click();

          await expect(addTabDialog).not.toBeAttached();
          await expect(page.getByTestId(`tab-${tabName}`)).toBeVisible();
        });

        await test.step('pick style and properties in the Add Widget dialog', async () => {
          const dialog = page.getByTestId('add-widget-modal');

          // Closing the add-tab modal re-measures the grid, shifting the placeholder.
          await clickUntilVisible(
            page
              .getByTestId('ExtraWidget.EmptyWidgetPlaceholder')
              .getByTestId('add-widget-button'),
            dialog
          );
          await waitForAriaOverlayToSettle(page);
          await dialog.getByTestId('Custom Properties-widget').click();

          await expect(dialog.getByTestId('add-widget-button')).toBeDisabled();
          await expect(
            dialog.getByTestId('custom-property-picker-search')
          ).toBeDisabled();

          await dialog.getByTestId('widget-style-fullWidth').click();

          await expect(
            dialog.getByTestId('picker-tab-selected')
          ).toHaveAttribute('aria-selected', 'true');

          await dialog.getByTestId('picker-tab-all').click();

          for (const name of fixture.propertyNames) {
            await expect(
              dialog
                .getByTestId(`custom-property-checkbox-${name}`)
                .getByRole('checkbox')
            ).toBeChecked();
          }

          await dialog.getByTestId('picker-tab-selected').click();
          await dialog.getByTestId('picker-clear').click();

          await expect(dialog.getByTestId('add-widget-button')).toBeDisabled();

          for (const name of fixture.propertyNames) {
            await dialog
              .getByTestId('custom-property-picker-search')
              .fill(name);
            await dialog
              .getByTestId(`custom-property-checkbox-${name}`)
              .click();

            await expect(
              dialog
                .getByTestId(`custom-property-checkbox-${name}`)
                .getByRole('checkbox')
            ).toBeChecked();
          }

          await expect(dialog.getByTestId('add-widget-summary')).toContainText(
            '2 properties · Full width'
          );

          await dialog.getByTestId('add-widget-button').click();

          await expect(dialog).toBeHidden();
        });

        await test.step('switch a card to small and reorder in place', async () => {
          const editor = page.getByTestId('custom-properties-widget-editor');

          await expect(
            editor.getByTestId(`layout-item-${firstProperty}`)
          ).toBeVisible();
          await expect(
            page.getByTestId('custom-properties-widget-style')
          ).toHaveText('Full width');

          await sizeTab(page, firstProperty, 'Small').click();

          await expect(sizeTab(page, firstProperty, 'Small')).toHaveAttribute(
            'aria-selected',
            'true'
          );

          await page
            .getByTestId(`layout-item-${secondProperty}-handle`)
            .dragTo(page.getByTestId(`layout-item-${firstProperty}`), {
              targetPosition: { x: 8, y: 8 },
            });

          await expect
            .poll(() =>
              editor
                .getByTestId('custom-property-layout-editor')
                .evaluate((list) =>
                  Array.from(list.children).map((item) =>
                    item.getAttribute('data-testid')
                  )
                )
            )
            .toEqual([
              `layout-item-${secondProperty}`,
              `layout-item-${firstProperty}`,
            ]);

          await savePageLayout(page);
        });

        await test.step('keeps the arrangement after reload', async () => {
          await openTableCustomizePage(page, fixture.persona);
          await openTabForEditing(page, `tab-${tabName}`);

          await expect(sizeTab(page, firstProperty, 'Small')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          await expect(sizeTab(page, secondProperty, 'Large')).toHaveAttribute(
            'aria-selected',
            'true'
          );
        });

        await test.step('keeps the small card after a style round trip in the gear modal', async () => {
          await page.getByTestId('widget-settings-button').click();
          const modal = page.getByTestId(
            'custom-properties-widget-settings-modal'
          );
          await expect(modal).toBeVisible();

          // fullWidth -> preview -> fullWidth must not flatten the half-width card.
          await modal.getByTestId('widget-style-preview').click();
          await modal.getByTestId('widget-style-fullWidth').click();
          await modal.getByTestId('save-widget-settings').click();

          await expect(modal).toBeHidden();
          await expect(sizeTab(page, firstProperty, 'Small')).toHaveAttribute(
            'aria-selected',
            'true'
          );
        });

        await test.step('persists the small card across a saved style round trip', async () => {
          // Save in preview (a real change the page save can persist), reload,
          // then switch back to full width and save again: the half-width card
          // must survive both saves.
          await page.getByTestId('widget-settings-button').click();
          let modal = page.getByTestId(
            'custom-properties-widget-settings-modal'
          );
          await expect(modal).toBeVisible();
          await modal.getByTestId('widget-style-preview').click();
          await modal.getByTestId('save-widget-settings').click();
          await expect(modal).toBeHidden();
          await savePageLayout(page);

          await openTableCustomizePage(page, fixture.persona);
          await openTabForEditing(page, `tab-${tabName}`);

          await page.getByTestId('widget-settings-button').click();
          modal = page.getByTestId('custom-properties-widget-settings-modal');
          await expect(modal).toBeVisible();
          await modal.getByTestId('widget-style-fullWidth').click();
          await modal.getByTestId('save-widget-settings').click();
          await expect(modal).toBeHidden();
          await savePageLayout(page);

          await openTableCustomizePage(page, fixture.persona);
          await openTabForEditing(page, `tab-${tabName}`);

          await expect(sizeTab(page, firstProperty, 'Small')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          await expect(sizeTab(page, secondProperty, 'Large')).toHaveAttribute(
            'aria-selected',
            'true'
          );
        });
      });
    });

    test.describe('Custom Properties tab', () => {
      const fixture = setupPersonaFixture([CustomPropertyTypeByName.INTEGER]);

      test('resizes cards of the Custom Properties tab', async ({ page }) => {
        test.slow();

        const [property] = fixture.propertyNames;

        await test.step('switch a card to large', async () => {
          await openTableCustomizePage(page, fixture.persona);
          await openTabForEditing(page, 'tab-custom_properties');

          await expect(
            page.getByTestId('custom-property-layout-editor')
          ).toBeVisible();
          await expect(sizeTab(page, property, 'Small')).toHaveAttribute(
            'aria-selected',
            'true'
          );

          await sizeTab(page, property, 'Large').click();

          await expect(sizeTab(page, property, 'Large')).toHaveAttribute(
            'aria-selected',
            'true'
          );

          await savePageLayout(page);
        });

        await test.step('keeps the size after reload', async () => {
          await openTableCustomizePage(page, fixture.persona);
          await openTabForEditing(page, 'tab-custom_properties');

          await expect(sizeTab(page, property, 'Large')).toHaveAttribute(
            'aria-selected',
            'true'
          );
        });
      });
    });
  }
);
