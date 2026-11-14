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
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

const table = new TableClass();

const storedAvailabilityTime = '09:00 UTC';
// A leaf column name that does NOT exist among the table columns, exercising
// the unmatched columnName preservation path.
const unmatchedColumnName = 'UPDATED_AT';

// Saved in beforeAll, reused in afterAll and the test so cleanup/verification
// target exactly the contract this run created — never another run's contract.
let contractId: string;

test.describe('Data contract SLA round-trip preservation (bug fix E2E)', () => {
  test.beforeAll(
    'Seed a table and a contract with a non-HH:mm SLA',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);

      const contractResponse = await apiContext.post('/api/v1/dataContracts', {
        data: {
          name: `sla_roundtrip_contract_${uuid()}`,
          entity: { id: table.entityResponseData.id, type: 'table' },
          sla: {
            refreshFrequency: { interval: 1, unit: 'day' },
            retention: { period: 30, unit: 'day' },
            availabilityTime: storedAvailabilityTime,
            columnName: unmatchedColumnName,
          },
        },
      });
      expect(contractResponse.status()).toBe(201);
      contractId = (await contractResponse.json()).id;
      expect(contractId).toBeTruthy();

      await afterAction();
    }
  );

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    if (contractId) {
      await apiContext.delete(`/api/v1/dataContracts/${contractId}`);
    }

    await table.delete(apiContext);
    await afterAction();
  });

  test('editing an unrelated SLA field keeps availabilityTime and an unmatched columnName intact', async ({
    browser,
  }) => {
    test.slow();
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });

    try {
      await redirectToHomePage(page);

      await test.step('Open the table contract tab', async () => {
        await table.visitEntityPage(page);
        await page.click('[data-testid="contract"]');
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Open the edit wizard SLA tab', async () => {
        await page.getByTestId('manage-contract-actions').click();
        await page.getByTestId('contract-action-dropdown').waitFor({
          state: 'visible',
        });
        await page.getByTestId('contract-edit-button').click();
        await waitForAllLoadersToDisappear(page);
        await page
          .getByTestId('add-contract-card')
          .getByRole('tab', { name: 'SLA' })
          .click();
        // Retention number input is seeded from the stored contract.
        await expect(
          page.getByTestId('retention-period-input').locator('input')
        ).toHaveValue('30');
      });

      await test.step('Edit only the retention period (unrelated field) and save', async () => {
        await page
          .getByTestId('retention-period-input')
          .locator('input')
          .fill('45');

        const saveContractResponse = page.waitForResponse(
          '/api/v1/dataContracts/*'
        );
        await page.getByTestId('save-contract-btn').click();
        await saveContractResponse;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Verify the stored SLA kept availabilityTime and columnName', async () => {
        const contractResponse = await apiContext.get(
          `/api/v1/dataContracts/${contractId}`
        );
        expect(
          contractResponse.status(),
          'seeded contract should still exist'
        ).toBe(200);
        const contract = await contractResponse.json();

        const sla = contract.sla ?? {};
        // The headline bug fix: availabilityTime survives (normalized to "09:00").
        expect(sla.availabilityTime).not.toBeNull();
        expect(sla.availabilityTime).not.toBeUndefined();
        // An unmatched columnName must be preserved, not removed.
        expect(sla.columnName).toBe(unmatchedColumnName);
        // The retention edit applied.
        expect(sla.retention).toEqual({ period: 45, unit: 'day' });
        // refreshFrequency untouched.
        expect(sla.refreshFrequency).toEqual({ interval: 1, unit: 'day' });
      });
    } finally {
      await afterAction();
    }
  });
});
