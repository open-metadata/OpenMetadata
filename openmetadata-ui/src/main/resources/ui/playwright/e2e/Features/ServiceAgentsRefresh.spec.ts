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
import { Response } from '@playwright/test';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { expect, test } from '../../support/fixtures/base';
import { getEncodedFqn } from '../../utils/entity';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

/**
 * The refresh control's contract is a request ledger: one click refetches the agents list and
 * nothing else. Jest can prove which handler runs, but only a browser can prove that no *other*
 * request rides along — service details, permissions and the airflow probe all sit on the same page
 * and are the ones a naive "reload everything" refresh would pull in. Hence the counters.
 */
test.describe('Service Agents refresh', () => {
  const service = EntityDataClass.databaseService;

  test('should refetch the agents list and nothing else', async ({ page }) => {
    const serviceFqn = service.entityResponseData.fullyQualifiedName;
    const counts = { airflow: 0, permissions: 0, pipelines: 0, service: 0 };

    await page.route(
      '**/api/v1/services/ingestionPipelines/status',
      (route) => {
        counts.airflow += 1;

        return route.fulfill({ json: { code: 200, platform: 'airflow' } });
      }
    );

    await page.route('**/api/v1/services/ingestionPipelines?*', (route) => {
      counts.pipelines += 1;

      return route.fulfill({ json: { data: [], paging: { total: 0 } } });
    });

    // Left live it holds the response open and the click's request would never be observed.
    await page.route(
      '**/api/v1/services/ingestionPipelines/progress/service/**',
      (route) => route.fulfill({ status: 204, body: '' })
    );

    await page.route('**/api/v1/permissions/**', (route) => {
      counts.permissions += 1;

      return route.continue();
    });

    await page.route('**/api/v1/services/databaseServices/name/**', (route) => {
      counts.service += 1;

      return route.continue();
    });

    await page.goto(
      `/service/databaseServices/${getEncodedFqn(serviceFqn)}/agents/metadata`
    );
    await page.getByTestId('data-assets-header').waitFor();

    const refreshButton = page.getByTestId('agent-group-refresh');

    await refreshButton.waitFor();

    const baseline = { ...counts };

    const isListCall = (response: Response) =>
      response.url().includes('/api/v1/services/ingestionPipelines?') &&
      response.request().method() === 'GET';

    const listCall = page.waitForResponse(isListCall);

    await refreshButton.click();
    await listCall;

    // Counting straight after the first response would pass on a duplicate landing a tick later —
    // exactly the defect this test exists for. So wait for a second list call and require it to
    // never arrive.
    const duplicateArrived = await page
      .waitForResponse(isListCall, { timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    expect(duplicateArrived).toBe(false);
    expect(counts.pipelines - baseline.pipelines).toBe(1);
    expect(counts.service).toBe(baseline.service);
    expect(counts.permissions).toBe(baseline.permissions);
    expect(counts.airflow).toBe(baseline.airflow);
  });
});
