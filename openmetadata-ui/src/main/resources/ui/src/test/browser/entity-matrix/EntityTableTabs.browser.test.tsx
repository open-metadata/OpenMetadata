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
 * The Table-only tab flows of playwright/e2e/Pages/Entity.spec.ts: switching
 * from Data Observability to the Activity Feed, and a Data Consumer whose role
 * denies ViewQueries and ViewSampleData finding both tabs closed. Real page,
 * real tabs; only the network is mocked.
 */
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { http, HttpResponse } from 'msw';
import { Operation } from '../../../generated/entity/policies/policy';
import { UNTOUCHED } from '../fixtures/dataAssets';
import { ADMIN, DATA_CONSUMER } from '../fixtures/personas';
import { makeTable, TABLE_FQN } from '../fixtures/table';
import { EMPTY_LIST, worker } from '../msw';
import { entityConfig, mountEntityPage } from './entityMatrix';

const table = entityConfig('Table');

describe('Table tabs', { timeout: 60_000 }, () => {
  test('Data Observability, then Activity Feed', async () => {
    const profiles: string[] = [];
    const base = `/api/v1/tables/${TABLE_FQN}`;
    worker.use(
      http.get(`${base}/tableProfile`, ({ request }) => {
        profiles.push(new URL(request.url).pathname);

        return HttpResponse.json(EMPTY_LIST);
      }),
      http.get(`${base}/systemProfile`, () => HttpResponse.json(EMPTY_LIST)),
      http.get(`${base}/tableProfile/latest`, () =>
        HttpResponse.json(makeTable(UNTOUCHED))
      ),
      // The incident count badge: no new or resolved incidents.
      http.get('/api/v1/dataQuality/testSuites/dataQualityReport', () =>
        HttpResponse.json({ data: [], metadata: { dimensions: [] } })
      )
    );
    await mountEntityPage(table, ADMIN);

    await userEvent.click(page.getByTestId('profiler'));

    for (const tab of ['table-profile', 'column-profile', 'data-quality']) {
      await expect.element(page.getByTestId(tab)).toBeVisible();
    }

    await expect.poll(() => profiles).toEqual([`${base}/tableProfile`]);

    await userEvent.click(page.getByTestId('activity_feed'));

    await expect
      .element(page.getByTestId('global-setting-left-panel'))
      .toBeVisible();
  });

  test('Data Consumer denied ViewQueries and ViewSampleData', async () => {
    await mountEntityPage(table, {
      ...DATA_CONSUMER,
      denied: [Operation.ViewQueries, Operation.ViewSampleData],
    });
    const denied = page.getByTestId('permission-error-placeholder');

    await userEvent.click(page.getByTestId('table_queries'));

    await expect
      .element(denied)
      .toHaveTextContent(
        "You don't have necessary permissions. Please check with the admin to get the View Queries permission."
      );

    await userEvent.click(page.getByTestId('sample_data'));

    await expect
      .element(denied)
      .toHaveTextContent(
        "You don't have necessary permissions. Please check with the admin to get the View Sample Data permission."
      );
  });
});
