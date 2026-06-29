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
import { APIRequestContext, Page } from '@playwright/test';
import { Domain } from '../support/domain/Domain';
import { UserClass } from '../support/user/UserClass';

// Issue #24180 — the seeded DomainOnlyAccessRole isolates a user to their assigned
// domains (plus sub-domains and domainless entities). These helpers centralise the
// role + domain binding and domain assignment used across the isolation specs.
export const DOMAIN_ONLY_ACCESS_ROLE = 'DomainOnlyAccessRole';

export const assignDomainOnlyAccess = async (
  apiContext: APIRequestContext,
  user: UserClass,
  domains: Domain[]
) => {
  const roleResponse = await apiContext.get(
    `/api/v1/roles/name/${DOMAIN_ONLY_ACCESS_ROLE}`
  );
  const domainOnlyRole = await roleResponse.json();

  await user.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/roles/-',
        value: {
          id: domainOnlyRole.id,
          type: 'role',
          name: domainOnlyRole.name,
        },
      },
      {
        op: 'add',
        path: '/domains',
        value: domains.map((domain) => ({
          id: domain.responseData.id,
          type: 'domain',
          name: domain.responseData.name,
          fullyQualifiedName: domain.responseData.fullyQualifiedName,
        })),
      },
    ],
  });
};

export const assignDomainToTable = async (
  apiContext: APIRequestContext,
  tableId: string,
  domain: Domain
) => {
  await apiContext.patch(`/api/v1/tables/${tableId}`, {
    data: [
      {
        op: 'add',
        path: '/domains',
        value: [
          {
            id: domain.responseData.id,
            type: 'domain',
            name: domain.responseData.name,
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        ],
      },
    ],
    headers: { 'Content-Type': 'application/json-patch+json' },
  });
};

export const safeDelete = async (deleteFn: () => Promise<unknown>) => {
  try {
    await deleteFn();
  } catch (error) {
    // Best-effort teardown: one failing delete should not block the rest.
  }
};

const waitForDomainSearch = (page: Page, domain: Domain) =>
  page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(encodeURIComponent(domain.data.name))
  );

// The admin-facing domain views (navbar dropdown tree and the domains listing page) are
// server-side paginated over every domain, so a freshly created domain can land off the
// first page in a busy environment. Searching by name scopes the view to the target
// domain before asserting, keeping the admin isolation specs deterministic.
export const searchDomainInDropdownTree = async (
  page: Page,
  domain: Domain
) => {
  const searchResponse = waitForDomainSearch(page, domain);
  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.data.name);
  await searchResponse;
};

// The domains listing search box rewrites the typed term before issuing the request, so the
// encoded name is not a substring of the URL. Match the domain search request loosely (by
// index) instead, mirroring the established selectDomain helper.
export const searchDomainInListing = async (page: Page, domain: Domain) => {
  const searchResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=domain*'
  );
  await page
    .getByTestId('page-layout-v1')
    .getByPlaceholder('Search')
    .fill(domain.data.name);
  await searchResponse;
};
