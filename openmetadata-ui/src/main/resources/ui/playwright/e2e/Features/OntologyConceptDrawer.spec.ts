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
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';
import { clickGraphNode, readNodePositions } from '../../utils/ontologyStudio';

test.use({ isolatedUserOptions: { isAdmin: true } });

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const DRAFT_PROMPT = 'Discard your changes?';

const createOntology = async (api: APIRequestContext, prefix: string) => {
  const name = `pw_${prefix}_${uuid()}`;

  return okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: { name, iri: 'urn:' + name, namespace: 'urn:' + name + ':' },
    }),
    'Create drawer ontology'
  );
};

const createConcept = async (
  api: APIRequestContext,
  owner: Ontology,
  name: string
) =>
  okJson<OntologyConcept>(
    await api.post('/api/v1/ontologyConcepts', {
      data: {
        name,
        displayName: name,
        ontology: owner.fullyQualifiedName,
        conceptType: 'OWL_CLASS',
        iri: owner.namespace + name,
      },
    }),
    'Create drawer fixture concept'
  );

const listConcepts = async (api: APIRequestContext, owner: Ontology) =>
  (
    await okJson<{ data: OntologyConcept[] }>(
      await api.get('/api/v1/ontologyConcepts', {
        params: {
          ontology: owner.fullyQualifiedName,
          fields: 'conceptMappings,synonyms',
          limit: 100,
        },
      }),
      'List drawer concepts'
    )
  ).data;

const removeOntology = async (api: APIRequestContext, owner: Ontology) =>
  deleteFixtureEntity(
    api,
    '/api/v1/ontologies/' + owner.id + '?recursive=true&hardDelete=true'
  );

const drawerFieldIds = async (page: Page) =>
  page
    .getByTestId('ontology-new-class-panel')
    .locator('[data-testid^="new-class-"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-testid'))
    );

const submitDrawer = async (page: Page, testId: string) => {
  const applied = page.waitForResponse(
    (response) =>
      response.url().endsWith('/apply') &&
      response.request().method() === 'POST'
  );
  await page.getByTestId(testId).click();
  expect((await applied).ok()).toBe(true);
};

const closeDraftPrompt = async (page: Page, button: 'Cancel' | 'Discard') => {
  const prompt = page.getByRole('dialog', { name: DRAFT_PROMPT });
  await prompt.getByRole('button', { name: button, exact: true }).click();
  // The canvas ignores clicks until the modal overlay has gone.
  await expect(prompt).toHaveCount(0);
};

