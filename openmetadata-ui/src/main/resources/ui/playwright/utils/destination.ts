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

type SelectOwnedOptionArgs = {
  control: Locator;
  open: () => Promise<void>;
  optionName: string;
  page: Page;
};

const selectOwnedOption = async ({
  control,
  open,
  optionName,
  page,
}: SelectOwnedOptionArgs) => {
  await control.scrollIntoViewIfNeeded();
  await control.focus();
  if ((await control.getAttribute('aria-expanded')) !== 'true') {
    await open();
  }
  await expect(control).toHaveAttribute('aria-expanded', 'true');
  const listboxId = await control.getAttribute('aria-controls');
  if (!listboxId) {
    throw new Error('Destination popup did not expose aria-controls');
  }
  await page
    .locator(`[role="listbox"][id="${listboxId}"]`)
    .getByRole('option', { exact: true, name: optionName })
    .click();
};

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
  await input.scrollIntoViewIfNeeded();
  await input.hover();
  await input.fill('');
  await selectOwnedOption({
    control: input,
    open: () => input.press('ArrowDown'),
    optionName,
    page,
  });
  await expect(input).toHaveValue(optionName);
  await input.blur();
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
  await selectOwnedOption({
    control: trigger,
    open: () => trigger.click(),
    optionName,
    page,
  });
  await expect(trigger).toContainText(optionName);
  await trigger.blur();
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
