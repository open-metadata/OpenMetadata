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
import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { TagClass } from '../../../support/tag/TagClass';
import { createNewPage } from '../../../utils/common';
import {
  captureReports,
  goToDataQualityDashboard,
} from '../../../utils/dataQuality';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

let certTable: TableClass;
let cert: TagClass;

test.beforeAll('setup', async ({ browser }) => {
  certTable = new TableClass();
  cert = new TagClass({ classification: 'Certification' });

  const { apiContext, afterAction } = await createNewPage(browser);

  await cert.create(apiContext);
  await certTable.create(apiContext);

  // Certification is a first-class entity field — patch /certification, not /tags.
  // This is what makes the table show up at certification.tagLabel.tagFQN in the
  // search index, which the dashboard filter queries.
  await certTable.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/certification',
        value: {
          tagLabel: {
            tagFQN: cert.responseData.fullyQualifiedName,
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
      },
    ],
  });

  // A test case on the certified table exercises the testCase-index branch of
  // the coverage chart — without it, the testCase-side filter would have
  // nothing to match and we couldn't distinguish a broken filter from an empty
  // result set.
  await certTable.createTestCase(apiContext);

  await afterAction();
});

test('Certification filter is rendered between Tier and Tag in the filter row', async ({
  page,
}) => {
  await goToDataQualityDashboard(page);
  await waitForAllLoadersToDisappear(page);

  // Wait for the new filter to render before snapshotting DOM order.
  await expect(page.getByTestId('search-dropdown-Certification')).toBeVisible();

  // Read the testids of exactly the three filter buttons in document order.
  // CSS group selectors and `evaluateAll` both preserve DOM order, so this
  // catches "Cert moved to the end of the filter row" without locking on
  // pixel layout (responsive / theme / Tailwind changes don't break it).
  const orderedTestids = await page
    .locator(
      [
        '[data-testid="search-dropdown-Tier"]',
        '[data-testid="search-dropdown-Certification"]',
        '[data-testid="search-dropdown-Tag"]',
      ].join(', ')
    )
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));

  expect(orderedTestids).toEqual([
    'search-dropdown-Tier',
    'search-dropdown-Certification',
    'search-dropdown-Tag',
  ]);
});

test('Certification filter narrows both table- and testCase-index queries via the flat field path', async ({
  page,
}) => {
  const captured = captureReports(page);

  await goToDataQualityDashboard(page);
  await waitForAllLoadersToDisappear(page);

  await page.getByRole('button', { name: 'Certification' }).click();
  await page.getByTestId('search-input').click();
  await page
    .getByTestId('search-input')
    .fill(cert.responseData.fullyQualifiedName);
  await page.getByTestId(cert.responseData.fullyQualifiedName).click();

  const certFqnEncoded = encodeURIComponent(
    cert.responseData.fullyQualifiedName
  );
  const tableReload = page.waitForResponse(
    (r) =>
      r.url().includes('/dataQualityReport') &&
      r.url().includes('index=table') &&
      r.url().includes(certFqnEncoded)
  );
  const testCaseReload = page.waitForResponse(
    (r) =>
      r.url().includes('/dataQualityReport') &&
      r.url().includes('index=testCase') &&
      r.url().includes(certFqnEncoded)
  );
  await page.getByTestId('update-btn').click();
  await Promise.all([tableReload, testCaseReload]);

  const reportsWithCertFilter = captured.filter((c) =>
    c.q.includes(cert.responseData.fullyQualifiedName)
  );

  // Every dashboard call that mentions the cert FQN must use the flat path:
  // - `certification.tagLabel.tagFQN` is what the search index actually exposes.
  // - `testCase.certification.tagLabel.tagFQN` would be a regression (the
  //   testCase doc has no `testCase.*` namespace; that path matches nothing
  //   and silently zeros out the coverage chart numerator).
  // - `tags.tagFQN` would be the original bug — certifications were being
  //   routed through the generic tag path that never matches certified entities.
  for (const r of reportsWithCertFilter) {
    expect(r.q).toContain('certification.tagLabel.tagFQN');
    expect(r.q).not.toContain('testCase.certification.tagLabel.tagFQN');
  }

  // And both index queries must have actually fired with the filter — otherwise
  // we'd accept a broken UI that just stopped sending the call entirely.
  expect(reportsWithCertFilter.some((c) => c.index === 'table')).toBeTruthy();
  expect(
    reportsWithCertFilter.some((c) => c.index === 'testCase')
  ).toBeTruthy();
});

test('Certification tags are not listed in the generic Tag dropdown', async ({
  page,
}) => {
  await goToDataQualityDashboard(page);
  await waitForAllLoadersToDisappear(page);

  await page.getByRole('button', { name: 'Tag', exact: true }).click();
  await page.getByTestId('search-input').click();

  // If the Certification classification leaked into the Tag dropdown's source
  // query, searching for our cert tag's exact FQN would surface it.
  await page
    .getByTestId('search-input')
    .fill(cert.responseData.fullyQualifiedName);

  await expect(
    page.getByTestId(cert.responseData.fullyQualifiedName)
  ).toHaveCount(0);
});

// The TagPage Data Observability tab embeds the same dashboard. Before this
// fix every tag detail page sent `tags: [FQN]` regardless of classification,
// so the embedded chart on a Certification page silently reported 0 (the
// `tags.tagFQN` term never matches assets carrying a certification). This
// test pins the post-fix routing.
test('TagPage: Certification detail page routes through certification.tagLabel.tagFQN', async ({
  page,
}) => {
  const captured = captureReports(page);
  const certFqn = cert.responseData.fullyQualifiedName;
  const certFqnEncoded = encodeURIComponent(certFqn);

  const reloadFired = page.waitForResponse(
    (r) =>
      r.url().includes('/dataQualityReport') && r.url().includes(certFqnEncoded)
  );
  await page.goto(`/tag/${certFqnEncoded}/data_observability`);
  await reloadFired;
  await waitForAllLoadersToDisappear(page);

  const reportsWithCertFilter = captured.filter((c) => c.q.includes(certFqn));
  expect(reportsWithCertFilter.length).toBeGreaterThan(0);
  for (const r of reportsWithCertFilter) {
    expect(r.q).toContain('certification.tagLabel.tagFQN');
    // Pre-fix path that never matched — must not regress.
    expect(r.q).not.toContain('tags.tagFQN');
  }
});