for (const mode of ['classic', 'ai'] as const) {
  test.describe(
    `One concept drawer in ${mode} mode`,
    { tag: ['@Features', '@Governance'] },
    () => {
      let api: APIRequestContext;
      let owner: Ontology;

      test.beforeEach(async ({ isolatedUser: user }) => {
        api = await getWorkerAdminAPIContext();
        owner = await createOntology(api, 'concept_drawer');
        await okJson(
          await api.put(
            '/api/v1/users/' + user.responseData.id + '/preferences/appMode',
            { data: { type: 'appMode', config: { value: mode } } }
          ),
          'Set own app mode'
        );
      });

      test.afterEach(async () => {
        await removeOntology(api, owner);
      });

      test('the toolbar, the canvas button, the empty state and the Term tab open the same form', async ({
        isolatedUserPage: page,
      }, testInfo) => {
        test.slow();
        await createConcept(api, owner, 'Existing');
        const empty = await createOntology(api, 'concept_drawer_empty');
        try {
          await page.goto('/governance/ontology?ontology=' + owner.id);
          await page.getByTestId('mode-tab-edit').click();
          await page.getByTestId('ontology-add-concept').click();
          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toBeVisible();
          const fromToolbar = await drawerFieldIds(page);

          expect(fromToolbar).toEqual(
            expect.arrayContaining([
              'new-class-local-name',
              'new-class-label',
              'new-class-description',
              'new-class-iri-input',
              'new-class-synonyms',
              'new-class-mapping-iri',
              'new-class-advanced-toggle',
              'new-class-create-another',
              'new-class-create',
            ])
          );
          await page.screenshot({
            path: testInfo.outputPath(`g10-one-form-${mode}.png`),
          });
          await page.getByTestId('ontology-new-class-close').click();

          await page.getByTestId('ontology-canvas-add-concept').click();
          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toBeVisible();

          expect(await drawerFieldIds(page)).toEqual(fromToolbar);

          await page.getByTestId('ontology-new-class-close').click();
          await page.getByTestId('submode-tab-definitions').click();
          await page.getByTestId('ontology-add-concept').click();
          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toBeVisible();
          await expect(page.getByTestId('ontology-concept-editor')).toHaveCount(
            0
          );

          expect(await drawerFieldIds(page)).toEqual(fromToolbar);

          await page.goto('/governance/ontology?ontology=' + empty.id);
          await page.getByTestId('mode-tab-edit').click();
          await page.getByTestId('ontology-empty-card-add-concept').click();
          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toBeVisible();

          expect(await drawerFieldIds(page)).toEqual(fromToolbar);
        } finally {
          await removeOntology(api, empty);
        }
      });

      test('creates an OWL class, a SKOS concept and a Both concept with Create & add another', async ({
        isolatedUserPage: page,
      }, testInfo) => {
        test.slow();
        await createConcept(api, owner, 'Existing');
        await page.goto('/governance/ontology?ontology=' + owner.id);
        await page.getByTestId('mode-tab-edit').click();
        await page.getByTestId('ontology-add-concept').click();
        const nodesBefore = Object.keys(await readNodePositions(page)).length;
        const types = [
          ['Owl Thing', 'OWL_CLASS'],
          ['Skos Thing', 'SKOS_CONCEPT'],
          ['Both Thing', 'BOTH'],
        ] as const;
        for (const [index, [label, type]] of types.entries()) {
          await page.getByTestId('new-class-label').fill(label);
          if (type !== 'OWL_CLASS') {
            await page.getByTestId('new-class-type-' + type).click();
          }
          await submitDrawer(
            page,
            index < types.length - 1
              ? 'new-class-create-another'
              : 'new-class-create'
          );
          if (index < types.length - 1) {
            await expect(
              page.getByTestId('new-class-local-name')
            ).toBeFocused();
            await expect(page.getByTestId('new-class-label')).toHaveValue('');
            await expect(page.getByTestId('new-class-save-status')).toHaveText(
              'All changes saved'
            );
            await expect(
              page.getByTestId('ontology-new-class-panel')
            ).toBeVisible();
          }
        }
        await expect(page.getByTestId('ontology-new-class-panel')).toHaveCount(
          0
        );
        await page.screenshot({
          path: testInfo.outputPath(`g10-add-another-${mode}.png`),
        });

        const created = await listConcepts(api, owner);

        expect(
          Object.fromEntries(created.map((c) => [c.name, c.conceptType]))
        ).toMatchObject({
          OwlThing: 'OWL_CLASS',
          SkosThing: 'SKOS_CONCEPT',
          BothThing: 'BOTH',
        });
        await expect
          .poll(async () => Object.keys(await readNodePositions(page)).length)
          .toBe(nodesBefore + 3);
      });

      test('saves synonyms and two mappings that survive a reload', async ({
        isolatedUserPage: page,
      }) => {
        test.slow();
        await createConcept(api, owner, 'Existing');
        await page.goto('/governance/ontology?ontology=' + owner.id);
        await page.getByTestId('mode-tab-edit').click();
        await page.getByTestId('ontology-add-concept').click();
        await page.getByTestId('new-class-label').fill('Remittance');
        await page.getByTestId('new-class-synonyms').fill('Wire,');
        await page.getByTestId('new-class-synonyms').fill('Transfer');
        await page.getByTestId('new-class-synonyms').press('Enter');
        await page
          .getByTestId('new-class-mapping-iri')
          .fill('https://schema.org/Payment');
        await page.getByTestId('new-class-add-mapping').click();
        await page.getByRole('button', { name: /Mapping type/ }).click();
        await page.getByRole('option', { name: 'Close match' }).click();
        await page
          .getByTestId('new-class-mapping-iri')
          .fill('https://example.org/Remit');
        await page.getByTestId('new-class-add-mapping').click();
        await expect(page.getByTestId('new-class-mapping')).toHaveText([
          'Exact match · https://schema.org/Payment',
          'Close match · https://example.org/Remit',
        ]);
        await submitDrawer(page, 'new-class-create');
        await page.reload();

        const created = (await listConcepts(api, owner)).find(
          (c) => c.name === 'Remittance'
        );

        expect(created?.synonyms).toEqual(['Wire', 'Transfer']);
        expect(
          created?.conceptMappings?.map((m) => [m.mappingType, m.conceptIri])
        ).toEqual([
          ['EXACT_MATCH', 'https://schema.org/Payment'],
          ['CLOSE_MATCH', 'https://example.org/Remit'],
        ]);
      });

      test('blocks a duplicate name, a duplicate label and Spaced Name! with a message', async ({
        isolatedUserPage: page,
      }, testInfo) => {
        await createConcept(api, owner, 'Customer');
        const posted: string[] = [];
        page.on('request', (request) => {
          if (
            request.method() === 'POST' &&
            request.url().includes('/ontologyChangeSets')
          ) {
            posted.push(request.url());
          }
        });
        await page.goto('/governance/ontology?ontology=' + owner.id);
        await page.getByTestId('mode-tab-edit').click();
        await page.getByTestId('ontology-add-concept').click();
        const panel = page.getByTestId('ontology-new-class-panel');
        const create = page.getByTestId('new-class-create');

        await expect(create).toBeDisabled();
        await expect(page.getByTestId('new-class-create-reason')).toHaveText(
          'Enter a name.'
        );

        await page.getByTestId('new-class-local-name').fill('Spaced Name!');

        await expect(create).toBeDisabled();
        await expect(panel).toContainText(/Spaces are not allowed/);
        await expect(page.getByTestId('new-class-iri')).not.toHaveText(
          UUID_PATTERN
        );

        await page.getByTestId('new-class-local-name').fill('Customer');

        await expect(create).toBeDisabled();
        await expect(panel).toContainText(
          'A definition named Customer already exists'
        );

        await page.getByTestId('new-class-local-name').fill('Buyer');
        await page.getByTestId('new-class-label').fill('customer');

        await expect(create).toBeDisabled();
        await expect(panel).toContainText(
          'A concept labeled customer already exists'
        );
        await page.screenshot({
          path: testInfo.outputPath(`g10-validation-${mode}.png`),
        });

        await page.getByTestId('new-class-label').fill('Spaced Name');
        await page.getByTestId('new-class-local-name').fill('');

        await expect(page.getByTestId('new-class-local-name')).toHaveValue('');

        await page.getByTestId('new-class-local-name').fill('SpacedName');

        await expect(create).toBeEnabled();
        await expect(page.getByTestId('new-class-iri')).toHaveText(
          owner.namespace + 'SpacedName'
        );
        expect(posted).toEqual([]);
      });

      test('keeps a unicode name valid and states that the IRI cannot change later', async ({
        isolatedUserPage: page,
      }) => {
        test.slow();
        await createConcept(api, owner, 'Existing');
        await page.goto('/governance/ontology?ontology=' + owner.id);
        await page.getByTestId('mode-tab-edit').click();
        await page.getByTestId('ontology-add-concept').click();
        await page.getByTestId('new-class-label').fill('Überweisung');

        await expect(page.getByTestId('new-class-local-name')).toHaveValue(
          'Überweisung'
        );
        await expect(page.getByTestId('new-class-iri')).toHaveText(
          owner.namespace + 'Überweisung'
        );
        await expect(
          page.getByText(
            'The IRI cannot be changed after the concept is created'
          )
        ).toBeVisible();

        await page.getByTestId('new-class-local-name').fill('Zahlung');

        await expect(page.getByTestId('new-class-iri')).toHaveText(
          owner.namespace + 'Zahlung'
        );
        await expect(page.getByTestId('new-class-create')).toBeEnabled();

        await page.getByTestId('new-class-local-name').fill('Überweisung');
        await submitDrawer(page, 'new-class-create');

        const created = (await listConcepts(api, owner)).find(
          (c) => c.displayName === 'Überweisung'
        );

        expect(created?.iri).toBe(owner.namespace + 'Überweisung');
      });

      test('creates without the lease 404 or the unbound-query 400', async ({
        isolatedUserPage: page,
      }) => {
        test.slow();
        await createConcept(api, owner, 'Existing');
        const failures: string[] = [];
        page.on('response', (response) => {
          const url = response.url();
          if (
            (url.includes('/ontologyEditLocks') && response.status() === 404) ||
            (url.endsWith('/query') && response.status() === 400)
          ) {
            failures.push(response.status() + ' ' + url);
          }
        });
        await page.goto('/governance/ontology?ontology=' + owner.id);
        await page.getByTestId('mode-tab-edit').click();
        await page.getByTestId('ontology-add-concept').click();
        await page.getByTestId('new-class-label').fill('Clean Log');
        await submitDrawer(page, 'new-class-create');
        await expect(
          page.getByTestId('ontology-concept-inspector')
        ).toContainText('Clean Log');

        expect(failures).toEqual([]);
      });

      test('Undo on the create toast removes the concept and restores the Publish count', async ({
        isolatedUserPage: page,
      }) => {
        test.slow();
        await createConcept(api, owner, 'Existing');
        await page.goto('/governance/ontology?ontology=' + owner.id);
        await page.getByTestId('mode-tab-edit').click();
        const publish = page.getByTestId('ontology-publication-trigger');
        const before = await publish.textContent();
        const nodesBefore = Object.keys(await readNodePositions(page)).length;
        await page.getByTestId('ontology-add-concept').click();
        await page.getByTestId('new-class-label').fill('Undo Me');
        await submitDrawer(page, 'new-class-create');
        await expect(page.getByTestId('ontology-undo')).toBeVisible();

        expect((await listConcepts(api, owner)).map((c) => c.name)).toContain(
          'UndoMe'
        );

        await page.getByTestId('ontology-undo').click();

        await expect
          .poll(async () => (await listConcepts(api, owner)).map((c) => c.name))
          .not.toContain('UndoMe');
        await expect
          .poll(async () => Object.keys(await readNodePositions(page)).length)
          .toBe(nodesBefore);
        await expect(publish).toHaveText(before ?? '');
      });

      test('Undo on the delete toast restores a soft-deleted concept', async ({
        isolatedUserPage: page,
      }) => {
        test.slow();
        await createConcept(api, owner, 'Removable');
        await page.goto('/governance/ontology?ontology=' + owner.id);
        await page.getByTestId('mode-tab-edit').click();
        await page.getByTestId('submode-tab-definitions').click();
        await page.getByRole('button', { name: 'Removable' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await page.getByTestId('ontology-concept-delete-confirm').click();
        await expect(page.getByTestId('ontology-undo')).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Removable' })
        ).toHaveCount(0);

        await page.getByTestId('ontology-undo').click();

        await expect(
          page.getByRole('button', { name: 'Removable' })
        ).toBeVisible();
        expect((await listConcepts(api, owner)).map((c) => c.name)).toContain(
          'Removable'
        );
      });

      test('Add concept in All ontologies opens the drawer with a required Ontology field', async ({
        isolatedUserPage: page,
      }, testInfo) => {
        test.slow();
        const other = await createOntology(api, 'concept_drawer_other');
        try {
          await createConcept(api, owner, 'Payment');
          await page.goto('/governance/ontology');
          await page.getByTestId('mode-tab-edit').click();
          await expect(
            page.getByRole('button', { name: /Select Ontology/ })
          ).toHaveCount(0);
          await page.getByTestId('ontology-add-concept').click();
          const panel = page.getByTestId('ontology-new-class-panel');
          await expect(panel).toBeVisible();
          await expect(page.getByTestId('new-class-ontology')).toBeVisible();
          await expect(page.getByTestId('new-class-in-ontology')).toContainText(
            /^in /
          );
          await page.screenshot({
            path: testInfo.outputPath(`g10-all-ontologies-${mode}.png`),
          });

          const choose = async (target: Ontology) => {
            await page
              .getByTestId('new-class-ontology')
              .getByRole('button')
              .click();
            await page
              .getByRole('option', { name: target.name, exact: true })
              .click();
            await expect(page.getByTestId('new-class-in-ontology')).toHaveText(
              'in ' + target.name
            );
          };

          await choose(owner);
          await page.getByTestId('new-class-advanced-toggle').click();
          const parent = page.getByRole('combobox', {
            name: 'Subclass of',
            exact: true,
          });
          await parent.fill('Payment');
          await page
            .getByRole('option', { name: 'Payment', exact: true })
            .click();
          await parent.press('Escape');
          await expect(
            page.getByTestId('new-class-advanced').getByText('Payment')
          ).toBeVisible();

          await choose(other);
          await page.getByTestId('new-class-advanced-toggle').click();
          await expect(
            page.getByTestId('new-class-advanced').getByText('Payment')
          ).toHaveCount(0);

          await page.getByTestId('new-class-label').fill('Remote Concept');
          await submitDrawer(page, 'new-class-create');

          expect((await listConcepts(api, other)).map((c) => c.name)).toEqual([
            'RemoteConcept',
          ]);
          expect(
            (await listConcepts(api, owner)).map((c) => c.name)
          ).not.toContain('RemoteConcept');
        } finally {
          await removeOntology(api, other);
        }
      });

      test('guards unsaved text when switching nodes, switching mode and closing the drawer', async ({
        isolatedUserPage: page,
      }, testInfo) => {
        test.slow();
        const first = await createConcept(api, owner, 'First');
        const second = await createConcept(api, owner, 'Second');
        await page.goto('/governance/ontology?ontology=' + owner.id);
        await page.getByTestId('mode-tab-edit').click();
        await page.getByTestId('ontology-add-concept').click();
        await page.getByTestId('new-class-label').fill('Unsaved class');
        await expect(page.getByTestId('new-class-save-status')).toHaveText(
          'Unsaved changes'
        );

        await test.step('switching nodes', async () => {
          await clickGraphNode(page, first.id);
          await expect(
            page.getByRole('dialog', { name: DRAFT_PROMPT })
          ).toBeVisible();
          await page.screenshot({
            path: testInfo.outputPath(`g10-guard-${mode}.png`),
          });
          await closeDraftPrompt(page, 'Cancel');

          await expect(page.getByTestId('new-class-label')).toHaveValue(
            'Unsaved class'
          );

          await clickGraphNode(page, second.id);
          await closeDraftPrompt(page, 'Discard');

          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toHaveCount(0);
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toContainText('Second');
        });

        await test.step('switching mode', async () => {
          await page.getByTestId('ontology-add-concept').click();
          await page.getByTestId('new-class-label').fill('Unsaved again');
          await page.getByTestId('mode-tab-view').click();
          await closeDraftPrompt(page, 'Cancel');

          await expect(page.getByTestId('new-class-label')).toHaveValue(
            'Unsaved again'
          );

          await page.getByTestId('mode-tab-view').click();
          await closeDraftPrompt(page, 'Discard');

          await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toHaveCount(0);
        });

        await test.step('closing the drawer', async () => {
          await page.getByTestId('mode-tab-edit').click();
          await page.getByTestId('ontology-add-concept').click();
          await page.getByTestId('new-class-label').fill('Unsaved third');
          await page.getByTestId('ontology-new-class-close').click();
          await closeDraftPrompt(page, 'Cancel');

          await expect(page.getByTestId('new-class-label')).toHaveValue(
            'Unsaved third'
          );

          await page.getByTestId('ontology-new-class-close').click();
          await closeDraftPrompt(page, 'Discard');

          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toHaveCount(0);
        });
      });
    }
  );
}
