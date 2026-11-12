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
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyAxiom } from '../../../src/generated/entity/data/ontologyAxiom';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyProperty } from '../../../src/generated/entity/data/ontologyProperty';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { UserClass } from '../../support/user/UserClass';
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
  findOntologyInScopeMenu,
  openExportAdvanced,
  openOntologyTransfer,
  readGraphEdges,
  readNodePositions,
} from '../../utils/ontologyStudio';
import { disableAiAppMode, enableAiAppMode } from '../Utils/appMode';

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
          // The graph and the over-limit alert each have a dedicated spec, so either state is a valid scope.
          await expect(
            page
              .getByTestId('all-ontologies-graph')
              .or(page.getByTestId('all-ontologies-load-error'))
          ).toBeVisible();
          await expect(page.getByTestId('mode-tab-edit')).toBeVisible();
          await expect(
            page.getByTestId('ontology-library-trigger')
          ).toBeVisible();
          await page.getByTestId('ontology-scope-menu-trigger').click();
          for (const ontology of ontologies) {
            await expect(
              await findOntologyInScopeMenu(page, ontology)
            ).toBeVisible();
          }
          await page.getByTestId('ontology-scope-search').fill('');
          await expect(
            page.getByTestId('ontology-scope-all-glossaries')
          ).toHaveCount(0);
          await expect(page.getByTestId('ontology-create')).toBeVisible();
          await page.keyboard.press('Escape');
          const owner = ontologies[1];
          await page.goto('/governance/ontology?ontology=' + owner.id);
          await page.getByTestId('submode-tab-tree').click();
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
        await test.step('Publish waits for one ontology to be chosen', async () => {
          await page.goto('/governance/ontology');
          await expect(
            page.getByTestId('ontology-publication-trigger')
          ).toBeDisabled();
          await expect(
            page.getByTestId('ontology-publication-modal')
          ).toHaveCount(0);
          const scopeMenu = page.getByTestId('ontology-scope-menu-trigger');
          await scopeMenu.click();
          await (await findOntologyInScopeMenu(page, ontologies[0])).click();
          await page.getByTestId('ontology-publication-trigger').click();
          await expect(
            page.getByTestId('ontology-publication-modal')
          ).toContainText(ontologies[0].name);
          await page.getByTestId('ontology-publication-tab-releases').click();
          await expect(
            page.getByTestId('ontology-publication-tab-releases')
          ).toHaveAttribute('aria-selected', 'true');
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
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const name = `pw_native_studio_${uuid()}`;
      const prefix = `pw-native-studio-${uuid()}`;
      let ontology: Ontology | undefined;

      try {
        await test.step('Create a native ontology from the shared scope menu', async () => {
          await page.goto('/governance/ontology');
          await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
          await page.getByTestId('ontology-scope-menu-trigger').click();
          await page.getByTestId('ontology-create').click();

          const submit = page.getByTestId('ontology-create-submit');
          await expect(submit).toBeDisabled();
          await page.getByTestId('ontology-create-name').fill(name);
          await page.getByTestId('ontology-create-advanced-toggle').click();
          await page
            .getByTestId('ontology-create-iri')
            .fill(`https://open-metadata.org/onto/${prefix}`);
          const created = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/v1/ontologies' &&
              response.request().method() === 'POST'
          );
          await submit.click();
          ontology = await okJson<Ontology>(
            await created,
            'Create ontology in Studio'
          );
          expect(ontology.owners).toHaveLength(1);
          expect(ontology.namespace).toMatch(new RegExp(`/onto/${prefix}#$`));

          await expect(page).toHaveURL(
            new RegExp(`[?&]ontology=${ontology.id}(?:&|$)`)
          );
          await expect(
            page.getByTestId('ontology-scope-menu-trigger')
          ).toHaveAttribute('data-scope-key', `ontology:${ontology.id}`);
          await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toBeVisible();
          await expect(page.getByTestId('mode-tab-view')).toBeVisible();
          await expect(page.getByTestId('mode-tab-query')).toBeVisible();
          await expect(page.getByTestId('mode-tab-model')).toHaveCount(0);
          await expect(page.getByTestId('mode-tab-releases')).toHaveCount(0);
        });

        const [customer, party] =
          await test.step('Create concepts without leaving the graph', async () => {
            const createConcept = async (
              conceptName: string,
              description: string
            ) => {
              if (!ontology) {
                throw new Error('ontology not created');
              }
              const { fullyQualifiedName, namespace } = ontology;
              if (
                !(await page
                  .getByTestId('ontology-new-class-panel')
                  .isVisible())
              ) {
                await page.getByTestId('ontology-add-concept').click();
              }
              await page.getByTestId('new-class-label').fill(conceptName);
              await page.getByTestId('new-class-description').fill(description);
              const applied = page.waitForResponse(
                (candidate) =>
                  candidate.url().includes('/ontologyChangeSets/') &&
                  candidate.url().endsWith('/apply') &&
                  candidate.request().method() === 'POST'
              );
              await clickIgnoringToasts(page.getByTestId('new-class-create'));
              expect((await applied).status()).toBe(200);
              await expect(
                page.getByTestId('ontology-new-class-panel')
              ).toHaveCount(0);
              // Create selects the new concept; its drawer covers the header's Add concept.
              const inspector = page.getByTestId('ontology-concept-inspector');
              await expect(inspector).toContainText(conceptName);
              await inspector.getByTestId('ontology-concept-close').click();
              await expect(inspector).toHaveCount(0);
              const concepts = await okJson<{ data: OntologyConcept[] }>(
                await api.get('/api/v1/ontologyConcepts', {
                  params: { ontology: fullyQualifiedName },
                }),
                `Read ${conceptName} in Studio`
              );
              const created = concepts.data.find(
                (concept) => concept.iri === namespace + conceptName
              );
              if (!created) {
                throw new Error(
                  `${conceptName} missing after the plan applied`
                );
              }

              return created;
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
          await page.getByTestId('fit-view').click();
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
          await clickIgnoringToasts(
            page.getByTestId(
              'relation-type-http://www.w3.org/2000/01/rdf-schema#subClassOf'
            )
          );
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
          // Edit mode opens the selected concept already editable.
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
            .getByRole('combobox', { name: /^Concept IRI/ })
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
          await expect(
            mappingEditor.getByRole('combobox', { name: /^Concept IRI/ })
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
          // Customer stays selected across modes; its drawer covers the header's Publish.
          await page.getByTestId('ontology-concept-close').click();
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toHaveCount(0);

          await page.getByTestId('ontology-publication-trigger').click();
          await expect(
            page.getByTestId('ontology-publication-modal')
          ).toContainText('Review & publish');
          await expect(
            page.getByRole('button', {
              name: 'Save as release draft',
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

          await openOntologyTransfer(page);
          await openExportAdvanced(page);
          await expect(
            page.getByRole('dialog').getByTestId('ontology-export-scope')
          ).toContainText('Current draft');
          await expect(
            page
              .getByRole('dialog')
              .getByTestId('ontology-release-export-preview')
          ).toContainText('owl:Ontology');
          await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Close', exact: true })
            .click();
          await expect(page.getByRole('dialog')).not.toBeVisible();
          await openOntologyTransfer(page, 'import');
          await expect(
            page.getByTestId('ontology-native-import-file')
          ).toBeVisible();
          await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Close', exact: true })
            .click();
          await expect(page.getByRole('dialog')).not.toBeVisible();
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

const APP_MODES = ['classic', 'ai'] as const;

const isOntologyPost = (request: { url(): string; method(): string }) =>
  new URL(request.url()).pathname === '/api/v1/ontologies' &&
  request.method() === 'POST';

const createFixtureOntology = async (displayName: string) => {
  const api = await getWorkerAdminAPIContext();
  const name = `pw-g9-${uuid()}`;

  return okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: {
        name,
        displayName,
        iri: `urn:${name}`,
        namespace: `urn:${name}:`,
      },
    }),
    'Create picker fixture ontology'
  );
};

const removeOntologies = async (ontologies: Array<Ontology | undefined>) => {
  const api = await getWorkerAdminAPIContext();
  for (const ontology of ontologies) {
    if (ontology) {
      await deleteFixtureEntity(
        api,
        `/api/v1/ontologies/${ontology.id}?recursive=true&hardDelete=true`
      );
    }
  }
};

const openStudio = async (page: Page, mode: (typeof APP_MODES)[number]) => {
  if (mode === 'ai') {
    await enableAiAppMode(page);
  } else {
    await disableAiAppMode(page);
  }
  await page.goto('/governance/ontology');
  await expect(page.getByTestId('ontology-scope-menu-trigger')).toBeVisible();
};

const openCreateDialog = async (page: Page) => {
  await page.getByTestId('ontology-scope-menu-trigger').click();
  await page.getByTestId('ontology-create').click();
  await expect(page.getByTestId('ontology-create-dialog')).toBeVisible();
};

const pickPerson = async (
  page: Page,
  field: 'owners' | 'reviewers',
  name: string
) => {
  const input = page
    .getByTestId('ontology-create-dialog')
    .getByRole('combobox', {
      name: field === 'owners' ? 'Owners' : 'Reviewers',
    });
  const option = page.getByRole('option').filter({ hasText: name });
  await expect(async () => {
    await input.click();
    await input.fill('');
    await input.fill(name);
    await expect(option).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await option.click();
  await expect(option).toBeHidden();
  await input.press('Escape');
};

test.describe(
  'Ontology Studio create dialog and picker actions',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const mode of APP_MODES) {
      test.describe(`${mode} mode`, () => {
        test('shows the full create form with Advanced collapsed', async ({
          isolatedUserPage: page,
        }) => {
          const fixture = await createFixtureOntology(`PW G9 ${uuid()}`);
          try {
            await openStudio(page, mode);
            await openCreateDialog(page);
            const dialog = page.getByTestId('ontology-create-dialog');

            const order = await dialog
              .locator(
                '[data-testid="ontology-create-name"], [data-testid="ontology-create-description"], [role="combobox"], [data-testid="ontology-create-advanced-toggle"]'
              )
              .evaluateAll((nodes) =>
                nodes.map(
                  (node) =>
                    node.getAttribute('data-testid') ??
                    node.getAttribute('aria-label') ??
                    node.getAttribute('name')
                )
              );

            expect(order).toEqual([
              'ontology-create-name',
              'ontology-create-description',
              'Owners',
              'Reviewers',
              'ontology-create-advanced-toggle',
            ]);
            await expect(dialog).toContainText('(You)');
            await expect(
              page.getByTestId('ontology-create-advanced-toggle')
            ).toHaveAttribute('aria-expanded', 'false');
            await expect(page.getByTestId('ontology-create-id')).toHaveCount(0);

            await page.getByTestId('ontology-create-advanced-toggle').click();

            await expect(page.getByTestId('ontology-create-id')).toBeVisible();
            await expect(page.getByTestId('ontology-create-iri')).toBeVisible();
            await expect(
              page.getByTestId('ontology-create-namespace')
            ).toBeVisible();
            for (const layer of ['L1', 'L2', 'L3']) {
              await expect(
                dialog.getByRole('tab', { name: layer })
              ).toBeVisible();
            }
          } finally {
            await removeOntologies([fixture]);
          }
        });

        test('creates with two reviewers and an extra owner', async ({
          isolatedUserPage: page,
        }) => {
          test.slow();
          const api = await getWorkerAdminAPIContext();
          const [reviewerOne, reviewerTwo, extraOwner] = [
            new UserClass(),
            new UserClass(),
            new UserClass(),
          ];
          let created: Ontology | undefined;
          try {
            for (const user of [reviewerOne, reviewerTwo, extraOwner]) {
              await user.create(api);
            }
            await openStudio(page, mode);
            await openCreateDialog(page);
            await page
              .getByTestId('ontology-create-name')
              .fill(`PW G9 reviewers ${uuid()}`);
            await pickPerson(
              page,
              'owners',
              extraOwner.responseData.displayName
            );
            await pickPerson(
              page,
              'reviewers',
              reviewerOne.responseData.displayName
            );
            await pickPerson(
              page,
              'reviewers',
              reviewerTwo.responseData.displayName
            );

            const response = page.waitForResponse((candidate) =>
              isOntologyPost(candidate.request())
            );
            await page.getByTestId('ontology-create-submit').click();
            created = await okJson<Ontology>(
              await response,
              'Create ontology with reviewers'
            );

            const read = await okJson<Ontology>(
              await api.get(
                `/api/v1/ontologies/${created.id}?fields=owners,reviewers`
              ),
              'Read created ontology'
            );
            expect((read.reviewers ?? []).map(({ id }) => id).sort()).toEqual(
              [reviewerOne.responseData.id, reviewerTwo.responseData.id].sort()
            );
            expect(read.owners?.map(({ id }) => id)).toContain(
              extraOwner.responseData.id
            );
            expect(read.owners).toHaveLength(2);
          } finally {
            await removeOntologies([created]);
            for (const user of [reviewerOne, reviewerTwo, extraOwner]) {
              await user.delete(api);
            }
          }
        });

        test('creates with a custom ID, IRI, namespace and layer L1', async ({
          isolatedUserPage: page,
        }) => {
          test.slow();
          const id = `pw-g9-adv-${uuid()}`;
          let created: Ontology | undefined;
          try {
            await openStudio(page, mode);
            await openCreateDialog(page);
            await page.getByTestId('ontology-create-name').fill(`PW G9 ${id}`);
            await page.getByTestId('ontology-create-advanced-toggle').click();
            await page.getByTestId('ontology-create-id').fill(id);
            await page
              .getByTestId('ontology-create-iri')
              .fill(`https://example.org/${id}`);
            await page
              .getByTestId('ontology-create-namespace')
              .fill(`https://example.org/${id}/ns#`);
            await page
              .getByTestId('ontology-create-dialog')
              .getByRole('tab', { name: 'L1' })
              .click();

            const response = page.waitForResponse((candidate) =>
              isOntologyPost(candidate.request())
            );
            await page.getByTestId('ontology-create-submit').click();
            created = await okJson<Ontology>(
              await response,
              'Create ontology with custom identifiers'
            );

            expect(created.name).toBe(id);
            expect(created.iri).toBe(`https://example.org/${id}`);
            expect(created.namespace).toBe(`https://example.org/${id}/ns#`);
            expect(created.layer).toBe('L1');

            await page.getByTestId('ontology-scope-menu-trigger').click();
            await page
              .getByTestId(`ontology-scope-actions-${created.id}`)
              .click();
            await page
              .getByTestId(`ontology-scope-settings-${created.id}`)
              .click();
            await page.getByTestId('ontology-settings-advanced-toggle').click();
            await expect(
              page.getByRole('textbox', { name: 'Namespace' })
            ).toBeDisabled();
            await expect(
              page.getByRole('textbox', { name: 'Name', exact: true })
            ).toBeDisabled();
          } finally {
            await removeOntologies([created]);
          }
        });

        test('refuses a duplicate name, a double quote and 300 characters without a network call', async ({
          isolatedUserPage: page,
        }) => {
          const displayName = `PW G9 taken ${uuid()}`;
          const fixture = await createFixtureOntology(displayName);
          let posts = 0;
          page.on('request', (request) => {
            if (isOntologyPost(request)) {
              posts += 1;
            }
          });
          try {
            await openStudio(page, mode);
            await openCreateDialog(page);
            const name = page.getByTestId('ontology-create-name');
            const submit = page.getByTestId('ontology-create-submit');
            const dialog = page.getByTestId('ontology-create-dialog');

            await name.fill(displayName.toUpperCase());
            await expect(dialog).toContainText('already exists');
            await expect(submit).toBeDisabled();

            await name.fill('Finance "Core"');
            await expect(dialog).toContainText('cannot contain double quotes');
            await expect(submit).toBeDisabled();

            await name.fill('a'.repeat(300));
            await expect(dialog).toContainText(
              'at most 256 characters. This one has 300.'
            );
            await expect(submit).toBeDisabled();

            await name.fill('A fresh name');
            await expect(submit).toBeEnabled();
            expect(posts).toBe(0);
          } finally {
            await removeOntologies([fixture]);
          }
        });

        test('keeps Create enabled for names that differ only in digits', async ({
          isolatedUserPage: page,
        }) => {
          test.slow();
          const api = await getWorkerAdminAPIContext();
          const suffix = uuid();
          const created: Ontology[] = [];
          try {
            await openStudio(page, mode);
            for (const digits of ['37973', '38000']) {
              await openCreateDialog(page);
              await page
                .getByTestId('ontology-create-name')
                .fill(`Qzx Guard ${digits} ${suffix}`);
              await expect(
                page.getByTestId('ontology-create-submit')
              ).toBeEnabled();
              const response = page.waitForResponse((candidate) =>
                isOntologyPost(candidate.request())
              );
              await page.getByTestId('ontology-create-submit').click();
              created.push(
                await okJson<Ontology>(
                  await response,
                  'Create digit-only difference ontology'
                )
              );
              await openStudio(page, mode);
            }
            expect(created[0].namespace).not.toBe(created[1].namespace);
            expect(created[0].iri).not.toBe(created[1].iri);
            const read = await api.get(`/api/v1/ontologies/${created[1].id}`);
            expect(read.status()).toBe(200);
          } finally {
            await removeOntologies(created);
          }
        });

        test('asks before discarding typed input and creates nothing on Cancel', async ({
          isolatedUserPage: page,
        }) => {
          let posts = 0;
          page.on('request', (request) => {
            if (isOntologyPost(request)) {
              posts += 1;
            }
          });
          await openStudio(page, mode);
          await openCreateDialog(page);
          await page
            .getByTestId('ontology-create-name')
            .fill(`PW G9 cancelled ${uuid()}`);
          await page.getByTestId('ontology-create-cancel').click();

          await expect(
            page.getByRole('heading', { name: 'Discard your changes?' })
          ).toBeVisible();

          await page.getByRole('button', { name: 'Discard' }).click();

          await expect(page.getByTestId('ontology-create-dialog')).toHaveCount(
            0
          );
          expect(posts).toBe(0);
        });

        test('deletes an ontology from the picker after typing its name, naming the counts', async ({
          isolatedUserPage: page,
        }) => {
          test.slow();
          const api = await getWorkerAdminAPIContext();
          const displayName = `PW G9 delete ${uuid()}`;
          const fixture = await createFixtureOntology(displayName);
          try {
            for (const conceptName of ['Alpha', 'Beta']) {
              await okJson(
                await api.post('/api/v1/ontologyConcepts', {
                  data: {
                    name: conceptName,
                    ontology: fixture.fullyQualifiedName,
                    conceptType: 'OWL_CLASS',
                  },
                }),
                'Create concept to delete'
              );
            }
            const state = await okJson<{ workingRevision: number }>(
              await api.get(`/api/v1/ontologies/${fixture.id}/state`),
              'Read ontology revision'
            );
            await okJson(
              await api.post(`/api/v1/ontologies/${fixture.id}/releases`, {
                data: { expectedWorkingRevision: state.workingRevision },
              }),
              'Capture release to delete'
            );

            await openStudio(page, mode);
            await page.getByTestId('ontology-scope-menu-trigger').click();
            await page
              .getByTestId(`ontology-scope-actions-${fixture.id}`)
              .click();
            await page
              .getByTestId(`ontology-scope-delete-${fixture.id}`)
              .click();

            const dialog = page.getByTestId('ontology-delete-dialog');
            await expect(
              dialog.getByTestId('ontology-delete-counts')
            ).toContainText('Concepts: 2');
            await expect(
              dialog.getByTestId('ontology-delete-counts')
            ).toContainText('Releases: 1');
            const confirm = page.getByTestId('ontology-delete-confirm');
            await expect(confirm).toBeDisabled();

            await page
              .getByTestId('ontology-delete-confirm-name')
              .fill(displayName);
            const deleted = page.waitForResponse(
              (candidate) =>
                candidate.url().includes(`/api/v1/ontologies/${fixture.id}`) &&
                candidate.request().method() === 'DELETE'
            );
            await confirm.click();

            expect((await deleted).status()).toBe(200);
            await page.getByTestId('ontology-scope-menu-trigger').click();
            await page.getByTestId('ontology-scope-search').fill(fixture.name);
            await expect(
              page.getByTestId(`ontology-scope-${fixture.id}`)
            ).toHaveCount(0);
            expect(
              (await api.get(`/api/v1/ontologies/${fixture.id}`)).status()
            ).toBe(404);
          } finally {
            // Delete archives an ontology that has releases; the permanent clean-up may be refused.
            await removeOntologies([fixture]).catch(() => undefined);
          }
        });
      });
    }

    test('searches a picker of 40 ontologies and shows a concept count on each row', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const tag = uuid().slice(0, 8);
      const ontologies: Ontology[] = [];
      try {
        for (let index = 0; index < 40; index++) {
          ontologies.push(
            await createFixtureOntology(
              `PW G9 ${index === 7 ? 'needle' : 'hay'} ${tag} ${index}`
            )
          );
        }
        await okJson(
          await api.post('/api/v1/ontologyConcepts', {
            data: {
              name: 'Counted',
              ontology: ontologies[7].fullyQualifiedName,
              conceptType: 'OWL_CLASS',
            },
          }),
          'Create counted concept'
        );
        await page.goto('/governance/ontology');
        await page.getByTestId('ontology-scope-menu-trigger').click();
        await page.getByTestId('ontology-scope-search').fill(`needle ${tag}`);

        await expect(
          page.getByTestId(`ontology-scope-${ontologies[7].id}`)
        ).toContainText('1 concept');
        await expect(
          page.getByTestId(`ontology-scope-${ontologies[8].id}`)
        ).toHaveCount(0);

        await page.getByTestId('ontology-scope-search').fill('zzz-no-such');

        await expect(page.getByTestId('ontology-scope-no-match')).toBeVisible();
      } finally {
        await removeOntologies(ontologies);
      }
    });

    test('makes Publish the primary action after creating without reviewers', async ({
      isolatedUserPage: page,
    }) => {
      let created: Ontology | undefined;
      try {
        await page.goto('/governance/ontology');
        await openCreateDialog(page);
        await page
          .getByTestId('ontology-create-name')
          .fill(`PW G9 direct ${uuid()}`);
        const response = page.waitForResponse((candidate) =>
          isOntologyPost(candidate.request())
        );
        await page.getByTestId('ontology-create-submit').click();
        created = await okJson<Ontology>(
          await response,
          'Create ontology without reviewers'
        );

        await expect(
          page.getByTestId('ontology-publication-trigger')
        ).toHaveText(/^Publish/);
      } finally {
        await removeOntologies([created]);
      }
    });
  }
);
