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

/**
 * PR-side custom property suite. Runs the per-entity CRUD describe for Table
 * only (other-entity CRUD is identical UI plumbing and runs in
 * stress/CustomPropertiesAllEntities.spec.ts instead). Also keeps the
 * entity-independent name-validation describe on PR — small (~5 min) and
 * worth gating PR on.
 */

import { expect, test } from '@playwright/test';
import {
  CP_NAME_MAX_LENGTH_VALIDATION_ERROR,
  INVALID_NAMES,
} from '../../constant/common';
import {
  CUSTOM_PROPERTY_INVALID_NAMES,
  CUSTOM_PROPERTY_NAME_VALIDATION_ERROR,
} from '../../constant/customProperty';
import { GlobalSettingOptions } from '../../constant/settings';
import {
  ALL_ENTITIES,
  registerCustomPropertiesEntityTests,
} from '../../shared/customPropertiesEntityTests';
import { redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

registerCustomPropertiesEntityTests(
  ALL_ENTITIES.filter((e) => e.key === 'entity_table')
);

test.describe('Custom property name validation', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.TABLES, true);
    await page.click('[data-testid="add-field-button"]');
  });

  const nameInput = '[data-testid="name"] input';
  const nameError = '#name_help';

  test('should show error when name starts with a non-alphanumeric character', async ({
    page,
  }) => {
    await page.fill(
      nameInput,
      CUSTOM_PROPERTY_INVALID_NAMES.STARTS_WITH_SPECIAL_CHAR
    );

    await expect(page.locator(nameError)).toContainText(
      CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
    );
  });

  test('should show error when name contains a colon', async ({ page }) => {
    await page.fill(nameInput, CUSTOM_PROPERTY_INVALID_NAMES.DISALLOWED_COLON);

    await expect(page.locator(nameError)).toContainText(
      CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
    );
  });

  test('should show error when name contains a dollar sign', async ({
    page,
  }) => {
    await page.fill(nameInput, CUSTOM_PROPERTY_INVALID_NAMES.DISALLOWED_DOLLAR);

    await expect(page.locator(nameError)).toContainText(
      CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
    );
  });

  test('should show error when name contains a caret', async ({ page }) => {
    await page.fill(nameInput, CUSTOM_PROPERTY_INVALID_NAMES.DISALLOWED_CARET);

    await expect(page.locator(nameError)).toContainText(
      CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
    );
  });

  test('should show error when name contains a double quote', async ({
    page,
  }) => {
    await page.fill(nameInput, CUSTOM_PROPERTY_INVALID_NAMES.DISALLOWED_QUOTE);

    await expect(page.locator(nameError)).toContainText(
      CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
    );
  });

  test('should show error when name contains a backslash', async ({ page }) => {
    await page.fill(
      nameInput,
      CUSTOM_PROPERTY_INVALID_NAMES.DISALLOWED_BACKSLASH
    );

    await expect(page.locator(nameError)).toContainText(
      CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
    );
  });

  test('should show error when name contains a less-than sign', async ({
    page,
  }) => {
    await page.fill(
      nameInput,
      CUSTOM_PROPERTY_INVALID_NAMES.DISALLOWED_LESS_THAN
    );

    await expect(page.locator(nameError)).toContainText(
      CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
    );
  });

  test('should show error when name contains a greater-than sign', async ({
    page,
  }) => {
    await page.fill(
      nameInput,
      CUSTOM_PROPERTY_INVALID_NAMES.DISALLOWED_GREATER_THAN
    );

    await expect(page.locator(nameError)).toContainText(
      CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
    );
  });

  test('should show error when name contains an ampersand', async ({
    page,
  }) => {
    await page.fill(
      nameInput,
      CUSTOM_PROPERTY_INVALID_NAMES.DISALLOWED_AMPERSAND
    );

    await expect(page.locator(nameError)).toContainText(
      CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
    );
  });

  test('should show error when name contains an asterisk', async ({ page }) => {
    await page.fill(
      nameInput,
      CUSTOM_PROPERTY_INVALID_NAMES.DISALLOWED_ASTERISK
    );

    await expect(page.locator(nameError)).toContainText(
      CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
    );
  });

  test('should show error when name contains a forward slash', async ({
    page,
  }) => {
    await page.fill(
      nameInput,
      CUSTOM_PROPERTY_INVALID_NAMES.DISALLOWED_FORWARD_SLASH
    );

    await expect(page.locator(nameError)).toContainText(
      CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
    );
  });

  test('should show error when name contains a tilde', async ({ page }) => {
    await page.fill(nameInput, CUSTOM_PROPERTY_INVALID_NAMES.DISALLOWED_TILDE);

    await expect(page.locator(nameError)).toContainText(
      CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
    );
  });

  test('should accept a valid name starting with a letter', async ({
    page,
  }) => {
    await page.fill(nameInput, 'validName_123');

    await expect(page.locator(nameError)).not.toBeVisible();
  });

  test('should accept a valid name with allowed special characters', async ({
    page,
  }) => {
    await page.fill(nameInput, "valid Name.!@#%`()_-=+{}[]|;',.?");

    await expect(page.locator(nameError)).not.toBeVisible();
  });

  test('should show error when name exceeds 256 characters', async ({
    page,
  }) => {
    await page.fill(
      nameInput,
      `${INVALID_NAMES.MAX_LENGTH}${INVALID_NAMES.MAX_LENGTH}`
    );

    await expect(page.locator(nameError)).toContainText(
      CP_NAME_MAX_LENGTH_VALIDATION_ERROR
    );
  });
});
