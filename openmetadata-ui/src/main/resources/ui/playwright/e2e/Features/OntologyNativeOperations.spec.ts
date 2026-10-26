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
import { CreateOntologyChangeSet } from '../../../src/generated/api/data/createOntologyChangeSet';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyChangeSet } from '../../../src/generated/entity/data/ontologyChangeSet';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyProperty } from '../../../src/generated/entity/data/ontologyProperty';
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { DataType } from '../../../src/generated/entity/data/table';
import { Task } from '../../../src/generated/entity/tasks/task';
import { OntologyConceptBindingsResponse } from '../../../src/generated/type/ontologyConceptBindingsResponse';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
  selectOptionWithRetry,
  uuid,
} from '../../utils/common';
import { readGraphEdges, readNodePositions } from '../../utils/ontologyStudio';
import { waitForSearchIndexed } from '../../utils/polling';

test.use({ isolatedUserOptions: { isAdmin: true } });

test.describe(
  'Native ontology operations',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('links a table, binds a nested column, reloads, and unlinks it without changing the semantic model', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const name = `pw_native_binding_${uuid()}`;
      const table = new TableClass({ name });
      table.entity.columns = [
        {
          name: 'profile',
          dataType: DataType.Struct,
          dataTypeDisplay: 'struct<customer_id:string>',
          children: [
            {
              name: 'customer_id',
              dataType: DataType.String,
              dataTypeDisplay: 'string',
            },
          ],
        },
      ];
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: { name, iri: `urn:${name}`, namespace: `urn:${name}:` },
        }),
        'Create binding ontology'
      );
      try {
        await table.create(api);
        await waitForSearchIndexed(api, name, SearchIndex.TABLE, {
          matchBy: 'nameOrDisplayName',
        });
        const concept = await okJson<OntologyConcept>(
          await api.post('/api/v1/ontologyConcepts', {
            data: {
              name: 'Customer',
              ontology: ontology.fullyQualifiedName,
              conceptType: 'OWL_CLASS',
            },
          }),
          'Create bound concept'
        );
        const property = await okJson<OntologyProperty>(
          await api.post('/api/v1/ontologyProperties', {
            data: {
              name: 'customerId',
              ontology: ontology.fullyQualifiedName,
              kind: 'DATA',
              domain: [concept.iri],
              range: ['http://www.w3.org/2001/XMLSchema#string'],
            },
          }),
          'Create bound property'
        );
        const state = await okJson<OntologyState>(
          await api.get(`/api/v1/ontologies/${ontology.id}/state`),
          'Read semantic state before operational bindings'
        );
        const bindingPath = `/api/v1/ontologyConcepts/${concept.id}/bindings`;
        await page.goto(
          `/governance/ontology?ontology=${ontology.id}&concept=${concept.id}`
        );
        await page.getByTestId('mode-tab-edit').click();
        const inspector = page.getByTestId('ontology-concept-inspector');
        await test.step('Link the authorized table from the native inspector', async () => {
          await inspector.getByTestId('ontology-native-link-assets').click();
          const picker = inspector.getByTestId('ontology-data-asset-picker');
          await picker.getByRole('textbox').fill(name);
          await picker
            .getByTestId(
              `ontology-data-asset-option-${table.entityResponseData.id}`
            )
            .click();
          const linked = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === bindingPath &&
              response.request().method() === 'PUT'
          );
          await clickIgnoringToasts(
            picker.getByTestId('ontology-data-asset-save')
          );
          const response = await okJson<OntologyConceptBindingsResponse>(
            await linked,
            'Link native asset'
          );
          expect(response.assets.map((asset) => asset.assetId)).toContain(
            table.entityResponseData.id
          );
          await expect(
            inspector.getByTestId('ontology-native-assets')
          ).toContainText(table.entity.displayName);
        });
        await test.step('Bind the real nested column and preserve it after reload', async () => {
          await inspector
            .getByTestId(`ontology-bind-property-${property.id}`)
            .click();
          const editor = inspector.getByTestId(
            'ontology-column-binding-editor'
          );
          await selectOptionWithRetry(
            editor.getByRole('button', { name: 'Select Column', exact: true }),
            page.getByRole('option', { name: /profile › customer_id/ })
          );
          const saved = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === bindingPath &&
              response.request().method() === 'PUT'
          );
          await clickIgnoringToasts(
            editor.getByTestId('ontology-binding-save')
          );
          const bindings = await okJson<OntologyConceptBindingsResponse>(
            await saved,
            'Bind nested column'
          );
          expect(bindings.assets[0].columns).toEqual([
            expect.objectContaining({
              propertyId: property.id,
              columnPath: ['profile', 'customer_id'],
              state: 'resolved',
            }),
          ]);
          await page.reload();
          await expect(
            inspector.getByTestId('ontology-concept-properties')
          ).toContainText('profile › customer_id');
          await page.getByTestId('ontology-graph-mode-data').click();
          await expect(
            page.getByTestId('ontology-native-data-graph')
          ).toContainText('Data linked to Customer');
          expect(await readGraphEdges(page, 3)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                from: concept.id,
                relationType: 'columnBinding',
              }),
              expect.objectContaining({
                from: `asset:table:${table.entityResponseData.id}`,
                relationType: 'containsColumn',
              }),
            ])
          );
        });
        await test.step('Remove the column binding and table link', async () => {
          await page.getByTestId('ontology-graph-mode-model').click();
          await page.getByTestId('mode-tab-edit').click();
          const removed = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === bindingPath &&
              response.request().method() === 'PUT'
          );
          await clickIgnoringToasts(
            inspector.getByTestId(`ontology-binding-remove-${property.id}`)
          );
          expect(
            (
              await okJson<OntologyConceptBindingsResponse>(
                await removed,
                'Remove column binding'
              )
            ).assets[0].columns
          ).toEqual([]);
          const unlinked = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                `${bindingPath}/table/${table.entityResponseData.id}` &&
              response.request().method() === 'DELETE'
          );
          await clickIgnoringToasts(
            inspector.getByTestId(
              `ontology-native-asset-remove-${table.entityResponseData.id}`
            )
          );
          expect(
            (
              await okJson<OntologyConceptBindingsResponse>(
                await unlinked,
                'Unlink table'
              )
            ).assets
          ).toEqual([]);
          await page.reload();
          await expect(
            inspector.getByTestId('ontology-native-assets')
          ).not.toContainText(table.entity.displayName);
          const after = await okJson<OntologyState>(
            await api.get(`/api/v1/ontologies/${ontology.id}/state`),
            'Read semantic state after operational bindings'
          );
          expect(after.workingRevision).toBe(state.workingRevision);
        });
      } finally {
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true&hardDelete=true`
        );
        if (table.entityResponseData.id) await table.delete(api);
      }
    });

    for (const pack of [
      {
        id: 'fibo',
        base: 'foundations',
        extra: 'business-entities',
        label: 'Business Entity',
        fromOwner: false,
      },
      {
        id: 'fhir',
        base: 'core',
        extra: 'clinical',
        label: 'FHIR Resource',
        fromOwner: true,
      },
    ]) {
      test(`installs ${pack.id} into a new native ontology and explicitly reuses it without changes`, async ({
        isolatedUserPage: page,
      }) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const name = `pw_library_owner_${uuid()}`;
        const owner = await okJson<Ontology>(
          await api.post('/api/v1/ontologies', {
            data: { name, iri: `urn:${name}`, namespace: `urn:${name}:` },
          }),
          'Create source owner'
        );
        let installed: Ontology | undefined;
        let createdDraft: OntologyChangeSet | undefined;
        let draftWrites = 0;
        try {
          const before = await okJson<OntologyState>(
            await api.get(`/api/v1/ontologies/${owner.id}/state`),
            'Read original owner'
          );
          await page.goto(
            pack.fromOwner
              ? `/governance/ontology?ontology=${owner.id}`
              : '/governance/ontology'
          );
          await page.getByTestId('ontology-library-trigger').click();
          await expect(
            page.getByTestId('ontology-library-filter-all')
          ).toBeVisible();
          await expect(
            page.getByTestId(`ontology-library-filter-${pack.id}`)
          ).toBeVisible();
          await page.getByTestId(`ontology-pack-details-${pack.id}`).click();
          await expect(
            page.getByRole('button', { name: /Install to/ })
          ).toContainText('New ontology');
          await page.getByTestId(`ontology-module-${pack.base}`).click();
          await expect(
            page.getByTestId('ontology-pack-concept-count')
          ).toHaveText('0');
          await page.getByTestId(`ontology-module-${pack.extra}`).click();
          await expect(
            page.getByTestId('ontology-pack-concept-count')
          ).toHaveText('8');
          await page.route('**/api/v1/ontologyChangeSets', async (route) => {
            if (route.request().method() !== 'POST') {
              await route.continue();
              return;
            }
            draftWrites++;
            const response = await route.fetch();
            createdDraft = await okJson<OntologyChangeSet>(
              response,
              'Create native library draft'
            );
            if (pack.fromOwner && draftWrites === 1)
              await route.abort('failed');
            else await route.fulfill({ response });
          });
          const created = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/v1/ontologies' &&
              response.request().method() === 'POST'
          );
          await page.getByTestId('ontology-library-native-install').click();
          installed = await okJson<Ontology>(
            await created,
            'Install into new ontology'
          );
          await expect(
            page.getByTestId(`ontology-pack-${pack.id}`)
          ).toContainText('Installed');
          await expect(
            page.getByTestId('ontology-library-installed-count')
          ).toContainText('1 installed');
          await expect(
            page.getByTestId(`ontology-pack-details-${pack.id}`)
          ).toContainText('View');
          await page.getByTestId(`ontology-pack-details-${pack.id}`).click();
          await expect(
            page.getByTestId('ontology-library-open-graph')
          ).toBeVisible();
          expect(draftWrites).toBe(1);
          expect(createdDraft?.baseWorkingRevision).toBe(1);
          const concepts = await okJson<{ data: OntologyConcept[] }>(
            await api.get('/api/v1/ontologyConcepts', {
              params: { ontology: installed.fullyQualifiedName, limit: 100 },
            }),
            'Read installed concepts'
          );
          expect(concepts.data).toHaveLength(8);
          const concept = concepts.data.find(
            (item) => item.displayName === pack.label
          );
          expect(concept?.iri).toMatch(/^https?:/);
          const after = await okJson<OntologyState>(
            await api.get(`/api/v1/ontologies/${owner.id}/state`),
            'Read unchanged original owner'
          );
          expect(after.workingRevision).toBe(before.workingRevision);
          await page.getByTestId('ontology-library-back').click();
          await expect(
            page.getByTestId(`ontology-pack-${pack.id}`)
          ).toContainText('Installed');
          await page.getByTestId(`ontology-pack-details-${pack.id}`).click();
          await page.getByTestId('ontology-library-open-graph').click();
          await expect(page).toHaveURL(new RegExp(`ontology=${installed.id}`));
          await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          expect(concept).toBeDefined();
          expect(await readNodePositions(page)).toHaveProperty(
            concept?.id ?? 'missing-concept'
          );
          await page.getByTestId('ontology-library-trigger').click();
          await page.getByTestId(`ontology-pack-details-${pack.id}`).click();
          await page.getByRole('button', { name: /Install to/ }).click();
          await page
            .getByRole('option', {
              name: installed.displayName ?? installed.name,
              exact: true,
            })
            .click();
          const previewPath = `/api/v1/ontologies/${installed.id}/library/${pack.id}/preview`;
          const replayed = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === previewPath &&
              response.request().method() === 'POST'
          );
          await page.getByTestId('ontology-library-native-install').click();
          expect(
            (
              await okJson<CreateOntologyChangeSet>(
                await replayed,
                'Preview existing native target'
              )
            ).operations
          ).toEqual([]);
          await expect(
            page.getByTestId(`ontology-pack-${pack.id}`)
          ).toContainText('Installed');
          await page.getByTestId(`ontology-pack-details-${pack.id}`).click();
          await expect(
            page
              .getByTestId('ontology-library')
              .getByText('No changes to save', { exact: true })
          ).toBeVisible();
          expect(draftWrites).toBe(1);
        } finally {
          await page.unroute('**/api/v1/ontologyChangeSets');
          if (createdDraft)
            await deleteFixtureEntity(
              api,
              `/api/v1/ontologyChangeSets/${createdDraft.id}?hardDelete=true`
            );
          if (installed)
            await deleteFixtureEntity(
              api,
              `/api/v1/ontologies/${installed.id}?recursive=true&hardDelete=true`
            );
          await deleteFixtureEntity(
            api,
            `/api/v1/ontologies/${owner.id}?recursive=true&hardDelete=true`
          );
        }
      });
    }

    test('retries failed review submission across tabs using the same captured release', async ({
      isolatedUserPage: page,
      freshUserPage: { user },
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const name = `pw_native_retry_${uuid()}`;
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: {
            name,
            iri: `urn:${name}`,
            namespace: `urn:${name}:`,
            reviewers: [{ id: user.responseData.id, type: 'user' }],
          },
        }),
        'Create review retry ontology'
      );
      let task: Task | undefined;
      try {
        await page.goto(`/governance/ontology?ontology=${ontology.id}`);
        await page.getByTestId('ontology-publication-trigger').click();
        await page
          .getByTestId('ontology-release-notes')
          .getByRole('textbox')
          .fill('Review this exact candidate');
        await page.route('**/api/v1/tasks', (route) =>
          route.request().method() === 'POST'
            ? route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: JSON.stringify({
                  message: 'Temporary task service failure',
                }),
              })
            : route.continue()
        );
        const captured = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname ===
              `/api/v1/ontologies/${ontology.id}/releases` &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-request-review').click();
        const release = await okJson<OntologyRelease>(
          await captured,
          'Capture review candidate'
        );
        await expect(page.getByTestId('ontology-request-review')).toHaveText(
          'Retry review'
        );
        await page.getByTestId('ontology-publication-tab-releases').click();
        await expect(
          page.getByTestId('ontology-release-history')
        ).toContainText('Review this exact candidate');
        await page.getByTestId('ontology-publication-tab-changes').click();
        await expect(
          page.getByTestId('ontology-release-notes').getByRole('textbox')
        ).toHaveValue('Review this exact candidate');
        await page.unroute('**/api/v1/tasks');
        const submitted = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/api/v1/tasks' &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-request-review').click();
        task = await okJson<Task>(
          await submitted,
          'Retry real review task submission'
        );
        await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
        const history = await okJson<{ data: OntologyRelease[] }>(
          await api.get(`/api/v1/ontologies/${ontology.id}/releases`),
          'Read owner release history'
        );
        expect(history.data.map((item) => item.id)).toEqual([release.id]);
        const reviewed = await okJson<OntologyRelease>(
          await api.get(`/api/v1/ontologyReleases/${release.id}`),
          'Read captured release task'
        );
        expect(reviewed.reviewTask).toBe(task.id);
      } finally {
        await page.unroute('**/api/v1/tasks');
        if (task) {
          const review = await okJson<Task>(
            await api.get(`/api/v1/tasks/${task.id}`),
            'Read fixture review'
          );
          if (!review.resolution) {
            await okJson<Task>(
              await api.post(`/api/v1/tasks/${task.id}/close`, { data: {} }),
              'Close fixture review'
            );
          }
          await expect
            .poll(
              async () => {
                const response = await api.delete(
                  `/api/v1/tasks/${review.id}?hardDelete=true`
                );
                if (response.ok() || response.status() === 404) return true;
                const body: unknown = await response.json();
                if (
                  response.status() === 400 &&
                  typeof body === 'object' &&
                  body !== null &&
                  'message' in body &&
                  body.message ===
                    'Close the ontology review and wait for workflow cleanup before deleting its task'
                ) {
                  return false;
                }
                throw new Error(
                  `Delete fixture review failed (${response.status()}): ${JSON.stringify(
                    body
                  )}`
                );
              },
              { timeout: 90_000, intervals: [1000, 2000, 5000] }
            )
            .toBe(true);
        }
        const archived = await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true`
        );
        expect(archived.ok()).toBe(true);
        expect(
          (await api.get(`/api/v1/ontologies/${ontology.id}`)).status()
        ).toBe(404);
      }
    });
  }
);
