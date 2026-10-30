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
import { APIRequestContext, Locator, Page, Response } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  AxiomType,
  CreateOntologyAxiom,
  ExpressionKind,
  Provenance,
} from '../../../src/generated/api/data/createOntologyAxiom';
import { SparqlQuerySettings } from '../../../src/generated/configuration/sparqlQuerySettings';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyConceptBindingsResponse } from '../../../src/generated/type/ontologyConceptBindingsResponse';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';

const canonicalQuerySettings: SparqlQuerySettings = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      '../../../../../../../../openmetadata-service/src/main/resources/json/data/settings/sparqlQuerySettings.json'
    ),
    'utf8'
  )
);

const armQueryLibraryResponses = (page: Page) => [
  page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/rdf/queries/saved') &&
      response.request().method() === 'GET'
  ),
  page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/rdf/queries/templates') &&
      response.request().method() === 'GET'
  ),
];

const expectLoadedNativeLibrary = async (page: Page, responses: Response[]) => {
  expect(responses.map((response) => response.status())).toEqual([200, 200]);
  const rail = page.getByTestId('ontology-query-sample-rail');
  await expect(rail).toHaveAttribute('data-library-state', 'ready');
  await expect(rail).toHaveAttribute('aria-busy', 'false');
  await expect(rail).toContainText('Queries');
  await expect(rail.getByTestId('ontology-query-new')).toHaveText('New Query');
  await expect(rail).toContainText('Shared queries');
  await expect(rail).toContainText('My queries');
  const settings: SparqlQuerySettings = await responses[1].json();
  for (const seed of canonicalQuerySettings.queryTemplates) {
    const stored = settings.queryTemplates.find(
      (template) => template.id === seed.id
    );
    if (!stored) {
      continue;
    }
    const isCanonical =
      Object.keys(stored).length === Object.keys(seed).length &&
      Object.entries(seed).every(
        ([key, value]) => Reflect.get(stored, key) === value
      );
    await expect(
      page.getByTestId(`ontology-query-template-${seed.id}`)
    ).toHaveCount(isCanonical ? 0 : 1);
  }
};

const expectNativeStudioCopy = async (scope: Locator) => {
  const text = await scope.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const copy: string[] = [];
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (
        parent?.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        }) &&
        !parent.closest(
          '[data-testid^="ontology-query-template-"][aria-pressed] [data-text], [data-testid^="ontology-query-saved-"][aria-pressed] [data-text]'
        )
      ) {
        copy.push(walker.currentNode.textContent ?? '');
      }
    }
    return copy.join(' ');
  });
  expect(text).not.toMatch(/glossary/i);
};

const createOwner = async (api: APIRequestContext) => {
  const name = 'pw_native_shell_' + uuid();

  return okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: { name, iri: 'urn:' + name, namespace: 'urn:' + name + ':' },
    }),
    'Create native shell ontology'
  );
};

const createConcept = async (
  api: APIRequestContext,
  ontology: Ontology,
  name: string,
  parents: string[] = []
) => {
  const concept = await okJson<OntologyConcept>(
    await api.post('/api/v1/ontologyConcepts', {
      data: {
        name,
        ontology: ontology.fullyQualifiedName,
        conceptType: 'OWL_CLASS',
      },
    }),
    'Create native tree concept'
  );
  if (parents.length) {
    const axiom: CreateOntologyAxiom = {
      name: name + 'Parents',
      displayName: name + ' parents',
      description: 'Native tree fixture hierarchy',
      ontology: ontology.fullyQualifiedName,
      axiomType: AxiomType.SubclassOf,
      subjectIri: concept.iri,
      expressions: parents.map((classIri) => ({
        kind: ExpressionKind.NamedClass,
        classIri,
      })),
      provenance: Provenance.Manual,
    };
    await okJson(
      await api.post('/api/v1/ontologyAxioms', { data: axiom }),
      'Create native tree parents'
    );
  }

  return concept;
};

test.use({ isolatedUserOptions: { isAdmin: true } });

