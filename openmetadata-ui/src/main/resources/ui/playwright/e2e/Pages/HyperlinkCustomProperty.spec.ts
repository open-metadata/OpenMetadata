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
import { expect, test } from '@playwright/test';
import { CUSTOM_PROPERTIES_ENTITIES } from '../../constant/customProperty';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { redirectToHomePage, uuid } from '../../utils/common';
import {
  addCustomPropertiesForEntity,
  deleteCreatedProperty,
  setValueForProperty,
  validateValueForProperty,
} from '../../utils/customProperty';
import { settingClick, SettingOptionsType } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Hyperlink Custom Property Tests', () => {
  const entity = CUSTOM_PROPERTIES_ENTITIES.entity_container;

  test.beforeEach('Visit Home Page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should reject javascript: protocol URLs for XSS protection', async ({
    page,
  }) => {
    const propertyName = `pwhyperlinkxss${uuid()}`;

    await settingClick(page, entity.entityApiType as SettingOptionsType, true);

    await addCustomPropertiesForEntity({
      page,
      propertyName,
      customPropertyData: entity,
      customType: 'Hyperlink',
    });

    try {
      await EntityDataClass.container1.visitEntityPage(page);
      await page.click('[data-testid="custom_properties"]');

      const editButton = page.locator(
        `[data-testid="custom-property-${propertyName}-card"] [data-testid="edit-icon"]`
      );
      await editButton.scrollIntoViewIfNeeded();
      await editButton.click({ force: true });

      await page
        .locator('[data-testid="hyperlink-url-input"]')
        .fill('javascript:alert("XSS")');

      await expect(page.locator('.ant-form-item-explain-error')).toContainText(
        'URL must use http or https protocol'
      );

      await page.locator('[data-testid="inline-cancel-btn"]').click();
    } finally {
      await settingClick(
        page,
        entity.entityApiType as SettingOptionsType,
        true
      );
      await deleteCreatedProperty(page, propertyName);
    }
  });

  test('should accept valid http and https URLs', async ({ page }) => {
    const propertyName = `pwhyperlinkvalid${uuid()}`;

    await settingClick(page, entity.entityApiType as SettingOptionsType, true);

    await addCustomPropertiesForEntity({
      page,
      propertyName,
      customPropertyData: entity,
      customType: 'Hyperlink',
    });

    try {
      await EntityDataClass.container1.visitEntityPage(page);

      await setValueForProperty({
        page,
        propertyName,
        value: 'https://openmetadata.io,OpenMetadata Docs',
        propertyType: 'hyperlink-cp',
        endpoint: EntityTypeEndpoint.Container,
      });

      await validateValueForProperty({
        page,
        propertyName,
        value: 'https://openmetadata.io,OpenMetadata Docs',
        propertyType: 'hyperlink-cp',
      });

      const hyperlinkElement = page
        .locator(`[data-testid="custom-property-${propertyName}-card"]`)
        .getByTestId('hyperlink-value');

      await expect(hyperlinkElement).toHaveAttribute(
        'href',
        'https://openmetadata.io'
      );
      await expect(hyperlinkElement).toHaveAttribute('target', '_blank');
      await expect(hyperlinkElement).toHaveAttribute(
        'rel',
        'noopener noreferrer'
      );
    } finally {
      await settingClick(
        page,
        entity.entityApiType as SettingOptionsType,
        true
      );
      await deleteCreatedProperty(page, propertyName);
    }
  });

  test('should display URL when no display text is provided', async ({
    page,
  }) => {
    const propertyName = `pwhyperlinknotext${uuid()}`;

    await settingClick(page, entity.entityApiType as SettingOptionsType, true);

    await addCustomPropertiesForEntity({
      page,
      propertyName,
      customPropertyData: entity,
      customType: 'Hyperlink',
    });

    try {
      await EntityDataClass.container1.visitEntityPage(page);

      await setValueForProperty({
        page,
        propertyName,
        value: 'https://example.com',
        propertyType: 'hyperlink-cp',
        endpoint: EntityTypeEndpoint.Container,
      });

      await validateValueForProperty({
        page,
        propertyName,
        value: 'https://example.com',
        propertyType: 'hyperlink-cp',
      });
    } finally {
      await settingClick(
        page,
        entity.entityApiType as SettingOptionsType,
        true
      );
      await deleteCreatedProperty(page, propertyName);
    }
  });

  test('should show No Data placeholder when hyperlink has no value', async ({
    page,
  }) => {
    const propertyName = `pwhyperlinkempty${uuid()}`;

    await settingClick(page, entity.entityApiType as SettingOptionsType, true);

    await addCustomPropertiesForEntity({
      page,
      propertyName,
      customPropertyData: entity,
      customType: 'Hyperlink',
    });

    try {
      await EntityDataClass.container1.visitEntityPage(page);
      await page.click('[data-testid="custom_properties"]');

      const containerLocator = page.locator(
        `[data-testid="custom-property-${propertyName}-card"]`
      );

      await expect(containerLocator.getByTestId('no-data')).toBeVisible();
      await expect(containerLocator.getByTestId('no-data')).toContainText(
        'Not set'
      );
    } finally {
      await settingClick(
        page,
        entity.entityApiType as SettingOptionsType,
        true
      );
      await deleteCreatedProperty(page, propertyName);
    }
  });
});
