/*
 *  Copyright 2025 Collate.
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
import { expect } from '@playwright/test';
import { Domain } from '../../support/domain/Domain';
import { performAdminLogin } from '../../utils/admin';
import { clickOutside, redirectToHomePage } from '../../utils/common';
import { addTierWidget } from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

// Guards the TierCard stale-selection fix: after open -> pick a different tier ->
// cancel -> reopen, the editor must re-baseline to the persisted tier, so
// pressing Update WITHOUT re-selecting a radio commits the persisted tier and
// never the abandoned selection. Both cancel paths are covered: the X button
// (handleCloseTier -> onClose) and an outside click (antd onOpenChange), since
// the fix resyncs `selectedTier` whenever the popover opens regardless of how
// the prior session was dismissed.
const domainX = new Domain();
const domainOutside = new Domain();

async function assertUpdateCommitsPersistedTier(
  page: import('@playwright/test').Page,
  domain: Domain
) {
  await domain.visitEntityPage(page);

  // Assign Tier1 so the entity is tiered (TierCard stays mounted across
  // open/close cycles, which is the precondition for the stale-state bug).
  await addTierWidget(page, 'Tier1', domain.endpoint);

  await page.getByTestId('edit-tier').click();
  await waitForAllLoadersToDisappear(page);

  // Pick a different tier, then cancel without committing.
  await page.getByTestId('radio-btn-Tier3').click();
}

test.describe('Tier editor stale-selection guard', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await domainX.create(apiContext);
    await domainOutside.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await domainX.delete(apiContext);
    await domainOutside.delete(apiContext);
    await afterAction();
  });

  test('Domain - cancelled (X button) tier selection is not committed after reopen', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await assertUpdateCommitsPersistedTier(page, domainX);

    // Cancel via the X button.
    await page.getByTestId('close-tier-card').click();

    await runReopenAndUpdateGuard(page);
  });

  test('Domain - cancelled (outside click) tier selection is not committed after reopen', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await assertUpdateCommitsPersistedTier(page, domainOutside);

    // Cancel via an outside click (exercises the antd onOpenChange close path).
    await clickOutside(page);

    await runReopenAndUpdateGuard(page);
  });
});

async function runReopenAndUpdateGuard(page: import('@playwright/test').Page) {
  // Reopen the editor. With the fix, selectedTier is resynced to the persisted
  // tier (Tier1) here; without the fix, the cancelled Tier3 survives.
  await page.getByTestId('edit-tier').click();
  await waitForAllLoadersToDisappear(page);

  // Capture the PATCH that Update triggers. The body must not reference the
  // abandoned Tier3 selection.
  const patchRequest = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/domains`) &&
      response.request().method() === 'PATCH'
  );

  // Press Update WITHOUT re-selecting a radio in this session.
  await page.getByTestId('update-tier-card').click();
  const response = await patchRequest;
  const patchBody = response.request().postData() ?? '';

  expect(response.status()).toBe(200);
  expect(patchBody).not.toContain('Tier.Tier3');

  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('Tier')).toContainText('Tier1');
}
