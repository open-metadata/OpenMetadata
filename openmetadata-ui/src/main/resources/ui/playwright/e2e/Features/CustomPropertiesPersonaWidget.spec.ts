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
import { test } from '../fixtures/pages';

// One persona per test: tests run in parallel and each saves the persona's
// whole Table page layout.
const widgetPersona = new PersonaClass();
const tabPersona = new PersonaClass();
const propertyNames: string[] = [];

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
    test.beforeAll('Setup persona and properties', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await widgetPersona.create(apiContext);
      await tabPersona.create(apiContext);
      const { customProperties } = await createCustomPropertyForEntity(
        apiContext,
        EntityTypeEndpoint.Table,
        [CustomPropertyTypeByName.STRING, CustomPropertyTypeByName.INTEGER]
      );
      propertyNames.push(
        ...Object.values(customProperties).map(({ property }) => property.name)
      );
      await afterAction();
    });

    test.afterAll('Cleanup persona and properties', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      for (const name of propertyNames) {
        await removeCustomPropertyViaApi(apiContext, 'table', name);
      }
      await widgetPersona.delete(apiContext);
      await tabPersona.delete(apiContext);
      await afterAction();
    });

    test('adds a full-width widget and arranges its cards in place', async ({
      page,
    }) => {
      test.slow();

      const [firstProperty, secondProperty] = propertyNames;
      const tabName = `CP Widgets ${uuid()}`;

      await test.step('add a tab with a widget placeholder', async () => {
        await openTableCustomizePage(page, widgetPersona);
        await page.getByRole('button', { name: 'Add tab' }).click();
        await page.getByTestId('add-tab-input').fill(tabName);
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Add', exact: true })
          .click();

        await expect(page.getByTestId(`tab-${tabName}`)).toBeVisible();
      });

      await test.step('pick style and properties in the Add Widget dialog', async () => {
        await page
          .getByTestId('ExtraWidget.EmptyWidgetPlaceholder')
          .getByTestId('add-widget-button')
          .click();

        const dialog = page.getByTestId('add-widget-modal');
        await dialog.getByTestId('Custom Properties-widget').click();

        await expect(dialog.getByTestId('add-widget-button')).toBeDisabled();
        await expect(
          dialog.getByTestId('custom-property-picker-search')
        ).toBeDisabled();

        await dialog.getByTestId('widget-style-fullWidth').click();

        await expect(dialog.getByTestId('picker-tab-selected')).toHaveAttribute(
          'aria-selected',
          'true'
        );

        await dialog.getByTestId('picker-tab-all').click();

        for (const name of propertyNames) {
          await expect(
            dialog
              .getByTestId(`custom-property-checkbox-${name}`)
              .getByRole('checkbox')
          ).toBeChecked();
        }

        await dialog.getByTestId('picker-tab-selected').click();
        await dialog.getByTestId('picker-clear').click();

        await expect(dialog.getByTestId('add-widget-button')).toBeDisabled();

        for (const name of propertyNames) {
          await dialog.getByTestId('custom-property-picker-search').fill(name);
          await dialog.getByTestId(`custom-property-checkbox-${name}`).click();

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
        await openTableCustomizePage(page, widgetPersona);
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

    test('resizes cards of the Custom Properties tab', async ({ page }) => {
      test.slow();

      const [property] = propertyNames;

      await test.step('switch a card to large', async () => {
        await openTableCustomizePage(page, tabPersona);
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
        await openTableCustomizePage(page, tabPersona);
        await openTabForEditing(page, 'tab-custom_properties');

        await expect(sizeTab(page, property, 'Large')).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
    });
  }
);
