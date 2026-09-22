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
  await expect(async () => {
    if ((await control.getAttribute('aria-expanded')) !== 'true') {
      await open();
    }

    const listboxId = await control.getAttribute('aria-controls');
    if (!listboxId) {
      throw new Error('Destination popup did not expose aria-controls');
    }

    // Destination selection replaces its RHF object, which can remount the
    // React Aria popup during a click. Re-resolving the popup on each retry
    // also prevents options from another open destination being selected.
    await page
      .locator(`[role="listbox"][id="${listboxId}"]`)
      .getByRole('option', { exact: true, name: optionName })
      .click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });

  // A remounted control can leave its previous portal open even after the
  // selection lands. Moving focus out prevents that popup polluting the next
  // destination interaction without sending Escape to the surrounding form.
  await control.blur().catch(() => undefined);
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
  await selectOwnedOption({
    control: input,
    open: async () => {
      await input.fill('');
      await input.press('ArrowDown');
    },
    optionName,
    page,
  });
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
