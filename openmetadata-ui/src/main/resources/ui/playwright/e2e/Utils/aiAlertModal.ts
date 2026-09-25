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

import { expect, Locator, Page } from '@playwright/test';
import {
  scrollIntoViewAndSettle,
  selectOptionWithRetry,
} from '../../utils/common';

const readOptions = async (listbox: Locator) => {
  const options = listbox.getByRole('option');
  await expect(options).not.toHaveCount(0);

  return (await options.allInnerTexts()).map((text) => text.trim());
};

/** A focused combobox does not always reopen on click; ArrowDown opens it. */
const openCombobox = async (combobox: Locator) => {
  await combobox.click();
  await combobox.press('ArrowDown');
};

/**
 * Opens a combobox and reads only the listbox it controls, ignoring any other open popover.
 * A focused combobox does not always reopen on click, so retry the open until it is expanded.
 */
const openComboboxOptions = async (page: Page, combobox: Locator) => {
  await scrollIntoViewAndSettle(combobox);
  await expect(async () => {
    if ((await combobox.getAttribute('aria-expanded')) !== 'true') {
      await openCombobox(combobox);
    }
    await expect(combobox).toHaveAttribute('aria-expanded', 'true', {
      timeout: 2_000,
    });
  }).toPass({ timeout: 10_000 });
  const listboxId = await combobox.getAttribute('aria-controls');

  return readOptions(page.locator(`[id="${listboxId}"]`));
};

/** Opens a core Select; like the combobox, a first click can land before the trigger is ready. */
const openSelect = async (select: Locator) => {
  const trigger = select.getByRole('button');
  await scrollIntoViewAndSettle(trigger);
  await expect(async () => {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click();
    }
    await expect(trigger).toHaveAttribute('aria-expanded', 'true', {
      timeout: 2_000,
    });
  }).toPass({ timeout: 10_000 });
};

/**
 * Closes an open popover without Escape, which would also close the modal, by clicking
 * the modal subtitle: static header text, identical in add and edit mode.
 */
export const dismissPopover = async (dialog: Locator) => {
  await dialog
    .getByText('Stay current with timely alerts using webhooks.')
    .click();
};

export const openAddAlertModal = async (page: Page) => {
  await page.getByTestId('add-alert-button').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  return dialog;
};

export const fillAlertName = async (dialog: Locator, name: string) => {
  await dialog.getByTestId('alert-name-input').getByRole('textbox').fill(name);
};

export const selectAlertSource = async (page: Page, source: string) => {
  await selectOptionWithRetry(
    page.getByTestId('source-select').getByRole('button'),
    page.getByRole('option', { name: source, exact: true })
  );
};

export const getDestinationCategoryOptions = async (
  page: Page,
  dialog: Locator,
  index = 0
) => {
  const combobox = dialog
    .getByTestId(`destination-category-select-${index}`)
    .getByRole('combobox');
  const options = await openComboboxOptions(page, combobox);
  await dismissPopover(dialog);

  return options;
};

export const selectDestinationCategory = async (
  page: Page,
  dialog: Locator,
  category: string,
  index = 0
) => {
  const combobox = dialog
    .getByTestId(`destination-category-select-${index}`)
    .getByRole('combobox');

  await selectOptionWithRetry(
    combobox,
    page
      .getByRole('listbox', { name: /Destination/ })
      .getByRole('option', { name: category, exact: true }),
    () => openCombobox(combobox)
  );
};

export const addFilter = async (
  page: Page,
  dialog: Locator,
  filter: string,
  index = 0
) => {
  await dialog.getByTestId('add-filters').click();
  await selectOptionWithRetry(
    dialog.getByTestId(`filters-select-${index}`).getByRole('button'),
    page.getByRole('option', { name: filter, exact: true })
  );
};

export const getFilterSelectOptions = async (
  page: Page,
  dialog: Locator,
  index = 0
) => {
  await openSelect(dialog.getByTestId(`filters-select-${index}`));
  const options = await readOptions(
    page.getByRole('listbox', { name: 'Filter' })
  );
  await dismissPopover(dialog);

  return options;
};

/** Opens the argument picker of a filter row, e.g. the Event Type list. */
export const getFilterArgumentOptions = async (
  page: Page,
  dialog: Locator,
  index = 0
) => {
  return openComboboxOptions(
    page,
    dialog.getByTestId(`filters-${index}`).getByRole('combobox')
  );
};

export const saveAlertModal = async (page: Page, dialog: Locator) => {
  const saveRequest = page.waitForRequest(
    (request) =>
      /\/api\/v1\/events\/subscriptions(\/[^/]+)?$/.test(
        new URL(request.url()).pathname
      ) && ['POST', 'PATCH'].includes(request.method())
  );
  await dialog.getByTestId('save-button').click();
  const request = await saveRequest;
  const response = await request.response();

  return { request, response };
};

export const addDestination = async (
  page: Page,
  dialog: Locator,
  category: string,
  index: number
) => {
  await dialog.getByTestId('add-destination-button').click();
  await selectDestinationCategory(page, dialog, category, index);
};

export const selectInternalDestinationType = async (
  page: Page,
  dialog: Locator,
  type: string,
  index: number
) => {
  await selectOptionWithRetry(
    dialog.getByTestId(`destination-type-select-${index}`).getByRole('button'),
    page
      .getByRole('listbox', { name: 'Type' })
      .getByRole('option', { name: type, exact: true })
  );
};

/** Picks a team or user receiver by search text; the option test id carries its FQN. */
export const selectTeamOrUserReceiver = async (
  page: Page,
  dialog: Locator,
  { index, search, fqn }: { index: number; search: string; fqn: string }
) => {
  await dialog.getByTestId(`team-user-select-trigger-${index}`).click();
  const searchResponse = page.waitForResponse('/api/v1/search/query?q=*');
  await page
    .getByTestId(`team-user-search-input-${index}`)
    .getByRole('textbox')
    .fill(search);
  await searchResponse;
  await page.getByTestId(`team-user-option-${fqn}`).click();
  await dismissPopover(dialog);
};

export const addEmailReceiver = async (
  dialog: Locator,
  index: number,
  email: string
) => {
  const input = dialog.getByTestId(`email-input-${index}`).getByRole('textbox');
  await input.fill(email);
  await input.press('Enter');
  await expect(dialog.getByTestId(`email-tag-${email}`)).toBeVisible();
};

export const fillEndpoint = async (
  dialog: Locator,
  index: number,
  endpoint: string
) => {
  await dialog
    .getByTestId(`endpoint-input-${index}`)
    .getByRole('textbox')
    .fill(endpoint);
};

export const selectWebhookAuthType = async (
  page: Page,
  dialog: Locator,
  index: number,
  label: string
) => {
  await dialog
    .getByTestId(`destination-${index}`)
    .getByText('Advanced Configuration')
    .click();
  await selectOptionWithRetry(
    dialog.getByTestId(`auth-type-select-${index}`).getByRole('button'),
    page.getByRole('option', { name: label, exact: true })
  );
};

export const fillDestinationInput = async (
  dialog: Locator,
  testId: string,
  value: string
) => {
  // Password inputs have no textbox role, so target the input element itself.
  await dialog.getByTestId(testId).locator('input').fill(value);
};
