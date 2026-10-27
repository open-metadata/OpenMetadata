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
import {
  AxiomType,
  CreateOntologyAxiom,
  ExpressionKind,
  Provenance,
} from '../../../src/generated/api/data/createOntologyAxiom';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyConceptBindingsResponse } from '../../../src/generated/type/ontologyConceptBindingsResponse';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';

const TABLES_ON_CUSTOMER = 150;
const COLLAPSED_ROWS = 4;
const CREATE_BATCH = 10;

test.use({ isolatedUserOptions: { isAdmin: true } });

const createConcept = async (
  api: APIRequestContext,
  ontology: Ontology,
  name: string
) =>
  okJson<OntologyConcept>(
    await api.post('/api/v1/ontologyConcepts', {
      data: {
        name,
        ontology: ontology.fullyQualifiedName,
        conceptType: 'OWL_CLASS',
      },
    }),
    `Create ${name}`
  );

const createTables = async (api: APIRequestContext, count: number) => {
  const tables: TableClass[] = [];
  for (let start = 0; start < count; start += CREATE_BATCH) {
    const batch = Array.from(
      { length: Math.min(CREATE_BATCH, count - start) },
      () => new TableClass({ name: `pw_data_mode_${uuid()}` })
    );
    await Promise.all(batch.map((table) => table.create(api)));
    tables.push(...batch);
  }

  return tables;
};

const bindTables = async (
  api: APIRequestContext,
  concept: OntologyConcept,
  tables: TableClass[]
) => {
  let revision = 0;
  for (const table of tables) {
    const response = await okJson<OntologyConceptBindingsResponse>(
      await api.put(`/api/v1/ontologyConcepts/${concept.id}/bindings`, {
        data: {
          expectedRevision: revision,
          asset: {
            assetType: 'table',
            assetId: table.entityResponseData.id,
            columns: [],
          },
        },
      }),
      `Bind a table to ${concept.name}`
    );
    revision = response.revision;
  }
};

test.describe(
  'Native ontology Data mode',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('pages a 150-table cluster and joins only related concepts', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const name = `pw_native_data_mode_${uuid()}`;
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: { name, iri: `urn:${name}`, namespace: `urn:${name}:` },
        }),
        'Create Data mode ontology'
      );
      const tables: TableClass[] = [];
      try {
        const customer = await createConcept(api, ontology, 'Customer');
        const party = await createConcept(api, ontology, 'Party');
        const unrelated = await createConcept(api, ontology, 'Unrelated');
        const axiom: CreateOntologyAxiom = {
          name: 'CustomerParents',
          displayName: 'Customer parents',
          description: 'Data mode fixture hierarchy',
          ontology: ontology.fullyQualifiedName,
          axiomType: AxiomType.SubclassOf,
          subjectIri: customer.iri,
          expressions: [
            { kind: ExpressionKind.NamedClass, classIri: party.iri },
          ],
          provenance: Provenance.Manual,
        };
        await okJson(
          await api.post('/api/v1/ontologyAxioms', { data: axiom }),
          'Relate Customer to Party'
        );

        const customerTables = await createTables(api, TABLES_ON_CUSTOMER);
        const partyTables = await createTables(api, 1);
        const unrelatedTables = await createTables(api, 1);
        tables.push(...customerTables, ...partyTables, ...unrelatedTables);
        await bindTables(api, customer, customerTables);
        await bindTables(api, party, partyTables);
        await bindTables(api, unrelated, unrelatedTables);

        await page.goto(`/governance/ontology?ontology=${ontology.id}`);
        await page.getByTestId('ontology-graph-mode-data').click();
        const graph = page.getByTestId('ontology-native-data-graph');
        const customerCard = graph.getByTestId(
          `ontology-data-cluster-${customer.id}`
        );
        const customerRows = customerCard.getByTestId(
          /^ontology-data-asset-asset:/
        );

        await test.step('Show a bounded preview of the large cluster', async () => {
          await expect(
            customerCard.getByTestId('ontology-data-cluster-count')
          ).toContainText(String(TABLES_ON_CUSTOMER));
          await expect(customerRows).toHaveCount(COLLAPSED_ROWS);
          await expect(
            graph.getByTestId(`ontology-data-cluster-${party.id}`)
          ).toBeVisible();
          await expect(
            graph.getByTestId(`ontology-data-cluster-${unrelated.id}`)
          ).toBeVisible();
        });

        await test.step('Page more assets into the cluster', async () => {
          const bindingsPage = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                `/api/v1/ontologies/${ontology.id}/dataGraph/pages` &&
              response.request().method() === 'POST' &&
              response.request().postData()?.includes('"kind":"bindings"') ===
                true
          );
          await customerCard
            .getByTestId(`ontology-load-more-assets-${customer.id}`)
            .click();
          expect((await bindingsPage).ok()).toBe(true);
          await expect
            .poll(() => customerRows.count())
            .toBeGreaterThan(COLLAPSED_ROWS);
          await expect(customerRows).not.toHaveCount(TABLES_ON_CUSTOMER);
        });

        await test.step('Draw a real service logo on every loaded row', async () => {
          const rowCount = await customerRows.count();
          await expect(customerRows.locator('img')).toHaveCount(rowCount);
          const loaded = await customerRows
            .locator('img')
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  image instanceof HTMLImageElement &&
                  image.complete &&
                  image.naturalWidth > 0
              )
            );
          expect(loaded).toBe(true);
        });

        await test.step('Join only the related concepts', async () => {
          const inferred = graph.locator(
            '[data-testid="ontology-data-semantic-edge"][data-edge-kind="semanticProjection"]'
          );
          await expect(inferred).toHaveCount(1);
          await expect(
            graph.getByTestId('ontology-data-legend-inferred')
          ).toBeVisible();
          await expect(
            graph.getByTestId('ontology-data-semantic-edge-label')
          ).toHaveCount(1);
        });
      } finally {
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true&hardDelete=true`
        );
        for (const table of tables) {
          await table.delete(api);
        }
      }
    });
  }
);
