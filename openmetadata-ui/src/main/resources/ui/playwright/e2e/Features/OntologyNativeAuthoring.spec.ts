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
import { SearchIndex } from '../../../src/enums/search.enum';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyAxiom } from '../../../src/generated/entity/data/ontologyAxiom';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyProperty } from '../../../src/generated/entity/data/ontologyProperty';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { TeamClass } from '../../support/team/TeamClass';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
  uuid,
} from '../../utils/common';
import {
  clickGraphNode,
  readGraphZoom,
  readNodePositions,
} from '../../utils/ontologyStudio';
import { waitForSearchIndexed } from '../../utils/polling';
const pick = async (page: Page, label: string, name: string) => {
  const input = page.getByRole('combobox', { name: label, exact: true });
  await input.fill(name);
  await page.getByRole('option', { name, exact: true }).click();
  await input.press('Escape');
};
test.use({ isolatedUserOptions: { isAdmin: true } });
test.describe(
  'Native class authoring',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('creates every class field atomically, preserves free space, and cancels provisional relations', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const team = new TeamClass();
      let ontology: Ontology | undefined;
      const concepts: OntologyConcept[] = [];
      const properties: OntologyProperty[] = [];
      const axioms: OntologyAxiom[] = [];
      try {
        const name = 'pw_class_authoring_' + uuid();
        ontology = await okJson<Ontology>(
          await api.post('/api/v1/ontologies', {
            data: {
              name,
              iri: 'urn:' + name,
              namespace: 'https://example.org/' + name + '#',
              layer: 'L2',
            },
          }),
          'Create authoring ontology'
        );
        const owner = ontology;
        await team.create(api);
        await waitForSearchIndexed(
          api,
          team.responseData.name,
          SearchIndex.TEAM,
          { matchBy: 'nameOrDisplayName' }
        );
        for (const name of ['Payment', 'Transaction', 'Person']) {
          concepts.push(
            await okJson<OntologyConcept>(
              await api.post('/api/v1/ontologyConcepts', {
                data: {
                  name,
                  ontology: owner.fullyQualifiedName,
                  conceptType: 'OWL_CLASS',
                  iri: owner.namespace + name,
                },
              }),
              'Create parent class'
            )
          );
        }
        await test.step('Open both scope-bound Add concept entry points', async () => {
          await page.goto('/governance/ontology?ontology=' + owner.id);
          await page.getByTestId('mode-tab-edit').click();
          await expect(
            page.getByTestId('ontology-canvas-add-concept')
          ).toBeVisible();
          await clickIgnoringToasts(
            page.getByTestId('ontology-canvas-add-concept')
          );
          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toBeVisible();
          await expect(page.getByTestId('new-class-create')).toBeDisabled();
          await page.getByTestId('ontology-new-class-close').click();
          await page.getByTestId('ontology-add-concept').click();
          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toBeVisible();
        });
        await test.step('Fill identity, axioms, three own property types, and governance', async () => {
          await page.getByTestId('new-class-label').fill('Funds Transfer');
          await expect(page.getByTestId('new-class-iri')).toHaveText(
            owner.namespace + 'FundsTransfer'
          );
          await page.getByTestId('new-class-synonyms').fill('Wire,');
          await page.getByTestId('new-class-synonyms').fill('Remittance');
          await page.getByTestId('new-class-synonyms').press('Enter');
          await page
            .getByTestId('new-class-description')
            .fill('Transfers funds between accounts.');
          await page
            .getByTestId('new-class-source')
            .fill('https://example.org/standard');
          await pick(page, 'Subclass of', 'Payment');
          await pick(page, 'Subclass of', 'Transaction');
          await expect(
            page.getByTestId('new-class-polyhierarchy')
          ).toBeVisible();
          await pick(page, 'Equivalent to', 'Payment');
          await pick(page, 'Disjoint with', 'Person');
          await page
            .getByRole('checkbox', { name: 'Abstract', exact: true })
            .check();
          await page.getByTestId('new-class-property-name').fill('reference');
          await page
            .getByRole('checkbox', { name: 'Identifier', exact: true })
            .check();
          await page.getByTestId('new-class-property-name').press('Enter');
          await page.getByTestId('new-class-property-name').fill('status');
          await page.getByRole('button', { name: /Type/ }).click();
          await page.getByRole('option', { name: 'enum', exact: true }).click();
          await page.getByTestId('new-class-enum-values').fill('Pending,');
          await expect(
            page.getByTestId('new-class-add-property')
          ).toBeDisabled();
          await page.getByTestId('new-class-enum-values').fill('Settled');
          await page.getByTestId('new-class-enum-values').press('Enter');
          await clickIgnoringToasts(page.getByTestId('new-class-add-property'));
          await page.getByTestId('new-class-property-name').fill('customer');
          await page.getByRole('button', { name: /Type/ }).click();
          await page
            .getByRole('option', { name: 'object', exact: true })
            .click();
          await page.getByRole('button', { name: /Range/ }).click();
          await page
            .getByRole('option', { name: 'Person', exact: true })
            .click();
          await clickIgnoringToasts(page.getByTestId('new-class-add-property'));
          await expect(
            page.getByRole('textbox', { name: /Layer/ })
          ).toHaveAttribute('readonly');
          await expect(
            page.getByRole('textbox', { name: /Layer/ })
          ).toHaveValue('L2 Industry');
          await pick(page, 'Owners', team.responseData.displayName);
        });
        await test.step('Apply one plan and verify persisted definitions and non-overlapping node', async () => {
          const applied = page.waitForResponse(
            (r) =>
              r.url().includes('/ontologyChangeSets/') &&
              r.url().endsWith('/apply') &&
              r.request().method() === 'POST'
          );
          await clickIgnoringToasts(page.getByTestId('new-class-create'));
          expect((await applied).status()).toBe(200);
          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toHaveCount(0);
          const response = await okJson<{ data: OntologyConcept[] }>(
            await api.get('/api/v1/ontologyConcepts', {
              params: {
                ontology: owner.fullyQualifiedName,
                fields: 'owners,superClasses',
              },
            }),
            'Read created class'
          );
          const created = response.data.find(
            (c) => c.iri === owner.namespace + 'FundsTransfer'
          );
          expect(created).toBeDefined();
          if (!created) {
            throw new Error('Created class missing');
          }
          concepts.push(created);
          expect(created).toMatchObject({
            displayName: 'Funds Transfer',
            abstract: true,
            synonyms: ['Wire', 'Remittance'],
            description: 'Transfers funds between accounts.',
            definitionSource: 'https://example.org/standard',
          });
          expect(created.superClasses).toEqual(
            expect.arrayContaining([concepts[0].iri, concepts[1].iri])
          );
          expect(created.owners).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: team.responseData.id,
                type: 'team',
              }),
            ])
          );
          const propertyResponse = await okJson<{ data: OntologyProperty[] }>(
            await api.get('/api/v1/ontologyProperties', {
              params: { ontology: owner.fullyQualifiedName },
            }),
            'Read own properties'
          );
          properties.push(...propertyResponse.data);
          expect(properties).toHaveLength(3);
          expect(properties.find((p) => p.name === 'reference')).toMatchObject({
            isIdentifier: true,
          });
          expect(
            properties
              .find((p) => p.name === 'status')
              ?.enumValues?.map((v) => v.value)
          ).toEqual(['Pending', 'Settled']);
          const axiomResponse = await okJson<{ data: OntologyAxiom[] }>(
            await api.get('/api/v1/ontologyAxioms', {
              params: { ontologyId: owner.id },
            }),
            'Read class axioms'
          );
          axioms.push(...axiomResponse.data);
          expect(axioms).toHaveLength(4);
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toContainText('Funds Transfer');
          const positions = await readNodePositions(page);
          const zoom = await readGraphZoom(page);
          const added = positions[created.id];
          expect(added).toBeDefined();
          for (const parent of concepts.filter((c) => c.id !== created.id)) {
            const existing = positions[parent.id];
            expect(existing).toBeDefined();
            expect(
              Math.abs(added.x - existing.x) > 150 * zoom ||
                Math.abs(added.y - existing.y) > 38 * zoom
            ).toBe(true);
          }
          await page.getByTestId('ontology-publication-trigger').click();
          await expect(
            page
              .getByTestId('ontology-working-concept-group')
              .filter({ hasText: 'Funds Transfer' })
          ).toContainText('Payment, Transaction · 3 properties');
          await page.keyboard.press('Escape');
        });
        await test.step('Cancel drawing from source and from the picker close control without persistence', async () => {
          const before = axioms.length;
          await clickGraphNode(page, concepts[0].id);
          const positions = await readNodePositions(page);
          const zoom = await readGraphZoom(page);
          const source = positions[concepts[0].id];
          await page.mouse.click(source.x + 75 * zoom, source.y);
          await expect(
            page.getByTestId('ontology-connect-instruction')
          ).toBeVisible();
          await page.mouse.click(source.x, source.y);
          await expect(
            page.getByTestId('ontology-connect-instruction')
          ).toHaveCount(0);
          await page.mouse.click(source.x + 75 * zoom, source.y);
          await page.mouse.click(
            positions[concepts[1].id].x,
            positions[concepts[1].id].y
          );
          await expect(
            page.getByTestId('relationship-type-picker')
          ).toBeVisible();
          await page.getByTestId('relation-type-cancel').click();
          await expect(
            page.getByTestId('relationship-type-picker')
          ).toHaveCount(0);
          const after = await okJson<{ data: OntologyAxiom[] }>(
            await api.get('/api/v1/ontologyAxioms', {
              params: { ontologyId: owner.id },
            }),
            'Read axioms after cancellation'
          );
          expect(after.data).toHaveLength(before);
          const afterProperties = await okJson<{ data: OntologyProperty[] }>(
            await api.get('/api/v1/ontologyProperties', {
              params: { ontology: owner.fullyQualifiedName },
            }),
            'Read properties after cancellation'
          );
          expect(afterProperties.data).toHaveLength(3);
        });
      } finally {
        for (const axiom of axioms.reverse()) {
          await deleteFixtureEntity(
            api,
            '/api/v1/ontologyAxioms/' + axiom.id + '?hardDelete=true'
          );
        }
        for (const property of properties.reverse()) {
          await deleteFixtureEntity(
            api,
            '/api/v1/ontologyProperties/' + property.id + '?hardDelete=true'
          );
        }
        for (const concept of concepts.reverse()) {
          await deleteFixtureEntity(
            api,
            '/api/v1/ontologyConcepts/' + concept.id + '?hardDelete=true'
          );
        }
        await team.delete(api);
        if (ontology) {
          await deleteFixtureEntity(
            api,
            '/api/v1/ontologies/' +
              ontology.id +
              '?recursive=true&hardDelete=true'
          );
        }
      }
    });
    test('a competing lease leaves no partial class and retains the same draft', async ({
      isolatedUserPage: page,
    }) => {
      const api = await getWorkerAdminAPIContext();
      const name = 'pw_class_lease_' + uuid();
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: { name, iri: 'urn:' + name, namespace: 'urn:' + name + ':' },
        }),
        'Create lease ontology'
      );
      let held:
        | { resourceId: string; resourceType: string; sessionId: string }
        | undefined;
      try {
        await page.route(
          '**/api/v1/ontologyEditLocks/acquire',
          async (route) => {
            const request = route.request().postDataJSON();
            held = {
              resourceId: request.resourceId,
              resourceType: request.resourceType,
              sessionId: uuid(),
            };
            const response = await api.post(
              '/api/v1/ontologyEditLocks/acquire',
              { data: { ...request, ...held } }
            );
            expect(response.status()).toBe(200);
            await route.continue();
          }
        );
        await page.goto('/governance/ontology?ontology=' + ontology.id);
        await page.getByTestId('mode-tab-edit').click();
        await page.getByTestId('ontology-add-concept').click();
        await page.getByTestId('new-class-label').fill('Contended Class');
        await clickIgnoringToasts(page.getByTestId('new-class-create'));
        await expect(
          page.getByTestId('ontology-new-class-panel')
        ).toContainText('This draft is locked by');
        await expect(
          page.getByRole('button', { name: 'Retry', exact: true })
        ).toBeVisible();
        const concepts = await okJson<{ data: OntologyConcept[] }>(
          await api.get('/api/v1/ontologyConcepts', {
            params: { ontology: ontology.fullyQualifiedName },
          }),
          'Read class after failed lease'
        );
        expect(concepts.data).toHaveLength(0);
        await page.getByTestId('mode-tab-view').click();
        await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
          'aria-selected',
          'true'
        );
      } finally {
        await page.unroute('**/api/v1/ontologyEditLocks/acquire');
        if (held) {
          const response = await api.delete(
            '/api/v1/ontologyEditLocks/' +
              held.resourceType +
              '/' +
              held.resourceId,
            { params: { sessionId: held.sessionId } }
          );
          expect(response.status()).toBe(200);
        }
        await deleteFixtureEntity(
          api,
          '/api/v1/ontologies/' +
            ontology.id +
            '?recursive=true&hardDelete=true'
        );
      }
    });
  }
);