test.describe(
  'Native tree and Studio shell',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('keeps both parent placements, one selection and all header controls at 924 pixels', async ({
      isolatedUser,
      isolatedUserPage: page,
    }) => {
      const api = await getWorkerAdminAPIContext();
      const owner = await createOwner(api);
      const preferencePath =
        '/api/v1/users/' +
        isolatedUser.responseData.id +
        '/preferences/appMode';
      try {
        const preference = await api.put(preferencePath, {
          data: { type: 'appMode', config: { value: 'ai' } },
        });
        expect(preference.ok()).toBeTruthy();
        const a = await createConcept(api, owner, 'ParentA');
        const b = await createConcept(api, owner, 'ParentB');
        const shared = await createConcept(api, owner, 'Shared', [
          a.iri,
          b.iri,
        ]);
        const leaf = await createConcept(api, owner, 'Leaf', [shared.iri]);
        await createConcept(api, owner, 'Isolated');
        await page.setViewportSize({ width: 924, height: 900 });
        await page.goto('/governance/ontology?ontology=' + owner.id);
        await test.step('Keep the full header inside the viewport', async () => {
          const header = page.getByTestId('ontology-studio-header');
          const controls = [
            'ontology-scope-menu-trigger',
            'mode-tab-view',
            'mode-tab-edit',
            'mode-tab-query',
            'ontology-library-trigger',
            'ontology-import-export-trigger',
            'ontology-publication-trigger',
            'ontology-tasks-trigger',
          ];
          for (const id of controls) {
            await expect(header.getByTestId(id)).toBeVisible();
          }
          const isolated = header.getByText('1 Isolated', { exact: true });
          await expect(isolated).toBeVisible();
          const bounds = await header.boundingBox();
          expect(bounds).not.toBeNull();
          const boxes = await Promise.all(
            [...controls.map((id) => header.getByTestId(id)), isolated].map(
              (control) => control.boundingBox()
            )
          );
          for (const box of boxes) {
            expect(box).not.toBeNull();
            expect(box?.x).toBeGreaterThanOrEqual(bounds?.x ?? 0);
            expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(924);
          }
          const ordered = boxes
            .filter((box): box is NonNullable<typeof box> => box !== null)
            .sort((left, right) => left.x - right.x);
          for (let i = 1; i < ordered.length; i++) {
            expect(ordered[i - 1].x + ordered[i - 1].width).toBeLessThanOrEqual(
              ordered[i].x + 1
            );
            expect(
              Math.abs(
                ordered[i].y +
                  ordered[i].height / 2 -
                  ordered[0].y -
                  ordered[0].height / 2
              )
            ).toBeLessThan(3);
          }
          await page.getByTestId('ontology-release-history-trigger').click();
          await expect(
            page.getByTestId('ontology-publication-tab-releases')
          ).toHaveAttribute('aria-selected', 'true');
          await page.keyboard.press('Escape');
        });
        await test.step('Keep native Studio copy ontology-specific in every mode', async () => {
          for (const scope of ['aggregate', 'owner'] as const) {
            await page.goto(
              scope === 'owner'
                ? '/governance/ontology?ontology=' + owner.id
                : '/governance/ontology'
            );
            const shell = page.getByTestId('ontology-studio-shell');
            for (const mode of ['view', 'edit', 'query'] as const) {
              for (const available of ['view', 'edit', 'query'] as const) {
                await expect(
                  shell.getByTestId('mode-tab-' + available)
                ).toBeVisible();
              }
              await expect(shell.getByText('Ask Collate')).toHaveCount(0);
              const libraryResponses =
                mode === 'query' && scope === 'owner'
                  ? armQueryLibraryResponses(page)
                  : undefined;
              await shell.getByTestId('mode-tab-' + mode).click();
              await expect(
                shell.getByTestId('mode-tab-' + mode)
              ).toHaveAttribute('aria-selected', 'true');
              const subbar = shell.getByTestId('ontology-studio-subbar');
              await expect(subbar).toHaveAttribute(
                'aria-label',
                { view: 'Explore', edit: 'Author', query: 'Query' }[mode]
              );
              if (mode === 'view' || mode === 'edit') {
                await expect(
                  subbar.getByTestId('submode-tab-graph')
                ).toHaveText('Graph');
              }
              if (mode === 'view') {
                await expect(subbar.getByTestId('submode-tab-tree')).toHaveText(
                  'Tree'
                );
              }
              if (mode === 'edit' && scope === 'owner') {
                await expect(
                  subbar.getByTestId('submode-tab-definitions')
                ).toHaveText('Term');
              }
              if (mode === 'query' && scope === 'owner') {
                await expect(
                  subbar.getByTestId('submode-tab-console')
                ).toHaveText('SPARQL console');
                await expect(
                  subbar.getByTestId('submode-tab-builder')
                ).toHaveText('Visual builder');
              }
              if (libraryResponses) {
                await expectLoadedNativeLibrary(
                  page,
                  await Promise.all(libraryResponses)
                );
              }
              if (scope === 'aggregate' && mode === 'query') {
                await expect(
                  shell.getByTestId('ontology-studio-query-console')
                ).toHaveCount(0);
                await expect(
                  shell.getByRole('button', { name: /Select Ontology/ })
                ).toBeVisible();
              }
              await expect(
                shell.getByRole('heading', { name: 'Ontology Studio' })
              ).toBeVisible();
              await expect(shell.getByTestId('mode-tab-view')).toHaveText(
                'View'
              );
              await expect(shell.getByTestId('mode-tab-edit')).toHaveText(
                'Edit'
              );
              await expect(shell.getByTestId('mode-tab-query')).toHaveText(
                'Query'
              );
              await expect(
                shell
                  .getByTestId('ontology-studio-header')
                  .getByTestId('breadcrumb')
              ).toContainText('Ontology Studio');

              await expectNativeStudioCopy(shell);
              await shell.getByTestId('ontology-scope-menu-trigger').click();
              await expect(
                page.getByTestId('ontology-scope-all-ontologies')
              ).toHaveText('All ontologies');
              await expectNativeStudioCopy(page.getByRole('menu'));
              await page.keyboard.press('Escape');

              await shell.getByTestId('ontology-publication-trigger').click();
              await expect(
                page.locator('#ontology-publication-title')
              ).toHaveText('Review & publish');
              if (scope === 'owner') {
                await expect(
                  page.getByTestId('ontology-publication-tab-changes')
                ).toHaveText('Changes');
                await expect(
                  page.getByTestId('ontology-publication-tab-releases')
                ).toHaveText('Releases');
              }
              await expectNativeStudioCopy(
                page.getByTestId('ontology-publication-modal')
              );
              await page.keyboard.press('Escape');
            }
            await shell.getByTestId('ontology-library-trigger').click();
            await expect(page.locator('#ontology-library-title')).toHaveText(
              'Ontology Library'
            );
            await expect(page.getByTestId('ontology-library')).toContainText(
              'Pre-built, standards-aligned ontologies'
            );
            await expectNativeStudioCopy(page.getByTestId('ontology-library'));
            await page.getByTestId('ontology-library-close').click();

            await shell.getByTestId('ontology-import-export-trigger').click();
            if (scope === 'aggregate') {
              const target = page.getByTestId('ontology-import-target-picker');
              await expect(target).toContainText('Select Ontology');
              await expectNativeStudioCopy(page.getByRole('dialog'));
              await target.getByRole('button').click();
              await page
                .getByRole('option', { name: owner.name, exact: true })
                .click();
            }
            const transfer = page.getByRole('dialog');
            await expect(transfer).toHaveCount(1);
            await expect(transfer).toContainText('Import / export ontology');
            await expect(
              transfer.getByTestId('ontology-native-export-tab')
            ).toHaveText('Export');
            await expect(
              transfer.getByTestId('ontology-native-import-tab')
            ).toHaveText('Import');
            await expect(transfer).toContainText(
              'There is no active release to export. Capture, approve, and activate a release first.'
            );
            await expect(
              transfer.getByTestId('ontology-run-release-export')
            ).toHaveText('Export');
            await expect(
              transfer.getByTestId('ontology-run-release-export')
            ).toBeDisabled();
            await expectNativeStudioCopy(transfer);
            await transfer.getByTestId('ontology-native-import-tab').click();
            await expect(
              transfer.getByTestId('ontology-native-import-file')
            ).toHaveText('Choose file');
            await expect(transfer).toContainText(
              'Preview a local RDF file, then apply its changes to the selected ontology. The active release stays unchanged until you publish.'
            );
            await expect(
              transfer.getByTestId('ontology-native-import-apply')
            ).toHaveText('Import');
            await expect(
              transfer.getByTestId('ontology-native-import-apply')
            ).toBeDisabled();
            await expectNativeStudioCopy(transfer);
            await transfer
              .getByRole('button', { name: 'Close', exact: true })
              .click();
            if (scope === 'aggregate') {
              const libraryResponses = armQueryLibraryResponses(page);
              await shell
                .getByRole('button', { name: /Select Ontology/ })
                .click();
              await page.getByRole('option', { name: owner.name }).click();
              await expectLoadedNativeLibrary(
                page,
                await Promise.all(libraryResponses)
              );
            }
          }
          await page.goto('/governance/ontology?ontology=' + owner.id);
        });
        await test.step('Navigate independent placements and preserve one selected row', async () => {
          await page.getByTestId('submode-tab-tree').click();
          const sharedRows = page.getByTestId(
            'ontology-tree-term-' + shared.id
          );
          await expect(sharedRows).toHaveCount(2);
          await expect(
            page.getByTestId('ontology-tree-term-' + leaf.id)
          ).toHaveCount(2);
          const path = JSON.stringify([owner.id, a.id, shared.id]);
          const selectedPlacement = sharedRows
            .filter({ has: page.locator('[data-testid="tree-expand-btn"]') })
            .and(page.locator('[data-key=' + JSON.stringify(path) + ']'));
          await selectedPlacement.getByTestId('tree-expand-btn').click();
          await expect(
            page.getByTestId('ontology-tree-term-' + leaf.id)
          ).toHaveCount(1);
          await selectedPlacement.click();
          await expect(page.getByRole('row', { selected: true })).toHaveCount(
            1
          );
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toContainText(shared.iri);
          await page.getByTestId('ontology-tree-collapse-all').click();
          await expect(sharedRows).toHaveCount(0);
          await page.getByTestId('ontology-tree-expand-all').click();
          await expect(sharedRows).toHaveCount(2);
          await page.reload();
          await page.getByTestId('submode-tab-tree').click();
          await expect(page.getByRole('row', { selected: true })).toHaveCount(
            1
          );
        });
        await test.step('Return the rail to Health after an empty canvas click', async () => {
          await page.getByTestId('submode-tab-graph').click();
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toBeVisible();
          await page.locator('.ontology-g6-container').click({
            position: { x: 5, y: 5 },
          });
          await expect(page.getByTestId('ontology-health-panel')).toBeVisible();
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toHaveCount(0);
        });
        await test.step('Require aggregate targets after selecting a concept', async () => {
          await page.goto(
            '/governance/ontology?concept=' + shared.id + '&source=tree-shell'
          );
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toContainText(shared.iri);
          await page.getByTestId('ontology-publication-trigger').click();
          await expect(
            page.getByTestId('ontology-publication-picker')
          ).toBeVisible();
          await expect(
            page.getByTestId('ontology-publication-tab-changes')
          ).toHaveCount(0);
          await page.keyboard.press('Escape');
          await page.getByTestId('ontology-import-export-trigger').click();
          await expect(
            page.getByTestId('ontology-import-target-picker')
          ).toBeVisible();
          await expect(page).toHaveURL(/source=tree-shell/);
          await expect(page.getByRole('dialog')).toHaveCount(1);
        });
      } finally {
        await deleteFixtureEntity(
          api,
          '/api/v1/ontologies/' + owner.id + '?recursive=true'
        );
        const restoredPreference = await api.delete(preferencePath);
        expect(restoredPreference.ok()).toBeTruthy();
      }
    });

    test('shows three of seven linked assets and opens their Data graph from Tree', async ({
      isolatedUserPage: page,
    }) => {
      const api = await getWorkerAdminAPIContext();
      const owner = await createOwner(api);
      const tables: TableClass[] = [];
      try {
        const concept = await createConcept(api, owner, 'LinkedConcept');
        let revision = 0;
        for (let i = 0; i < 7; i++) {
          const table = new TableClass({ name: 'pw_rail_' + i + '_' + uuid() });
          await table.create(api);
          tables.push(table);
          const response = await okJson<OntologyConceptBindingsResponse>(
            await api.put(
              '/api/v1/ontologyConcepts/' + concept.id + '/bindings',
              {
                data: {
                  expectedRevision: revision,
                  asset: {
                    assetType: 'table',
                    assetId: table.entityResponseData.id,
                    columns: [],
                  },
                },
              }
            ),
            'Link rail asset'
          );
          revision = response.revision;
        }
        await page.goto(
          '/governance/ontology?ontology=' + owner.id + '&concept=' + concept.id
        );
        await page.getByTestId('submode-tab-tree').click();
        await test.step('Show the lifecycle, owner and capped asset list', async () => {
          const rail = page.getByTestId('ontology-concept-inspector');
          await expect(
            rail.getByTestId('ontology-concept-lifecycle')
          ).toContainText('Draft');
          await expect(
            rail.getByTestId('ontology-concept-owner')
          ).toContainText(owner.name);
          const assets = rail.getByTestId('ontology-native-assets');
          const assetLinks = assets.getByRole('link').filter({
            hasText: /^pw table /,
          });
          await expect(assetLinks).toHaveCount(3);
          for (const name of await assetLinks.allTextContents()) {
            const table = tables.find(
              ({ entityResponseData }) =>
                entityResponseData.displayName === name
            );
            expect(table).toBeDefined();
            await expect(
              assets.getByRole('link', { name, exact: true })
            ).toHaveAttribute(
              'href',
              '/table/' +
                encodeURIComponent(
                  table?.entityResponseData.fullyQualifiedName ?? ''
                )
            );
          }
          await expect(assets.getByTestId('ontology-assets-more')).toHaveText(
            '+4 more'
          );
          await assets.getByTestId('ontology-assets-more').click();
        });
        await test.step('Switch both surfaces and retain the selected concept', async () => {
          await expect(page.getByTestId('submode-tab-graph')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          await expect(
            page.getByTestId('ontology-graph-mode-data')
          ).toHaveAttribute('aria-pressed', 'true');
          await expect(
            page.getByTestId('ontology-native-data-graph')
          ).toBeVisible();
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toContainText(concept.iri);
          await expect(page).toHaveURL(new RegExp('concept=' + concept.id));
        });
      } finally {
        await deleteFixtureEntity(
          api,
          '/api/v1/ontologies/' + owner.id + '?recursive=true'
        );
        for (const table of tables) {
          await table.delete(api);
        }
      }
    });
  }
);
