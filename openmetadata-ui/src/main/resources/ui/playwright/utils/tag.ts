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
import { expect, Page } from '@playwright/test';
import { SidebarItem } from '../constant/sidebar';
import {
  NAME_MIN_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
  redirectToHomePage,
} from './common';
import { sidebarClick } from './sidebar';

export const TAG_INVALID_NAMES = {
  MIN_LENGTH: 'c',
  MAX_LENGTH:
    'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890aba87439625b1c2d3e4f5061728394a5',
  WITH_SPECIAL_CHARS: '!@#$%^&*()',
};

export const visitClassificationPage = async (
  page: Page,
  classificationName: string
) => {
  await redirectToHomePage(page);
  const classificationResponse = page.waitForResponse(
    '/api/v1/classifications?**'
  );
  await sidebarClick(page, SidebarItem.TAGS);
  await classificationResponse;
  await page.getByRole('menuitem', { name: classificationName }).click();
};

export async function submitForm(page: Page) {
  await page.locator('button[type="submit"]').scrollIntoViewIfNeeded();
  await page.locator('button[type="submit"]').click();
}

export async function validateForm(page: Page) {
  // submit form without any data to trigger validation
  await submitForm(page);

  // error messages
  await expect(page.locator('#tags_name_help')).toBeVisible();
  await expect(page.locator('#tags_name_help')).toContainText(
    'Name is required'
  );

  await expect(page.locator('#tags_description_help')).toBeVisible();
  await expect(page.locator('#tags_description_help')).toContainText(
    'Description is required'
  );

  // validation should work for invalid names

  // min length validation
  await page.locator('[data-testid="name"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid="name"]').clear();
  await page.locator('[data-testid="name"]').fill(TAG_INVALID_NAMES.MIN_LENGTH);
  await page.waitForLoadState('domcontentloaded');

  await expect(
    page.getByText(NAME_MIN_MAX_LENGTH_VALIDATION_ERROR)
  ).toBeVisible();

  // max length validation
  await page.locator('[data-testid="name"]').clear();
  await page.locator('[data-testid="name"]').fill(TAG_INVALID_NAMES.MAX_LENGTH);
  await page.waitForLoadState('domcontentloaded');

  await expect(
    page.getByText(NAME_MIN_MAX_LENGTH_VALIDATION_ERROR)
  ).toBeVisible();

  // with special char validation
  await page.locator('[data-testid="name"]').clear();
  await page
    .locator('[data-testid="name"]')
    .fill(TAG_INVALID_NAMES.WITH_SPECIAL_CHARS);
  await page.waitForLoadState('domcontentloaded');

  await expect(page.getByText(NAME_VALIDATION_ERROR)).toBeVisible();
}
