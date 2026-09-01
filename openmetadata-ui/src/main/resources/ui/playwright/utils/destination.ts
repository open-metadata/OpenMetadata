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

import { expect, Locator, Page } from '@playwright/test';

export const selectComboBoxOption = async ({
  page,
  testId,
  optionName,
}: {
  page: Page;
  testId: string;
  optionName: string;
}) => {
  const input = page.getByTestId(testId).getByRole('combobox');
  await expect(input).toBeVisible();
  await input.click();

  const option = page.getByRole('option', {
    exact: true,
    name: optionName,
  });
  await expect(option).toBeVisible();
  await option.click();
  await expect(input).toHaveValue(optionName);
};

export const selectDropdownOption = async ({
  page,
  testId,
  optionName,
}: {
  page: Page;
  testId: string;
  optionName: string;
}) => {
  const trigger = page.getByTestId(testId).getByRole('button');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const option = page.getByRole('option', {
    exact: true,
    name: optionName,
  });
  await expect(option).toBeVisible();
  await option.click();
  await expect(trigger).toContainText(optionName);
};

export const ensureAccordionExpanded = async (
  container: Locator,
  accessibleName: string
) => {
  const trigger = container.getByRole('button', {
    exact: true,
    name: accessibleName,
  });
  await expect(trigger).toBeVisible();

  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click();
  }

  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
};
