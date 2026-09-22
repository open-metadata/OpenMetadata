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

import { APIRequestContext } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { OntologyRdfFixture } from '../../support/ontology/OntologyRdfFixture';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import {
  navigateToOntologyStudio,
  readNodePositions,
  releaseOntologyEditLease,
  waitForGraphLoaded,
} from '../../utils/ontologyStudio';

const suffix = uuid().replaceAll('-', '');
const fixture = new OntologyRdfFixture(`pw_realization_${suffix}`);
const operationalTable = new TableClass();
const warehouseTable = new TableClass();

let customer: GlossaryTerm;
let unrealizedConcept: GlossaryTerm;

const assetReference = (table: TableClass) => ({
  id: table.entityResponseData.id,
  type: 'table',
  name: table.entityResponseData.name,
  fullyQualifiedName: table.entityResponseData.fullyQualifiedName,
});

const setRealizations = (
  realizations: { asset: ReturnType<typeof assetReference>; role: string }[]
) => [{ op: 'add', path: '/realizedIn', value: realizations }];

const readRealizations = async (
  apiContext: APIRequestContext,
  term: GlossaryTerm
) => {
  const response = await apiContext.get(
    `/api/v1/glossaryTerms/${term.responseData.id}?fields=realizedIn`
  );

  expect(response.ok(), await response.text()).toBe(true);

  const body = await response.json();

  return (body.realizedIn ?? []) as {
    asset: { id: string; name: string };
    role: string;
  }[];
};

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.configure({ mode: 'serial' });

