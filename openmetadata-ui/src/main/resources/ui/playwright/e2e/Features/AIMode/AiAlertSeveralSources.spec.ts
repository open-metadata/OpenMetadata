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

/**
 * AI mode: every alert form takes several sources, as the classic form does. Covers the
 * Observability drawer, the Settings → Notifications drawer and the profile's Notification panel.
 */

import { expect, Locator, Page, test } from '@playwright/test';
import { AlertDetails } from '../../../constant/alert.interface';
import { performAdminLogin } from '../../../utils/admin';
import { watchPerSourceListRequests } from '../../../utils/alert';
import { uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  addInternalDestinationProfile,
  closeSourcePicker,
  inputAlertInformation,
  navigateToAlertsList,
  saveNewAlertAndVerify,
} from '../../../utils/profileNotificationAlert';
import {
  addDestination,
  dismissPopover,
  fillAlertName,
  openAddAlertDrawer,
  saveAlertDrawer,
  selectAlertSource,
  selectInternalDestinationType,
} from '../../Utils/aiAlertDrawer';
import { enableAiAppMode } from '../../Utils/appMode';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const createdAlertIds: string[] = [];

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  for (const id of createdAlertIds) {
    await apiContext.delete(
      `/api/v1/events/subscriptions/${id}?hardDelete=true`
    );
  }

  await afterAction();
});

let expectNoPerSourceList: () => void;

test.beforeEach(({ page }) => {
  expectNoPerSourceList = watchPerSourceListRequests(page);
});

test.afterEach(() => expectNoPerSourceList());

const openAlertsPage = async (page: Page, path: string) => {
  await enableAiAppMode(page);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForAllLoadersToDisappear(page);
};

// A trigger names the sources it applies to once the alert has several.
const addTrigger = async (
  page: Page,
  dialog: Locator,
  { index, name, state }: { index: number; name: string; state: string }
) => {
  await dialog.getByTestId('add-actions').click();
  const answered = page.waitForResponse(
    '/api/v1/events/subscriptions/capabilities'
  );
  await dialog
    .getByTestId(`actions-select-${index}`)
    .getByRole('button')
    .click();
  await page.getByRole('option', { name, exact: true }).click();
  await answered;
  await dialog.getByTestId(`actions-${index}`).getByRole('combobox').click();
  await page.getByRole('option', { name: state, exact: true }).click();
  await dismissPopover(dialog);
};

const expectSources = async (picker: Locator, labels: string[]) => {
  for (const label of labels) {
    await expect(picker).toContainText(label);
  }
};

test('An observability alert in the drawer takes several sources, with a trigger for each', async ({
  page,
}) => {
  test.slow();

  await openAlertsPage(page, '/observability/alerts');
  const dialog = await openAddAlertDrawer(page);
  await fillAlertName(dialog, `pw-ai-sources-${uuid()}`);

  await selectAlertSource(page, 'Pipeline');
  await selectAlertSource(page, 'Ingestion Pipeline', ['pipeline']);
  await expectSources(dialog.getByTestId('source-select'), [
    'Pipeline',
    'Ingestion Pipeline',
  ]);

  await test.step('a source no chosen trigger applies to is warned about', async () => {
    await addTrigger(page, dialog, {
      index: 0,
      name: 'Get Pipeline Status Updates (Pipeline)',
      state: 'Failed',
    });

    await expect(dialog.getByTestId('ingestionPipeline-warning')).toBeVisible();
    await expect(dialog.getByTestId('pipeline-warning')).not.toBeAttached();
  });

  await test.step('a trigger for that source clears the warning', async () => {
    await addTrigger(page, dialog, {
      index: 1,
      name: 'Get Ingestion Pipeline Status Updates (Ingestion Pipeline)',
      state: 'Failed',
    });

    await expect(
      dialog.getByTestId('ingestionPipeline-warning')
    ).not.toBeAttached();
    // Every trigger on offer is chosen.
    await expect(dialog.getByTestId('add-actions')).toBeDisabled();
  });

  await addDestination(page, dialog, 'Admins', 0);
  await selectInternalDestinationType(page, dialog, 'Email', 0);

  const { request, response } = await saveAlertDrawer(page, dialog);
  const created = await response?.json();
  createdAlertIds.push(created.id);

  expect(response?.status()).toBe(201);
  expect(request.postDataJSON().resources).toEqual([
    'pipeline',
    'ingestionPipeline',
  ]);

  await test.step('the view and the edit drawer show both sources', async () => {
    await expect(page).toHaveURL(
      `/observability/alert/${created.fullyQualifiedName}`
    );
    await expectSources(page.getByTestId('source-select'), [
      'Pipeline',
      'Ingestion Pipeline',
    ]);

    await page
      .getByTestId('delete-button')
      .locator('xpath=..')
      .getByTestId('edit-button')
      .click();
    const editDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByTestId('save-button') });
    await expectSources(editDialog.getByTestId('source-select'), [
      'Pipeline',
      'Ingestion Pipeline',
    ]);
  });
});

test('A notification alert in the drawer takes sources of one kind only', async ({
  page,
}) => {
  test.slow();

  await openAlertsPage(page, '/settings/notifications/alerts');
  const dialog = await openAddAlertDrawer(page);
  await fillAlertName(dialog, `pw-ai-sources-${uuid()}`);

  await selectAlertSource(page, 'Table');

  await test.step('a source of another kind is shown disabled, with the reason', async () => {
    const input = dialog.getByTestId('source-select').getByRole('combobox');
    await input.fill('conv');
    const conversation = page
      .getByRole('listbox')
      .getByRole('option')
      .filter({ has: page.getByTestId('conversation-option') });

    await expect(conversation).toHaveAttribute('aria-disabled', 'true');
    await expect(conversation).toContainText('different kinds');

    await input.fill('');
    await dismissPopover(dialog);
  });

  await selectAlertSource(page, 'Dashboard', ['table']);
  await addDestination(page, dialog, 'Owners', 0);
  await selectInternalDestinationType(page, dialog, 'Email', 0);

  const { request, response } = await saveAlertDrawer(page, dialog);
  const created = await response?.json();
  createdAlertIds.push(created.id);

  expect(response?.status()).toBe(201);
  expect(request.postDataJSON().resources).toEqual(['table', 'dashboard']);
});

test('A notification alert on the profile takes several sources, and its view shows them', async ({
  page,
}) => {
  test.slow();

  await navigateToAlertsList(page);
  await page.getByTestId('add-alert').click();
  await inputAlertInformation({
    page,
    name: `pw-ai-sources-${uuid()}`,
    sourceName: 'table',
  });

  const picker = page.getByTestId('source-select');
  await picker.getByRole('combobox').fill('dash');
  await page.getByRole('listbox').getByTestId('dashboard-option').click();
  await closeSourcePicker(page);
  await expectSources(picker, ['Table', 'Dashboard']);

  await page.getByTestId('add-destination-button').click();
  await addInternalDestinationProfile({
    page,
    destinationNumber: 0,
    category: 'Owners',
    type: 'Email',
  });

  const alertDetails: AlertDetails = await saveNewAlertAndVerify(page);
  createdAlertIds.push(alertDetails.id);

  expect(alertDetails.filteringRules.resources).toEqual(['table', 'dashboard']);
  await expectSources(page.getByTestId('source-select'), [
    'Table',
    'Dashboard',
  ]);
});
