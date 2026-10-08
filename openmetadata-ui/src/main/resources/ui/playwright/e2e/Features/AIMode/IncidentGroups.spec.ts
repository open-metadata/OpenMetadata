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
import { expect, test } from '@playwright/test';
import { performAdminLogin } from '../../../utils/admin';
import { toastNotification } from '../../../utils/common';
import {
  confirmBulkChange,
  getLatestIncident,
  IncidentSeed,
  openGroups,
  removeSeed,
  seedIncidents,
  selectGroup,
} from '../../../utils/incidentGroups';
import { enableAiAppMode } from '../../Utils/appMode';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const ROW_COUNT_TYPE = 'Table Row Count To Be Between';
const COLUMN_COUNT_TYPE = 'Table Column Count To Be Between';

// The grouped listing reads incidents straight from the database, so these
// bounds only cover a cold page and its first fetch.
const GROUPS_TIMEOUT = 30_000;

test.beforeEach(async ({ page }) => {
  await enableAiAppMode(page);
});

/**
 * These tests only read, so they share one seed. `beforeAll` runs once per
 * group of tests a worker takes, so the seed is rebuilt there, never added to.
 */
test.describe('AI mode Incident Manager — grouped incidents', () => {
  let seed: IncidentSeed;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(3 * 60 * 1000);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    seed = await seedIncidents(apiContext, 'Severity4');
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await removeSeed(apiContext, seed);
    await afterAction();
  });

  test('groups the incidents by test case type', async ({ page }) => {
    const groups = await openGroups(page, seed, {});

    await expect(groups).toBeVisible({ timeout: GROUPS_TIMEOUT });
    await expect(page.getByTestId('incident-groups-count')).toHaveText(
      '2 groups'
    );
    await expect(
      groups.getByRole('rowheader', { name: ROW_COUNT_TYPE })
    ).toBeVisible();
    await expect(
      groups.getByRole('rowheader', { name: COLUMN_COUNT_TYPE })
    ).toBeVisible();
  });

  test('hides the groups a status filter rules out', async ({ page }) => {
    await openGroups(page, seed, { status: 'New' });

    // Filtered down to nothing, which offers to clear the filters.
    await expect(page.getByTestId('incident-groups-no-match')).toBeVisible({
      timeout: GROUPS_TIMEOUT,
    });
  });

  test('previews a table group in the drawer and drills into it', async ({
    page,
  }) => {
    const groups = await openGroups(page, seed, { groupBy: 'table' });
    const tableGroup = groups.getByRole('rowheader', {
      name: seed.table.entity.displayName,
    });

    await expect(tableGroup).toBeVisible({ timeout: GROUPS_TIMEOUT });
    await expect(page.getByTestId('incident-groups-count')).toHaveText(
      '1 group'
    );

    await tableGroup.click();

    const drawer = page.getByRole('dialog', { name: 'Incident group' });

    await expect(drawer.getByTestId('incident-group-drawer-name')).toHaveText(
      seed.table.entity.displayName
    );
    // The drawer counts and lists the same incidents the group row counts.
    await expect(drawer.getByTestId('incident-group-stat-count')).toHaveText(
      '2'
    );
    await expect(drawer.getByTestId(/^incident-row-/)).toHaveCount(2);

    await drawer.getByTestId('incident-group-view-all').click();

    await expect(drawer).toBeHidden();
    await expect(page.getByTestId('incident-group-detail-heading')).toHaveText(
      seed.table.entity.displayName
    );
    await expect(page.getByTestId(/^incident-row-/)).toHaveCount(2);

    await page.getByTestId('incident-group-back').click();

    await expect(tableGroup).toBeVisible();
  });

  // The seed gives the row count incident Severity 4; the column count one
  // has none.
  test('narrows the groups to the severities picked', async ({ page }) => {
    const groups = await openGroups(page, seed, {
      groupBy: 'testDefinition',
      severity: 'Severity4',
    });

    await expect(
      groups.getByRole('rowheader', { name: ROW_COUNT_TYPE })
    ).toBeVisible({ timeout: GROUPS_TIMEOUT });
    await expect(
      groups.getByRole('rowheader', { name: COLUMN_COUNT_TYPE })
    ).toBeHidden();
    await expect(page.getByTestId('incident-groups-count')).toHaveText(
      '1 group'
    );

    await openGroups(page, seed, {
      groupBy: 'testDefinition',
      severity: 'Severity1',
    });

    await expect(page.getByTestId('incident-groups-no-match')).toBeVisible({
      timeout: GROUPS_TIMEOUT,
    });
  });

  test('keeps the drill-down in the URL across a reload and Back', async ({
    page,
  }) => {
    const groups = await openGroups(page, seed, { groupBy: 'table' });
    const tableGroup = groups.getByRole('row', {
      name: seed.table.entity.displayName,
    });

    await expect(tableGroup).toBeVisible({ timeout: GROUPS_TIMEOUT });

    await tableGroup
      .getByRole('button', { name: `View ${seed.table.entity.displayName}` })
      .click();

    await expect(page).toHaveURL(/[?&]group=/);
    // The chevron's press stays with it: the row does not also preview.
    await expect(
      page.getByRole('dialog', { name: 'Incident group' })
    ).toBeHidden();

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('incident-group-detail-heading')).toHaveText(
      seed.table.entity.displayName,
      { timeout: GROUPS_TIMEOUT }
    );
    await expect(page.getByTestId(/^incident-row-/)).toHaveCount(2);

    await page.goBack();

    await expect(tableGroup).toBeVisible({ timeout: GROUPS_TIMEOUT });
    await expect(page).not.toHaveURL(/[?&]group=/);
  });

  test('previews a row pressed while another group is selected', async ({
    page,
  }) => {
    const groups = await openGroups(page, seed, { groupBy: 'testDefinition' });
    const rowCountGroup = groups.getByRole('row', { name: ROW_COUNT_TYPE });
    const columnCountGroup = groups.getByRole('row', {
      name: COLUMN_COUNT_TYPE,
    });

    await expect(rowCountGroup).toBeVisible({ timeout: GROUPS_TIMEOUT });

    await selectGroup(rowCountGroup);

    await expect(page.getByTestId('incident-groups-selected-count')).toHaveText(
      '1 group selected'
    );
    // The checkbox's press stays with it: the row does not also preview.
    await expect(
      page.getByRole('dialog', { name: 'Incident group' })
    ).toBeHidden();

    await columnCountGroup.getByRole('rowheader').click();

    await expect(
      page
        .getByRole('dialog', { name: 'Incident group' })
        .getByTestId('incident-group-drawer-name')
    ).toHaveText(COLUMN_COUNT_TYPE);
    await expect(page.getByTestId('incident-groups-selected-count')).toHaveText(
      '1 group selected'
    );
  });
});

