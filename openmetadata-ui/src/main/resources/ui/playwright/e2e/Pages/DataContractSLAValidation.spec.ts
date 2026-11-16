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
import { expect } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import { navigateToContractTab } from '../../utils/odcsImportExport';
import { test } from '../fixtures/pages';

const HOUR_MS = 60 * 60 * 1000;

const table = new TableClass();

test.describe(
  'Data contract SLA validation',
  { tag: ['@Pages', '@Governance'] },
  () => {
    test.beforeAll(
      'Validate a contract whose daily refresh the last write meets',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await table.create(apiContext);

        const contractResponse = await apiContext.post(
          '/api/v1/dataContracts',
          {
            data: {
              name: `sla_contract_${uuid()}`,
              entity: { id: table.entityResponseData.id, type: 'table' },
              sla: { refreshFrequency: { interval: 1, unit: 'day' } },
            },
          }
        );
        expect(contractResponse.status()).toBe(201);
        const contract = await contractResponse.json();

        const profileResponse = await apiContext.put(
          `/api/v1/tables/${table.entityResponseData.id}/tableProfile`,
          {
            data: {
              tableProfile: {
                timestamp: Date.now(),
                rowCount: 10,
                columnCount: 9,
              },
              systemProfile: [
                {
                  timestamp: Date.now() - HOUR_MS,
                  operation: 'INSERT',
                  rowsAffected: 10,
                },
              ],
            },
          }
        );
        expect(profileResponse.status()).toBe(200);

        const validateResponse = await apiContext.post(
          `/api/v1/dataContracts/${contract.id}/validate`
        );
        expect(validateResponse.ok()).toBeTruthy();

        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('SLA card shows the outcome of the latest validation', async ({
      page,
    }) => {
      test.slow();
      await redirectToHomePage(page);

      await test.step('Open the table contract', async () => {
        await navigateToContractTab(page, table);
      });

      await test.step('The refresh frequency is marked as met', async () => {
        const slaCard = page.getByTestId('contract-sla-card');

        await expect(slaCard).toBeVisible();
        await expect(
          slaCard.getByTestId('sla-refresh_frequency-passed')
        ).toBeVisible();
        await expect(
          slaCard.getByTestId('contract-status-card-item-sla-status')
        ).toHaveText('Passed');
        await expect(slaCard.getByTestId('sla-last-refreshed')).toContainText(
          'System Metrics'
        );
      });
    });
  }
);
