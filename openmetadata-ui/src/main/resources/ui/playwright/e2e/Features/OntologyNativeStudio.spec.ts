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

import { SearchIndex } from '../../../src/enums/search.enum';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyAxiom } from '../../../src/generated/entity/data/ontologyAxiom';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyProperty } from '../../../src/generated/entity/data/ontologyProperty';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
  scrollIntoViewAndSettle,
  selectOptionWithRetry,
  uuid,
} from '../../utils/common';
import {
  clickGraphNode,
  readGraphEdges,
  readNodePositions,
} from '../../utils/ontologyStudio';
import { waitForSearchIndexed } from '../../utils/polling';

test.use({ isolatedUserOptions: { isAdmin: true } });

test.describe(
  'Native Ontology Studio',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('explores all native ontologies and chooses a publication owner', async ({
      isolatedUserPage: page,
    }) => {
      const api = await getWorkerAdminAPIContext();
      const ontologies: Ontology[] = [];
      const concepts: OntologyConcept[] = [];
      try {
        for (const suffix of ['sales', 'finance']) {
          const name = `pw_native_entry_${suffix}_${uuid()}`;
          const ontology = await okJson<Ontology>(
            await api.post('/api/v1/ontologies', {
              data: { name, iri: `urn:${name}`, namespace: `urn:${name}:` },
            }),
            'Create native entry fixture'
          );
          ontologies.push(ontology);
          concepts.push(
            await okJson<OntologyConcept>(
              await api.post('/api/v1/ontologyConcepts', {
                data: {
                  name: 'EntryConcept',
                  ontology: ontology.fullyQualifiedName,
                  conceptType: 'OWL_CLASS',
                },
              }),
              'Create native concept fixture'
            )
          );
        }
        await test.step('Explore the native aggregate and open the concept owner', async () => {
          await page.goto('/governance/ontology');
          await expect(
            page.getByTestId('ontology-scope-menu-trigger')
          ).toHaveAttribute('data-scope-key', 'ontology:all');
          await expect(page.getByTestId('all-ontologies-graph')).toBeVisible();
          await expect(page.getByTestId('mode-tab-edit')).toBeVisible();
          await expect(
            page.getByTestId('ontology-library-trigger')
          ).toBeVisible();
          await page.getByTestId('submode-tab-tree').click();
          const owner = ontologies[1];
          await page
            .getByTestId('ontology-tree-term-' + concepts[1].id)
            .click();
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toContainText(concepts[1].iri);
          await page.getByTestId('submode-tab-graph').click();
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toContainText(concepts[1].iri);
          await page.getByTestId('mode-tab-edit').click();
          await expect(page).toHaveURL(new RegExp('concept=' + concepts[1].id));
          await expect(page).toHaveURL(new RegExp('ontology=' + owner.id));
        });
        await test.step('Choose the publication target from the default route', async () => {
          await page.goto('/governance/ontology');
          await page.getByTestId('ontology-publication-trigger').click();
          await expect(
            page.getByTestId('ontology-publication-picker')
          ).toBeVisible();
          await page
            .getByTestId('ontology-publication-select-' + ontologies[0].id)
            .click();
          await expect(
            page.getByTestId('ontology-publication-modal')
          ).toContainText(ontologies[0].name);
          await expect(
            page.getByTestId('ontology-publication-tab-changes')
          ).toBeVisible();
          await page.getByTestId('ontology-publication-tab-releases').click();
          await expect(
            page.getByTestId('ontology-publication-tab-releases')
          ).toHaveAttribute('aria-selected', 'true');
        });
        await test.step('Choose another publication owner without changing the workspace', async () => {
          await page.keyboard.press('Escape');
          await expect(
            page.getByTestId('ontology-publication-modal')
          ).toHaveCount(0);
          await page.getByTestId('ontology-publication-trigger').click();
          await page
            .getByTestId('ontology-publication-select-' + ontologies[1].id)
            .click();
          await expect(
            page.getByTestId('ontology-publication-modal')
          ).toContainText(ontologies[1].name);
          await expect(
            page.getByTestId('ontology-publication-modal')
          ).not.toContainText(ontologies[0].name);
          await expect(
            page.getByTestId('ontology-scope-menu-trigger')
          ).toHaveAttribute('data-scope-key', 'ontology:all');
        });
        await test.step('Keep the explicit glossary experience available', async () => {
          await page.goto('/governance/ontology?scope=glossary:all');
          await expect(
            page.getByTestId('ontology-scope-menu-trigger')
          ).toHaveAttribute('data-scope-key', 'glossary:all');
          await expect(
            page.getByTestId('ontology-library-trigger')
          ).toBeVisible();
        });
      } finally {
        for (const ontology of ontologies)
          await deleteFixtureEntity(
            api,
            '/api/v1/ontologies/' +
              ontology.id +
              '?recursive=true&hardDelete=true'
          );
      }
    });

    test('authors a native model through the shared View, Edit, and Query shell', async ({
      isolatedUserPage: page,
      freshUserPage: { user: reviewer },
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const name = `pw_native_studio_${uuid()}`;
      let ontology: Ontology | undefined;

      try {
        await waitForSearchIndexed(
          api,
          reviewer.responseData.name,
          SearchIndex.USER,
          {
            matchBy: 'nameOrDisplayName',
          }
        );
        await test.step('Create a native ontology from the shared scope menu', async () => {
          await page.goto('/governance/ontology');
          await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
          await page.getByTestId('ontology-scope-menu-trigger').click();
          await page.getByTestId('ontology-create').click();

          const form = page.getByTestId('ontology-create-form');
          await form
            .getByRole('textbox', { name: 'Name', exact: true })
            .fill(name);
          await form
            .getByRole('textbox', { name: 'Ontology IRI', exact: true })
            .fill(`urn:${name}`);
          await form
            .getByRole('textbox', { name: 'Namespace', exact: true })
            .fill('relative/path');
          await form.getByRole('button', { name: 'Save', exact: true }).click();
          await expect(form).toContainText('Enter a valid concept IRI.');
          await form
            .getByRole('textbox', { name: 'Namespace', exact: true })
            .fill(`urn:${name}:`);
          const reviewers = form.getByRole('combobox', {
            name: 'Reviewers',
            exact: true,
          });
          await reviewers.fill(reviewer.responseData.name);
          await page
            .getByRole('option')
            .filter({
              hasText:
                reviewer.responseData.displayName ?? reviewer.responseData.name,
            })
            .click();
          await reviewers.press('Escape');
          const created = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/v1/ontologies' &&
              response.request().method() === 'POST'
          );
          await form.getByRole('button', { name: 'Save', exact: true }).click();
          ontology = await okJson<Ontology>(
            await created,
            'Create ontology in Studio'
          );
          expect(ontology.reviewers).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ id: reviewer.responseData.id }),
            ])
          );
          expect(ontology.owners).toHaveLength(1);

          await expect(page).toHaveURL(
            new RegExp(`[?&]ontology=${ontology.id}(?:&|$)`)
          );
          await expect(
            page.getByTestId('ontology-scope-menu-trigger')
          ).toHaveAttribute('data-scope-key', `ontology:${ontology.id}`);
          await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          await expect(page.getByTestId('mode-tab-edit')).toBeVisible();
          await expect(page.getByTestId('mode-tab-query')).toBeVisible();
          await expect(page.getByTestId('mode-tab-model')).toHaveCount(0);
          await expect(page.getByTestId('mode-tab-releases')).toHaveCount(0);
        });

        const [customer, party] =
          await test.step('Create concepts without leaving the graph', async () => {
            await page.getByTestId('mode-tab-edit').click();
            await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
              'aria-selected',
              'true'
            );

            const createConcept = async (
              conceptName: string,
              description: string
            ) => {
              await page.getByTestId('ontology-add-concept').click();
              const editor = page.getByTestId('ontology-concept-editor');
              await editor
                .getByRole('textbox', { name: 'Name', exact: true })
                .fill(conceptName);
              await editor
                .getByRole('textbox', { name: 'Description', exact: true })
                .fill(description);
              const response = page.waitForResponse(
                (candidate) =>
                  new URL(candidate.url()).pathname ===
                    '/api/v1/ontologyConcepts' &&
                  candidate.request().method() === 'POST'
              );
              await editor
                .getByRole('button', { name: 'Save', exact: true })
                .click();

              return okJson<OntologyConcept>(
                await response,
                `Create ${conceptName} in Studio`
              );
            };

            const customer = await createConcept(
              'Customer',
              'A person who buys.'
            );
            const party = await createConcept(
              'Party',
              'A person or organization.'
            );
            await expect(
              page.getByTestId('ontology-publication-trigger')
            ).toContainText('(3)');
            const positions = await readNodePositions(page);
            expect(positions).toEqual(
              expect.objectContaining({
                [customer.id]: expect.any(Object),
                [party.id]: expect.any(Object),
              })
            );
            expect(
              await page
                .locator('.ontology-g6-container')
                .evaluate((element) => element.getBoundingClientRect().left)
            ).toBe(
              await page
                .getByTestId('ontology-studio-shell')
                .evaluate((element) => element.getBoundingClientRect().left)
            );

            return [customer, party] as const;
          });

        await test.step('Author a property and hierarchy from the concept inspector', async () => {
          await clickGraphNode(page, customer.id);
          const inspector = page.getByTestId('ontology-concept-inspector');
          await expect(inspector).toContainText('A person who buys.');

          await inspector.getByTestId('ontology-add-property').click();
          await inspector
            .getByTestId('ontology-property-name')
            .fill('customerNumber');
          await inspector.getByTestId('ontology-property-type-integer').click();
          await inspector.getByTestId('ontology-property-identifier').click();
          const propertyCreated = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                '/api/v1/ontologyProperties' &&
              response.request().method() === 'POST'
          );
          await clickIgnoringToasts(
            inspector.getByTestId('ontology-property-submit')
          );
          const property = await okJson<OntologyProperty>(
            await propertyCreated,
            'Create an inspector data property'
          );
          expect(property).toEqual(
            expect.objectContaining({
              domain: [customer.iri],
              isIdentifier: true,
              kind: 'DATA',
              range: ['http://www.w3.org/2001/XMLSchema#integer'],
            })
          );
          await expect(
            page.getByTestId('ontology-publication-trigger')
          ).toContainText('(4)');
          await expect(
            inspector.getByTestId('ontology-concept-properties')
          ).toContainText('customer number');

          await inspector.getByTestId('ontology-add-relationship').click();
          await clickIgnoringToasts(page.getByTestId('relation-type-isA'));
          const target = inspector.getByLabel('Target');
          await scrollIntoViewAndSettle(target);
          await selectOptionWithRetry(
            target,
            page.getByRole('option', { name: 'Party', exact: true })
          );
          await expect(target).toContainText('Party');
          const axiomCreated = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/v1/ontologyAxioms' &&
              response.request().method() === 'POST'
          );
          await clickIgnoringToasts(
            inspector.getByTestId('ontology-relationship-submit')
          );
          const hierarchy = await okJson<OntologyAxiom>(
            await axiomCreated,
            'Create a subclass relation in Studio'
          );
          expect(hierarchy.ontology.id).toBe(ontology?.id);
          await expect(
            inspector.getByTestId(`ontology-concept-relation-${party.id}`)
          ).toContainText('Party');
          expect(await readGraphEdges(page)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                from: customer.id,
                relationType: 'isA',
                to: party.id,
              }),
            ])
          );
          await expect(
            page.getByTestId('ontology-explorer-stats')
          ).toContainText(/2\s+concepts?\s+·\s+1\s+relations?/i);
          await testInfo.attach('native-edit-inspector', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
        });

        await test.step('Save, reload, and remove a concept mapping', async () => {
          await page.getByTestId('ontology-concept-edit').click();
          const editor = page.getByTestId('ontology-concept-editor');
          await editor
            .getByRole('button', { name: 'Add mapping', exact: true })
            .click();
          const mappingEditor = editor.getByTestId('ontology-concept-mapping');
          const mapping = {
            conceptIri: `https://example.org/${name}/Customer`,
            mappingType: 'EXACT_MATCH',
            schemeIri: `https://example.org/${name}/vocabulary`,
            source: 'External vocabulary',
          };
          await mappingEditor
            .getByRole('textbox', { name: 'Concept IRI', exact: true })
            .fill(mapping.conceptIri);
          await mappingEditor
            .getByRole('textbox', { name: 'Scheme IRI', exact: true })
            .fill(mapping.schemeIri);
          await mappingEditor
            .getByRole('textbox', { name: 'Source', exact: true })
            .fill(mapping.source);
          const saved = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                `/api/v1/ontologyConcepts/${customer.id}` &&
              response.request().method() === 'PATCH'
          );
          await editor
            .getByRole('button', { name: 'Save', exact: true })
            .click();
          expect(
            (await okJson<OntologyConcept>(await saved, 'Save concept mapping'))
              .conceptMappings
          ).toEqual([mapping]);

          await page.reload();
          await page.getByTestId('mode-tab-edit').click();
          await clickGraphNode(page, customer.id);
          await page.getByTestId('ontology-concept-edit').click();
          await expect(
            mappingEditor.getByRole('textbox', {
              name: 'Concept IRI',
              exact: true,
            })
          ).toHaveValue(mapping.conceptIri);
          await expect(
            mappingEditor.getByRole('textbox', {
              name: 'Scheme IRI',
              exact: true,
            })
          ).toHaveValue(mapping.schemeIri);
          await expect(
            mappingEditor.getByRole('textbox', { name: 'Source', exact: true })
          ).toHaveValue(mapping.source);
          await mappingEditor
            .getByRole('button', { name: 'Remove', exact: true })
            .click();
          const removed = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                `/api/v1/ontologyConcepts/${customer.id}` &&
              response.request().method() === 'PATCH'
          );
          await editor
            .getByRole('button', { name: 'Save', exact: true })
            .click();
          expect(
            (
              await okJson<OntologyConcept>(
                await removed,
                'Remove concept mapping'
              )
            ).conceptMappings
          ).toEqual([]);
        });

        await test.step('Edit an existing property through Definitions', async () => {
          await page.getByTestId('submode-tab-definitions').click();
          await page
            .getByRole('tab', { name: 'Properties', exact: true })
            .click();
          await page
            .getByRole('button', { name: 'customerNumber', exact: true })
            .click();
          const editor = page.getByTestId('ontology-property-editor');
          await editor
            .getByRole('textbox', { name: 'Display Name', exact: true })
            .fill('Customer ID');
          const saved = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname.startsWith(
                '/api/v1/ontologyProperties/'
              ) && response.request().method() === 'PATCH'
          );
          await editor
            .getByRole('button', { name: 'Save', exact: true })
            .click();
          expect(
            (
              await okJson<OntologyProperty>(
                await saved,
                'Edit property in Definitions'
              )
            ).displayName
          ).toBe('Customer ID');
          await page.getByTestId('submode-tab-graph').click();
          await clickGraphNode(page, customer.id);
          await expect(
            page.getByTestId('ontology-concept-properties')
          ).toContainText('Customer ID');
        });

        await test.step('Use the shared View, Query, Publish, and export surfaces', async () => {
          await page.getByTestId('mode-tab-view').click();
          await page.getByTestId('submode-tab-tree').click();
          await expect(
            page.getByTestId(`ontology-tree-term-${customer.id}`)
          ).toBeVisible();
          await expect(
            page.getByTestId(`ontology-tree-term-${party.id}`)
          ).toBeVisible();
          await testInfo.attach('native-tree', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
          await page.getByTestId('mode-tab-edit').click();
          await expect(page.locator('.ontology-g6-container')).toBeVisible();
          await page.getByTestId('mode-tab-view').click();
          await page.getByTestId('submode-tab-graph').click();
          await testInfo.attach('native-view', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });

          await page.getByTestId('mode-tab-query').click();
          await expect(
            page.getByTestId('ontology-sparql-editor')
          ).toBeVisible();
          await page.getByTestId('ontology-new-query').click();
          await expect(
            page.getByTestId('ontology-query-saved-list')
          ).toContainText('Untitled query');
          await testInfo.attach('native-query', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
          await page.getByTestId('mode-tab-view').click();

          await page.getByTestId('ontology-publication-trigger').click();
          await expect(
            page.getByTestId('ontology-publication-modal')
          ).toContainText('Review & publish');
          await expect(
            page.getByRole('button', {
              name: 'Capture release',
              exact: true,
            })
          ).toBeEnabled();
          await testInfo.attach('native-publication', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
          await page.keyboard.press('Escape');
          await expect(
            page.getByTestId('ontology-publication-modal')
          ).not.toBeVisible();

          await page.getByTestId('ontology-import-export-trigger').click();
          await expect(page.getByRole('dialog')).toContainText(
            'There is no active release to export'
          );
          await page.getByTestId('ontology-native-import-tab').click();
          await expect(
            page.getByTestId('ontology-native-import-file')
          ).toBeVisible();
          await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Cancel', exact: true })
            .click();
        });
      } finally {
        if (ontology) {
          await deleteFixtureEntity(
            api,
            `/api/v1/ontologies/${ontology.id}?recursive=true`
          );
        }
      }
    });
  }
);
