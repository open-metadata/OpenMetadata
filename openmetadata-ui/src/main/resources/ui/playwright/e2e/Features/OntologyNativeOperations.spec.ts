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
import { Status as InstallJobStatus } from '../../../src/generated/api/data/ontologyPackInstallJob';
import { Ontology } from '../../../src/generated/entity/data/ontology';
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
import {
  readNodePositions,
  waitForPackInstallJob,
} from '../../utils/ontologyStudio';
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
        // Switching mode is a press outside the concept drawer, which closes it, so the URL opens
        // the concept straight in Edit.
        const editConceptUrl = `/governance/ontology?ontology=${ontology.id}&concept=${concept.id}&mode=edit`;
        await page.goto(editConceptUrl);
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
          const columnSelect = editor.getByRole('button', {
            name: /profile › customer_id/,
          });
          // The editor pre-selects the column whose name matches the property.
          await expect(columnSelect).toBeVisible();
          await selectOptionWithRetry(
            columnSelect,
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
          // The open drawer covers the Model/Data switch.
          await inspector.getByTestId('ontology-concept-close').click();
          await expect(inspector).toHaveCount(0);
          await page.getByTestId('ontology-graph-mode-data').click();
          // Data mounts on first open, so the concept closed in Model is picked again here.
          await page
            .getByTestId('ontology-data-concept-picker-trigger')
            .click();
          await page
            .getByTestId(`ontology-data-concept-option-${concept.id}`)
            .click();
          const dataGraph = page.getByTestId('ontology-native-data-graph');
          await expect(
            dataGraph.getByTestId(`ontology-data-cluster-${concept.id}`)
          ).toContainText('Customer');
          const assetId = `asset:${concept.id}:${table.entityResponseData.id}`;
          await expect(
            dataGraph.getByTestId(`ontology-data-asset-${assetId}`)
          ).toContainText(table.entity.displayName);
          await expect(
            dataGraph.getByTestId(
              `ontology-data-asset-columns-toggle-${assetId}`
            )
          ).toHaveText('1 column');
        });
        await test.step('Remove the column binding and table link', async () => {
          await page.goto(editConceptUrl);
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
          const removeTable = inspector.getByTestId(
            `ontology-native-asset-remove-${table.entityResponseData.id}`
          );
          await clickIgnoringToasts(removeTable);
          // The unlink confirm is a centred page modal (#37780); its Cancel has no test id.
          const unlinkDialog = page.getByRole('dialog');
          await unlinkDialog
            .getByRole('button', { name: 'Cancel', exact: true })
            .click();
          await expect(unlinkDialog).toHaveCount(0);
          const retained = await okJson<OntologyConceptBindingsResponse>(
            await api.get(bindingPath),
            'Read cancelled unlink'
          );
          expect(retained.assets.map((asset) => asset.assetId)).toContain(
            table.entityResponseData.id
          );
          await clickIgnoringToasts(removeTable);
          const unlinked = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                `${bindingPath}/table/${table.entityResponseData.id}` &&
              response.request().method() === 'DELETE'
          );
          await page.getByTestId('ontology-unlink-confirm').click();
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
        id: 'sosa-ssn',
        industry: 'cross-industry',
        base: 'sosa',
        extra: 'ssn',
        label: 'Sensor',
        fromOwner: false,
      },
      {
        id: 'sosa-ssn',
        industry: 'cross-industry',
        base: 'sosa',
        extra: 'ssn',
        label: 'Sensor',
        fromOwner: true,
      },
    ]) {
      test(`installs ${pack.id} ${
        pack.fromOwner ? 'from a source ontology' : 'from the studio'
      } into a new native ontology and explicitly reuses it without changes`, async ({
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
        let installStarts = 0;
        const installRoute = `**/api/v1/ontologies/*/library/${pack.id}/install`;
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
            page.getByTestId(`ontology-library-filter-${pack.industry}`)
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
          ).toHaveText('27');
          await page.route(installRoute, async (route) => {
            installStarts++;
            if (pack.fromOwner && installStarts === 1)
              await route.abort('failed');
            else await route.continue();
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
          if (pack.fromOwner) {
            const install = page.getByTestId('ontology-library-native-install');
            await expect(install).toHaveText('Retry');
            await install.click();
          }
          await expect(
            page.getByTestId(`ontology-pack-${pack.id}`)
          ).toContainText('Installed');
          await expect(
            page.getByTestId('ontology-library-installed-count')
          ).toContainText('installed');
          await expect(
            page.getByTestId(`ontology-pack-details-${pack.id}`)
          ).toContainText('View');
          await page.getByTestId(`ontology-pack-details-${pack.id}`).click();
          await expect(
            page.getByTestId(`ontology-library-installed-in-${installed.id}`)
          ).toBeVisible();
          expect(installStarts).toBe(pack.fromOwner ? 2 : 1);
          const concepts = await okJson<{ data: OntologyConcept[] }>(
            await api.get('/api/v1/ontologyConcepts', {
              params: { ontology: installed.fullyQualifiedName, limit: 100 },
            }),
            'Read installed concepts'
          );
          expect(concepts.data).toHaveLength(22);
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
          await page
            .getByTestId(`ontology-library-installed-in-${installed.id}`)
            .click();
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
          const replayed = waitForPackInstallJob(page, installed.id);
          await page.getByTestId('ontology-library-native-install').click();
          expect(await replayed).toMatchObject({
            status: InstallJobStatus.Completed,
            total: 0,
          });
          await expect(
            page.getByTestId(`ontology-pack-${pack.id}`)
          ).toContainText('Installed');
          await page.getByTestId(`ontology-pack-details-${pack.id}`).click();
          await expect(
            page.getByTestId(`ontology-library-installed-in-${installed.id}`)
          ).toContainText(installed.displayName ?? installed.name);
        } finally {
          await page.unroute(installRoute);
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
                status: 422,
                contentType: 'application/json',
                body: JSON.stringify({
                  message: 'Task request rejected',
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
        // Only a definitive rejection offers a retry; a 5xx only offers Check status.
        await expect(page.getByTestId('ontology-recovery-action')).toHaveText(
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
        await page.getByTestId('ontology-recovery-action').click();
        task = await okJson<Task>(
          await submitted,
          'Retry real review task submission'
        );
        await expect(
          page.getByTestId('ontology-publication-notice-requested')
        ).toBeVisible();
        await expect(page).toHaveURL(/\/governance\/ontology/);
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