/**
 * These tests change incidents, so each seeds its own and none depends on what
 * another changed.
 */
test.describe('AI mode Incident Manager — changing grouped incidents', () => {
  let seed: IncidentSeed;

  test.beforeEach(async ({ browser }) => {
    test.setTimeout(3 * 60 * 1000);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    seed = await seedIncidents(apiContext);
    await afterAction();
  });

  test.afterEach(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await removeSeed(apiContext, seed);
    await afterAction();
  });

  test('changes one incident severity from its row in the drawer', async ({
    page,
    browser,
  }) => {
    const groups = await openGroups(page, seed, { groupBy: 'table' });
    const tableGroup = groups.getByRole('rowheader', {
      name: seed.table.entity.displayName,
    });

    await expect(tableGroup).toBeVisible({ timeout: GROUPS_TIMEOUT });

    await tableGroup.click();

    const incidentRow = page
      .getByRole('dialog', { name: 'Incident group' })
      .getByRole('row', { name: seed.rowCountName });

    await incidentRow.getByTestId('severity-chip').click();
    await page.getByRole('menuitemradio', { name: 'Severity 4' }).click();

    await expect(incidentRow.getByTestId('severity-chip')).toHaveText(
      'Severity 4'
    );

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const incident = await getLatestIncident(apiContext, seed.testCaseFqns[0]);

    expect(incident?.severity).toBe('Severity4');
    // Only the severity changed: the incident is still assigned.
    expect(incident?.testCaseResolutionStatusType).toBe('Assigned');

    await afterAction();
  });

  test('sets the severity of every incident in the selected groups', async ({
    page,
    browser,
  }) => {
    const groups = await openGroups(page, seed, { groupBy: 'table' });
    const tableGroup = groups.getByRole('row', {
      name: seed.table.entity.displayName,
    });

    await expect(tableGroup).toBeVisible({ timeout: GROUPS_TIMEOUT });

    await selectGroup(tableGroup);

    await expect(page.getByTestId('incident-groups-selected-count')).toHaveText(
      '1 group selected'
    );

    await page.getByTestId('incident-groups-set-severity').click();
    await page.getByTestId('incident-groups-severity-Severity2').click();
    await confirmBulkChange(page);

    await toastNotification(page, 'Incidents updated: 2');
    await expect(
      page.getByTestId('incident-groups-selection-bar')
    ).toBeHidden();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    for (const testCaseFqn of seed.testCaseFqns) {
      const incident = await getLatestIncident(apiContext, testCaseFqn);

      expect(incident?.severity).toBe('Severity2');
      // A severity change keeps the status and its assignee.
      expect(incident?.testCaseResolutionStatusType).toBe('Assigned');
      expect(incident?.testCaseResolutionStatusDetails?.assignee?.name).toBe(
        seed.assignee.responseData.name
      );
    }

    await afterAction();
  });

  test('acknowledges the new incidents of the selected groups', async ({
    page,
    browser,
  }) => {
    const groups = await openGroups(page, seed, {
      testCaseFQN: seed.newIncidentFqn,
      groupBy: 'table',
    });
    const tableGroup = groups.getByRole('row', {
      name: seed.table.entity.displayName,
    });

    await expect(tableGroup).toBeVisible({ timeout: GROUPS_TIMEOUT });

    await selectGroup(tableGroup);
    await page.getByTestId('incident-groups-set-status').click();
    await page.getByTestId('incident-groups-status-Ack').click();
    await confirmBulkChange(page);

    await toastNotification(page, 'Incidents updated: 1');

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const incident = await getLatestIncident(apiContext, seed.newIncidentFqn);

    expect(incident?.testCaseResolutionStatusType).toBe('Ack');

    await afterAction();
  });

  test('leaves assigned incidents as they are when acknowledging', async ({
    page,
    browser,
  }) => {
    const groups = await openGroups(page, seed, { groupBy: 'table' });
    const tableGroup = groups.getByRole('row', {
      name: seed.table.entity.displayName,
    });

    await expect(tableGroup).toBeVisible({ timeout: GROUPS_TIMEOUT });

    await selectGroup(tableGroup);
    await page.getByTestId('incident-groups-set-status').click();
    await page.getByTestId('incident-groups-status-Ack').click();
    await confirmBulkChange(page);

    // The workflow has no way back from Assigned to Ack, so nothing is sent.
    await toastNotification(
      page,
      'No incident in the selected groups can take that change'
    );

    const { apiContext, afterAction } = await performAdminLogin(browser);

    for (const testCaseFqn of seed.testCaseFqns) {
      const incident = await getLatestIncident(apiContext, testCaseFqn);

      expect(incident?.testCaseResolutionStatusType).toBe('Assigned');
    }

    await afterAction();
  });
});
