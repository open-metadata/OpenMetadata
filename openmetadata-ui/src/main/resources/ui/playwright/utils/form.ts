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
import { Page } from '@playwright/test';

export const validateFormNameFieldInput = async ({
  page,
  fieldSelector = '#name',
  checkEmpty = true,
  checkLong = true,
  fieldName,
  value,
}: {
  page: Page;
  value: string;
  fieldName: string;
  errorDivSelector: string;
  fieldSelector?: string;
  checkEmpty?: boolean;
  checkLong?: boolean;
}) => {
  if (checkEmpty) {
    // Check empty name field message
    await page.fill(fieldSelector, 'test');
    await page.fill(fieldSelector, '');

    await page.getByText(`${fieldName} is required`).isVisible();
  }

  if (checkLong) {
    // Check long name field message
    await page.fill(fieldSelector, 'name'.repeat(33));

    await page
      .getByText(`${fieldName} size must be between 1 and 128`)
      .isVisible();

    await page.fill(fieldSelector, '');
  }

  await page.fill(fieldSelector, value);
};
