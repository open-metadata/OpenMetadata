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
 * Reindexing a table rewrites its search doc from the fields TableIndex declares. The profiler
 * settings modal reads tableProfilerConfig, so a rebuild that drops it leaves the modal
 * rendering defaults over a config that is still in the database — the values look reverted
 * without anything having failed.
 *
 * Profiler.spec.ts covers the modal against live-written state; this covers it after a rebuild.
 * Ported from the deleted ProfilerSettingsModalReindexUIIT.
 */

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage } from '../../../utils/common';
import { visitProfilerTab } from '../../../utils/incidentManager';
import { reindexEntities } from '../../../utils/reindex';

test.use({ storageState: 'playwright/.auth/admin.json' });

const PROFILE_SAMPLE = '60';
const SAMPLE_DATA_COUNT = '100';

test('Profiler settings survive a table reindex', async ({ browser }) => {
  test.slow();

  const { page, apiContext, afterAction } = await createNewPage(browser, {
    navigate: true,
  });
  const table = new TableClass();

  try {
    await table.create(apiContext);

    await visitProfilerTab(page, table);

    await page.getByTestId('profiler-setting-btn').click();
    await page.getByTestId('profiler-settings-modal').waitFor();

    await page.getByTestId('slider-input').clear();
    await page.getByTestId('slider-input').fill(PROFILE_SAMPLE);
    await page.getByTestId('sample-data-count-input').clear();
    await page.getByTestId('sample-data-count-input').fill(SAMPLE_DATA_COUNT);

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/tableProfilerConfig') &&
        response.request().method() === 'PUT'
    );
    await page.getByRole('button', { name: 'Save' }).click();
    await saveResponse;

    await reindexEntities(apiContext, [
      {
        id: table.entityResponseData?.id as string,
        type: 'table',
        fullyQualifiedName: table.entityResponseData
          ?.fullyQualifiedName as string,
      },
    ]);

    await visitProfilerTab(page, table);
    await page.getByTestId('profiler-setting-btn').click();
    await page.getByTestId('profiler-settings-modal').waitFor();

    await expect(
      page.getByTestId('slider-input'),
      'profile sample must survive the rebuild'
    ).toHaveValue(PROFILE_SAMPLE);
    await expect(
      page.getByTestId('sample-data-count-input'),
      'sampleDataCount must survive the rebuild'
    ).toHaveValue(SAMPLE_DATA_COUNT);
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