test.describe(
  'Ontology concept realization',
  { tag: ['@ontology-rdf'] },
  () => {
    test.beforeAll(
      'Seed concepts and the assets realizing them',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await fixture.create(apiContext);
        await operationalTable.create(apiContext);
        await warehouseTable.create(apiContext);

        customer = await fixture.createTerm(apiContext, `Customer${suffix}`);
        unrealizedConcept = await fixture.createTerm(
          apiContext,
          `Prospect${suffix}`
        );
        await customer.patch(
          apiContext,
          setRealizations([
            { asset: assetReference(operationalTable), role: 'PRIMARY_STORE' },
            { asset: assetReference(warehouseTable), role: 'DERIVED' },
          ])
        );

        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await fixture.delete(apiContext);
      await operationalTable.delete(apiContext);
      await warehouseTable.delete(apiContext);
      await afterAction();
    });

    test('a concept keeps one store of record alongside a derived copy', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const realizations = await readRealizations(apiContext, customer);
        const roleByAssetId = Object.fromEntries(
          realizations.map((realization) => [
            realization.asset.id,
            realization.role,
          ])
        );

        expect(realizations).toHaveLength(2);
        expect(roleByAssetId[operationalTable.entityResponseData.id]).toBe(
          'PRIMARY_STORE'
        );
        expect(roleByAssetId[warehouseTable.entityResponseData.id]).toBe(
          'DERIVED'
        );
      } finally {
        await afterAction();
      }
    });

    test('a second store of record is rejected', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const response = await apiContext.patch(
          `/api/v1/glossaryTerms/${customer.responseData.id}`,
          {
            data: setRealizations([
              {
                asset: assetReference(operationalTable),
                role: 'PRIMARY_STORE',
              },
              { asset: assetReference(warehouseTable), role: 'PRIMARY_STORE' },
            ]),
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );

        expect(response.status()).toBe(400);
        expect(await response.text()).toContain('PRIMARY_STORE');

        // The rejected patch leaves the stored realizations untouched.
        const realizations = await readRealizations(apiContext, customer);

        expect(realizations).toHaveLength(2);
      } finally {
        await afterAction();
      }
    });

    test('the same asset cannot be listed twice for one concept', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const response = await apiContext.patch(
          `/api/v1/glossaryTerms/${customer.responseData.id}`,
          {
            data: setRealizations([
              {
                asset: assetReference(operationalTable),
                role: 'PRIMARY_STORE',
              },
              { asset: assetReference(operationalTable), role: 'DERIVED' },
            ]),
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );

        expect(response.status()).toBe(400);
        expect(await response.text()).toContain('more than once');
      } finally {
        await afterAction();
      }
    });

    test('a replica is accepted alongside the store of record', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const replicaConcept = await fixture.createTerm(
          apiContext,
          `Replicated${suffix}`
        );
        await replicaConcept.patch(
          apiContext,
          setRealizations([
            { asset: assetReference(operationalTable), role: 'PRIMARY_STORE' },
            { asset: assetReference(warehouseTable), role: 'REPLICA' },
          ])
        );

        const roles = (await readRealizations(apiContext, replicaConcept))
          .map((realization) => realization.role)
          .sort();

        expect(roles).toEqual(['PRIMARY_STORE', 'REPLICA']);
      } finally {
        await afterAction();
      }
    });

    /**
     * A soft delete is reversible, so the realization survives and the asset reference reports the
     * deletion. A hard delete is not, so the edge goes with the asset.
     */
    test('an asset deletion is reflected in the realizations that referenced it', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      const disposableTable = new TableClass();

      try {
        await disposableTable.create(apiContext);
        const concept = await fixture.createTerm(
          apiContext,
          `Disposable${suffix}`
        );
        await concept.patch(
          apiContext,
          setRealizations([
            { asset: assetReference(disposableTable), role: 'PRIMARY_STORE' },
          ])
        );

        await apiContext.delete(
          `/api/v1/tables/${disposableTable.entityResponseData.id}?hardDelete=false&recursive=false`
        );

        const afterSoftDelete = await readRealizations(apiContext, concept);

        expect(afterSoftDelete, 'a soft delete keeps the edge').toHaveLength(1);
        expect(
          (afterSoftDelete[0].asset as { deleted?: boolean }).deleted
        ).toBe(true);

        await apiContext.delete(
          `/api/v1/tables/${disposableTable.entityResponseData.id}?hardDelete=true&recursive=true`
        );

        await expect
          .poll(
            async () => (await readRealizations(apiContext, concept)).length,
            { timeout: 30_000, intervals: [2_000] }
          )
          .toBe(0);
      } finally {
        await afterAction();
      }
    });

    test('realizations are searchable by role on the glossary term index', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const queryFilter = JSON.stringify({
          query: {
            nested: {
              path: 'realizedIn',
              query: { term: { 'realizedIn.role': 'PRIMARY_STORE' } },
            },
          },
        });

        await expect
          .poll(
            async () => {
              const response = await apiContext.get(
                `/api/v1/search/query?q=*&index=glossary_term_search_index&from=0&size=25&query_filter=${encodeURIComponent(
                  queryFilter
                )}`
              );
              if (!response.ok()) {
                return [];
              }
              const body = await response.json();

              return (body.hits?.hits ?? []).map(
                (hit: { _source: { id: string } }) => hit._source.id
              );
            },
            { timeout: 90_000, intervals: [3_000] }
          )
          .toContain(customer.responseData.id);
      } finally {
        await afterAction();
      }
    });

    test('the realization is projected into the knowledge graph as om:mappedTo', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const termUri = `https://open-metadata.org/entity/glossaryTerm/${customer.responseData.id}`;
        const assetUri = `https://open-metadata.org/entity/table/${operationalTable.entityResponseData.id}`;
        // Triples land in the knowledge named graph; the default graph stays empty, so an
        // unscoped pattern would silently match nothing.
        const query = `SELECT ?o WHERE { GRAPH ?g { <${termUri}> <https://open-metadata.org/ontology/mappedTo> ?o } }`;

        // The RDF mirror is written asynchronously after the entity commits.
        await expect
          .poll(
            async () => {
              const response = await apiContext.post('/api/v1/rdf/sparql', {
                data: { query },
              });
              if (!response.ok()) {
                return [];
              }
              const body = await response.json();

              return (body.results?.bindings ?? []).map(
                (binding: { o: { value: string } }) => binding.o.value
              );
            },
            { timeout: 90_000, intervals: [2_000] }
          )
          .toContain(assetUri);
      } finally {
        await afterAction();
      }
    });

    test('the inspector lists each realizing asset with its role', async ({
      page,
    }) => {
      await navigateToOntologyStudio(page);
      await fixture.selectInStudio(page);
      await page.getByTestId('mode-tab-edit').click();
      await expect(
        page.getByTestId('ontology-edit-lease-status')
      ).toContainText('Active');
      await waitForGraphLoaded(page);

      const positions = await readNodePositions(page);
      const position = positions[customer.responseData.id];
      expect(position).toBeDefined();
      await page.mouse.click(position.x, position.y);

      await expect(
        page.getByTestId('ontology-authoring-inspector')
      ).toBeVisible();
      await expect(page.getByTestId('ontology-realizations')).toBeVisible();
      await expect(
        page.getByTestId(
          `concept-realization-${operationalTable.entityResponseData.name}`
        )
      ).toContainText('Primary Store');
      await expect(
        page.getByTestId(
          `concept-realization-${warehouseTable.entityResponseData.name}`
        )
      ).toContainText('Derived Copy');

      await releaseOntologyEditLease(page, fixture.glossary.responseData.id);
    });

    test('a concept with no realizing asset explains the empty state', async ({
      page,
    }) => {
      await navigateToOntologyStudio(page);
      await fixture.selectInStudio(page);
      await page.getByTestId('mode-tab-edit').click();
      // The graph only accepts node clicks once edit mode holds the authoring lease.
      await expect(
        page.getByTestId('ontology-edit-lease-status')
      ).toContainText('Active');
      await waitForGraphLoaded(page);

      const positions = await readNodePositions(page);
      const position = positions[unrealizedConcept.responseData.id];
      expect(position).toBeDefined();
      await page.mouse.click(position.x, position.y);

      await expect(
        page.getByTestId('ontology-authoring-inspector')
      ).toBeVisible();

      const realizations = page.getByTestId('ontology-realizations');
      await expect(realizations).toBeVisible();
      await expect(realizations).toContainText('No data asset');

      await releaseOntologyEditLease(page, fixture.glossary.responseData.id);
    });
  }
);
