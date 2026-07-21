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
import { VIEW_ONLY_RULE } from '../../constant/permission';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { OntologyRdfFixture } from '../../support/ontology/OntologyRdfFixture';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { navigateToOntologyExplorer } from '../../utils/ontologyExplorer';
import { performUserLogin } from '../../utils/user';

const suffix = uuid().replaceAll('-', '');
const fixture = new OntologyRdfFixture(`pw_rbac_${suffix}`);
const lockFixture = new OntologyRdfFixture(`pw_lock_${suffix}`);
const reader = new UserClass();
const readerPolicy = new PolicyClass();
const readerRole = new RolesClass();
const steward = new UserClass();
let term: GlossaryTerm;
let readerTeam: TeamClass;

test.describe('Ontology RDF authorization', { tag: ['@ontology-rdf'] }, () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await fixture.create(apiContext);
      term = await fixture.createTerm(apiContext, `AuthorizedTerm${suffix}`);
      await lockFixture.create(apiContext);
      await lockFixture.createTerm(apiContext, `ContendedTerm${suffix}`);
      await reader.create(apiContext, false);
      await readerPolicy.create(apiContext, VIEW_ONLY_RULE);
      await readerRole.create(apiContext, [readerPolicy.responseData.name]);
      readerTeam = new TeamClass({
        defaultRoles: readerRole.responseData.id
          ? [readerRole.responseData.id]
          : [],
        description: `Ontology reader team ${suffix}`,
        displayName: `Ontology reader ${suffix}`,
        name: `pw_ontology_reader_${suffix}`,
        teamType: 'Group',
        users: [reader.responseData.id],
      });
      await readerTeam.create(apiContext);
      await steward.create(apiContext);
      await steward.setDataStewardRole(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await fixture.delete(apiContext);
      await lockFixture.delete(apiContext);
      await readerTeam.delete(apiContext);
      await reader.delete(apiContext);
      await readerRole.delete(apiContext);
      await readerPolicy.delete(apiContext);
      await steward.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('shows read/query/library routes but removes authoring for a read-only user', async ({
    browser,
  }) => {
    const { page, afterAction } = await performUserLogin(browser, reader);

    try {
      await navigateToOntologyExplorer(page);
      await fixture.selectInStudio(page);

      await expect(page.getByTestId('mode-tab-view')).toBeVisible();
      await expect(page.getByTestId('mode-tab-query')).toBeVisible();
      await expect(page.getByTestId('mode-tab-library')).toBeVisible();
      await expect(page.getByTestId('mode-tab-edit')).toBeHidden();

      await page.getByTestId('mode-tab-library').click();
      await expect(page.getByTestId('ontology-pack-catalogue')).toBeVisible();
      await page.getByTestId('ontology-pack-details-fibo').click();
      await expect(page.getByTestId('ontology-pack-detail')).toBeVisible();
      await expect(
        page.getByTestId('ontology-module-foundations')
      ).toBeDisabled();
      await expect(page.getByTestId('ontology-pack-dry-run')).toBeHidden();
      await expect(page.getByTestId('ontology-pack-install')).toBeHidden();
    } finally {
      await afterAction();
    }
  });

  test('allows a steward to acquire the glossary authoring lease', async ({
    browser,
  }) => {
    const { page, afterAction } = await performUserLogin(browser, steward);

    try {
      await navigateToOntologyExplorer(page);
      await fixture.selectInStudio(page);
      await expect(page.getByTestId('mode-tab-edit')).toBeVisible();
      await page.getByTestId('mode-tab-edit').click();
      await expect(
        page.getByTestId('ontology-edit-lease-status')
      ).toContainText('Active');
    } finally {
      await afterAction();
    }
  });

  test('keeps every authoring mutation read-only while another user owns the lease', async ({
    browser,
  }) => {
    const adminSessionId = `pw-admin-${uuid()}`;
    const admin = await performAdminLogin(browser);
    const stewardSession = await performUserLogin(browser, steward);

    try {
      const acquireResponse = await admin.apiContext.post(
        '/api/v1/ontologyEditLocks/acquire',
        {
          data: {
            leaseSeconds: 60,
            resourceId: lockFixture.glossary.responseData.id,
            resourceType: 'glossary',
            sessionId: adminSessionId,
          },
        }
      );
      expect(acquireResponse.ok(), await acquireResponse.text()).toBe(true);

      await navigateToOntologyExplorer(stewardSession.page);
      await lockFixture.selectInStudio(stewardSession.page);
      await stewardSession.page.getByTestId('mode-tab-edit').click();
      const leaseStatus = stewardSession.page.getByTestId(
        'ontology-edit-lease-status'
      );
      await expect(
        leaseStatus.getByRole('button', { name: 'Retry' })
      ).toBeVisible();
    } finally {
      await admin.apiContext.delete(
        `/api/v1/ontologyEditLocks/glossary/${lockFixture.glossary.responseData.id}`,
        { params: { sessionId: adminSessionId } }
      );
      await stewardSession.afterAction();
      await admin.afterAction();
    }
  });

  test('permits scoped queries but denies the read-only user full-graph endpoint', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performUserLogin(browser, reader);

    try {
      const scopedResponse = await apiContext.post(
        `/api/v1/glossaries/${fixture.glossary.responseData.id}/sparql`,
        {
          data: { query: 'ASK { ?subject ?predicate ?object }' },
        }
      );
      const fullGraphResponse = await apiContext.post('/api/v1/rdf/sparql', {
        data: { query: 'ASK { ?subject ?predicate ?object }' },
      });

      expect(scopedResponse.ok()).toBe(true);
      expect(fullGraphResponse.status()).toBe(403);
    } finally {
      await afterAction();
    }
  });

  test('content-negotiates an authenticated LOD redirect and rejects anonymous access', async ({
    browser,
    request,
  }) => {
    const { apiContext, afterAction } = await performUserLogin(browser, reader);
    const path = `/api/v1/lod/entity/glossaryTerm/${term.responseData.id}`;

    try {
      const authorizedResponse = await apiContext.get(path, {
        headers: { Accept: 'text/turtle' },
        maxRedirects: 0,
      });
      const anonymousResponse = await request.get(path, {
        headers: { Accept: 'text/turtle' },
        maxRedirects: 0,
      });

      expect(authorizedResponse.status()).toBe(303);
      expect(authorizedResponse.headers().location).toContain(
        `/api/v1/rdf/entity/glossaryTerm/${term.responseData.id}?format=turtle`
      );
      expect(authorizedResponse.headers().vary).toContain('Accept');
      expect(anonymousResponse.status()).toBe(401);
    } finally {
      await afterAction();
    }
  });
});
