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
 * Observability drawer and the settings modal's Notification panel. AI mode serves no
 * `/settings/*` page (ADR:2026-10-21-settings-pages-are-classic-only), so there is no
 * Settings → Notifications drawer to cover.
 */

import { Locator, Page } from '@playwright/test';
import { AlertDetails } from '../../../constant/alert.interface';
import { expect, test } from '../../../support/fixtures/base';
import { performAdminLogin } from '../../../utils/admin';
import { watchPerSourceListRequests } from '../../../utils/alert';
import { deleteFixtureEntity } from '../../../utils/apiResponse';
import {
  chooseSelectOption,
  selectOptionWithRetry,
  uuid,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  addInternalDestinationProfile,
  closeSourcePicker,
  inputAlertInformation,
  navigateToAlertsList,
  saveNewAlertAndVerify,
} from '../../../utils/profileNotificationAlert';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
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
    await deleteFixtureEntity(
      apiContext,
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

// A trigger names the sources it applies to once the alert has several. Choosing one asks the
// server again, so the wait matches the question that holds this trigger: one still in flight for
// an earlier pick would otherwise satisfy it.
const addTrigger = async (
  page: Page,
  dialog: Locator,
  {
    index,
    trigger,
    label,
    state,
  }: { index: number; trigger: string; label: string; state: string }
) => {
  await dialog.getByTestId('add-actions').click();
  const answered = waitForResponseWithStatus(
    page,
    (response) =>
      response.url().includes('/api/v1/events/subscriptions/capabilities') &&
      (response.request().postDataJSON()?.input?.actions ?? []).some(
        (action: { name?: string }) => action.name === trigger
      ),
    200
  );
  await selectOptionWithRetry(
    dialog.getByTestId(`actions-select-${index}`).getByRole('button'),
    page.getByRole('option', { name: label, exact: true })
  );
  await answered;
  await chooseSelectOption(
    dialog.getByTestId(`actions-${index}`).getByRole('combobox'),
    page.getByRole('option', { name: state, exact: true })
  );
  await dismissPopover(dialog);
};

// One chip per chosen source, in the order chosen. The picker's whole text would let
// 'Ingestion Pipeline' stand in for 'Pipeline'.
const expectSources = async (picker: Locator, labels: string[]) => {
  await expect(picker.getByTestId('autocomplete-selected-item')).toHaveText(
    labels
  );
};

test('An observability alert in the drawer takes several sources, with a trigger for each', async ({
  page,
}) => {
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
      trigger: 'GetPipelineStatusUpdates',
      label: 'Get Pipeline Status Updates (Pipeline)',
      state: 'Failed',
    });

    await expect(dialog.getByTestId('ingestionPipeline-warning')).toBeVisible();
    await expect(dialog.getByTestId('pipeline-warning')).not.toBeAttached();
  });

  await test.step('a trigger for that source clears the warning', async () => {
    await addTrigger(page, dialog, {
      index: 1,
      trigger: 'GetIngestionPipelineStatusUpdates',
      label: 'Get Ingestion Pipeline Status Updates (Ingestion Pipeline)',
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
  expect(response?.status()).toBe(201);
  const created = await response?.json();
  createdAlertIds.push(created.id);

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

    await page.getByTestId('edit-button').click();
    const editDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByTestId('save-button') });
    await expectSources(editDialog.getByTestId('source-select'), [
      'Pipeline',
      'Ingestion Pipeline',
    ]);
  });
});

test('A notification alert on the profile takes several sources, and its view shows them', async ({
  page,
}) => {
  await navigateToAlertsList(page);
  await page.getByTestId('add-alert').click();
  await inputAlertInformation({
    page,
    name: `pw-ai-sources-${uuid()}`,
    sourceName: 'table',
  });

  const picker = page.getByTestId('source-select');
  await chooseSelectOption(
    picker,
    page.getByRole('listbox').getByTestId('dashboard-option')
  );
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
