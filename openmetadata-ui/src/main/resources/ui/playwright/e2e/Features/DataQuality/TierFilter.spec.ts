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
import test, { expect, Page, Request } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { TagClass } from '../../../support/tag/TagClass';
import { createNewPage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const tierTable = new TableClass();
const tier = new TagClass({ classification: 'Tier' });

test.beforeAll('setup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  await tier.create(apiContext);
  await tierTable.create(apiContext);

  // Tier is applied as a Classification tag in the entity's `tags` array; the
  // search indexer then extracts Tier values out of `tags` into a top-level
  // (or `testCase.`-prefixed) `tier` field on every downstream index.
  await tierTable.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/tags/0',
        value: {
          name: tier.data.name,
          tagFQN: tier.responseData.fullyQualifiedName,
          labelType: 'Manual',
          state: 'Confirmed',
        },
      },
    ],
  });

  // A test case on the tier-tagged table exercises the testCase-index branch
  // of the dashboard's coverage chart.
  await tierTable.createTestCase(apiContext);

  await afterAction();
});

test.afterAll('cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  await tierTable.delete(apiContext);
  await tier.delete(apiContext);

  await afterAction();
});

function captureReports(
  page: Page
): { url: string; q: string; index: string }[] {
  const captured: { url: string; q: string; index: string }[] = [];
  page.on('request', (req: Request) => {
    const url = req.url();
    if (url.includes('/dataQualityReport')) {
      const u = new URL(url);
      captured.push({
        url,
        q: u.searchParams.get('q') ?? '',
        index: u.searchParams.get('index') ?? '',
      });
    }
  });
  return captured;
}

// Pre-fix, the TagPage routed every system tag through `tags: [FQN]`. The
// table-index call would then query `tags.tagFQN: Tier.X` (a path Tier never
// lives at) and report 0 — Harshit's original Slack screenshot. Post-fix,
// TagPage uses `tier: [FQN]`, and the filter builder maps it to `tier.tagFQN`
// for both the table and testCase indices.
//
// This spec also catches regression of the latent routing bug in the 4
// "bypass" fetch functions in `dataQualityDashboardAPI.ts`
// (`fetchTestCaseSummaryByNoDimension`, `fetchCountOfIncidentStatusTypeByDays`,
// `fetchIncidentTimeMetrics`, `fetchTestCaseStatusMetricsByDays`). Those
// build their own ES query and merge tier into the tags array — until each is
// updated to emit `tier.tagFQN` / `testCase.tier.tagFQN`, dashboard widgets
// fed by them silently fail for tier filters.
test('TagPage: Tier detail page routes every dashboard call through tier.tagFQN', async ({
  page,
}) => {
  const captured = captureReports(page);
  const tierFqn = tier.responseData.fullyQualifiedName;
  const tierFqnEncoded = encodeURIComponent(tierFqn);

  const reloadFired = page.waitForResponse(
    (r) =>
      r.url().includes('/dataQualityReport') && r.url().includes(tierFqnEncoded)
  );
  await page.goto(`/tag/${tierFqnEncoded}/data_observability`);
  await reloadFired;
  await waitForAllLoadersToDisappear(page);

  const reportsWithTierFilter = captured.filter((c) => c.q.includes(tierFqn));
  expect(reportsWithTierFilter.length).toBeGreaterThan(0);
  for (const r of reportsWithTierFilter) {
    // Every dashboard call that mentions the tier FQN must use the dedicated
    // tier path. The exact field is `tier.tagFQN` on top-level indices and
    // `testCase.tier.tagFQN` on the deeper (`testCaseResult`,
    // `testCaseResolutionStatus`) ones — both satisfy this substring.
    expect(r.q).toContain('tier.tagFQN');
    // Pre-fix path that never matched on any of these indices.
    expect(r.q).not.toContain('tags.tagFQN');
  }
});
