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
import { Page } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import { expect, test as base } from '../../../support/fixtures/base';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import {
  assignDomainOnlyAccess,
  assignDomainToTable,
  safeDelete,
} from '../../../utils/domainIsolationUtils';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { seedFailedIncidents } from '../../../utils/incidentManager';
import { enableDisableSearchRBAC } from '../../../utils/searchRBAC';
import { sidebarClick } from '../../../utils/sidebar';

// Issue #31740 — the Incident Manager listing is served by the `testCaseIncidentStatus/search/list`
// endpoint, which never passed the caller's SubjectContext to the search layer. hasDomain() returns
// true for list operations (no single resource is in scope) and defers to search-side filtering, so
// without that SubjectContext no domain policy restricted the listing at all.
//
// The user under test deliberately has NO domain assigned. A user WITH a domain is not a valid
// regression guard here: the page sends `domain=<their own domain>` (useIncidentList passes
// activeDomain unless it is the default), and that caller-supplied filter alone hides foreign
// incidents even on a server with the bug. With no domain the page sends no `domain` param, so the
// policy evaluated server-side is the only thing that can filter the list — which is exactly the
// behaviour this spec protects.
const adminUser = new UserClass();
const noDomainUser = new UserClass();
const tenant = new Domain();
const restrictedTable = new TableClass();
const domainlessTable = new TableClass();

let restrictedTestCaseName = '';
let restrictedTestCaseFqn = '';
let domainlessTestCaseName = '';
let domainlessTestCaseFqn = '';

const test = base.extend<{ adminPage: Page; noDomainPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await adminUser.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
  noDomainPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await noDomainUser.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
});

// Returns the test case FQNs the server actually sent to this page. The rendered table is paginated,
// so a row can be missing from page 1 while still being exposed to the user — asserting only on the
// DOM would let a real leak pass. Asserting on the payload the page requested closes that gap, and
// the visible-row assertions below keep the user-facing behaviour covered too.
const openIncidentManager = async (page: Page): Promise<string[]> => {
  await redirectToHomePage(page);

  // Matched on URL only. Narrowing the predicate by status would never resolve on an error
  // response, turning a failing API into an opaque timeout instead of a status assertion.
  const incidentResponse = page.waitForResponse((response) =>
    response
      .url()
      .includes('/dataQuality/testCases/testCaseIncidentStatus/search/list')
  );
  await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
  const response = await incidentResponse;

  expect(response.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('incident-filter-bar')).toBeVisible();

  const body = await response.json();

  return (body.data ?? []).map(
    (incident: { testCaseReference?: { fullyQualifiedName?: string } }) =>
      incident.testCaseReference?.fullyQualifiedName ?? ''
  );
};

test.describe(
  'Domain isolation - incident manager listing',
  { tag: ['@domain-isolation'] },
  () => {
    test.beforeAll(
      'Setup domain, tables, incidents and users',
      async ({ browser }) => {
        // test.slow() does not extend a hook's timeout, so set an explicit budget for creating the
        // entities and waiting for both incidents to be indexed.
        test.setTimeout(3 * 60 * 1000);

        const { apiContext, afterAction } = await performAdminLogin(browser);

        try {
          await Promise.all([
            adminUser.create(apiContext),
            noDomainUser.create(apiContext),
            tenant.create(apiContext),
            restrictedTable.create(apiContext),
            domainlessTable.create(apiContext),
          ]);

          await Promise.all([
            adminUser.setAdminRole(apiContext),
            // The role carries the domain policy; the empty domain list is the point of this spec —
            // the user is subject to hasDomain() but owns no domain, so only domainless assets are
            // theirs.
            assignDomainOnlyAccess(apiContext, noDomainUser, []),
            assignDomainToTable(
              apiContext,
              restrictedTable.entityResponseData?.id ?? '',
              tenant
            ),
          ]);

          // The table must carry its domain before the incident is indexed — the incident document
          // inherits its domains from the test case, which inherits them from the table.
          // seedFailedIncidents polls until each incident is searchable, so the assertions below
          // never race Elasticsearch.
          const [[restrictedTestCase], [domainlessTestCase]] =
            await Promise.all([
              seedFailedIncidents({
                apiContext,
                table: restrictedTable,
                count: 1,
              }),
              seedFailedIncidents({
                apiContext,
                table: domainlessTable,
                count: 1,
              }),
            ]);

          restrictedTestCaseName = restrictedTestCase['name'] as string;
          restrictedTestCaseFqn = restrictedTestCase[
            'fullyQualifiedName'
          ] as string;
          domainlessTestCaseName = domainlessTestCase['name'] as string;
          domainlessTestCaseFqn = domainlessTestCase[
            'fullyQualifiedName'
          ] as string;

          await enableDisableSearchRBAC(apiContext, true);
        } finally {
          await afterAction();
        }
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await enableDisableSearchRBAC(apiContext, false);

        // Tables first: the domain is deleted once nothing references it any more.
        await Promise.all([
          safeDelete(() => restrictedTable.delete(apiContext)),
          safeDelete(() => domainlessTable.delete(apiContext)),
        ]);

        await Promise.all([
          safeDelete(() => tenant.delete(apiContext)),
          safeDelete(() => noDomainUser.delete(apiContext)),
          safeDelete(() => adminUser.delete(apiContext)),
        ]);
      } finally {
        await afterAction();
      }
    });

    test('user without a domain cannot see incidents belonging to a domain', async ({
      noDomainPage,
    }) => {
      const listedFqns = await openIncidentManager(noDomainPage);

      await test.step('the domained incident is withheld', async () => {
        expect(listedFqns).not.toContain(restrictedTestCaseFqn);

        await expect(
          noDomainPage
            .getByTestId('test-case-incident-manager-table')
            .getByRole('link', { name: restrictedTestCaseName })
        ).toHaveCount(0);
      });

      await test.step('the domainless incident is still listed', async () => {
        expect(listedFqns).toContain(domainlessTestCaseFqn);

        await expect(
          noDomainPage
            .getByTestId('test-case-incident-manager-table')
            .getByRole('link', { name: domainlessTestCaseName })
        ).toBeVisible();
      });
    });

    test('admin sees incidents from every domain', async ({ adminPage }) => {
      const listedFqns = await openIncidentManager(adminPage);

      expect(listedFqns).toContain(restrictedTestCaseFqn);
      expect(listedFqns).toContain(domainlessTestCaseFqn);
    });
  }
);
