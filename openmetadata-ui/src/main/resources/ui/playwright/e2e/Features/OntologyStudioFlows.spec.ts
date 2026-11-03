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
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
  uuid,
} from '../../utils/common';
import {
  attachStudioShot,
  clickGraphNode,
  createFlowOntology,
  findEmptyCanvasPoint,
  openOntologyInStudio,
  readNodePositions,
  removeFlowOntologies,
  STUDIO_PATH,
} from '../../utils/ontologyStudio';
import { disableAiAppMode, enableAiAppMode } from '../Utils/appMode';
import { UserClass } from '../../support/user/UserClass';

test.use({ isolatedUserOptions: { isAdmin: true } });

const MODES = ['ai', 'classic'] as const;
type AppMode = (typeof MODES)[number];

const useMode = (page: Page, mode: AppMode) =>
  mode === 'ai' ? enableAiAppMode(page) : disableAiAppMode(page);

const isOntologyPost = (request: { url(): string; method(): string }) =>
  new URL(request.url()).pathname === '/api/v1/ontologies' &&
  request.method() === 'POST';

const isApply = (response: {
  url(): string;
  request(): { method(): string };
}) =>
  response.url().includes('/ontologyChangeSets/') &&
  response.url().endsWith('/apply') &&
  response.request().method() === 'POST';

const pickPerson = async (
  page: Page,
  field: 'Owners' | 'Reviewers',
  name: string
) => {
  const input = page
    .getByTestId('ontology-create-dialog')
    .getByRole('combobox', { name: field });
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

const hideCatalog = async (page: Page) => {
  let created = false;
  page.on('request', (request) => {
    if (isOntologyPost(request)) {
      created = true;
    }
  });
  await page.route(
    (url) => url.pathname === '/api/v1/ontologies',
    async (route) => {
      if (route.request().method() === 'GET' && !created) {
        await route.fulfill({ json: { data: [], paging: { total: 0 } } });
      } else {
        await route.fallback();
      }
    }
  );
};

const addConceptFromDrawer = async (page: Page, label: string) => {
  await expect(page.getByTestId('ontology-new-class-panel')).toBeVisible();
  await page.getByTestId('new-class-label').fill(label);
  const applied = page.waitForResponse(isApply);
  await clickIgnoringToasts(page.getByTestId('new-class-create'));
  expect((await applied).status()).toBe(200);
  await expect(page.getByTestId('ontology-new-class-panel')).toHaveCount(0);
};

test.describe(
  'Ontology Studio flows',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const mode of MODES) {
      test(`flow 1: creating from the picker and from the empty state lands in Edit with the owners and reviewers chosen, in ${mode} mode`, async ({
        isolatedUserPage: page,
        isolatedUser,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const reviewer = new UserClass();
        await reviewer.create(api);
        const created: Ontology[] = [];
        try {
          await useMode(page, mode);
          await page.goto(STUDIO_PATH);
          await expect(
            page.getByTestId('ontology-scope-menu-trigger')
          ).toBeVisible();

          await page.getByTestId('ontology-scope-menu-trigger').click();
          await page.getByTestId('ontology-create').click();
          await expect(
            page.getByTestId('ontology-create-dialog')
          ).toBeVisible();
          await page
            .getByTestId('ontology-create-name')
            .fill(`PW P1 picker ${mode} ${uuid()}`);
          await pickPerson(
            page,
            'Reviewers',
            reviewer.responseData.displayName
          );
          const fromPicker = page.waitForResponse((response) =>
            isOntologyPost(response.request())
          );
          await page.getByTestId('ontology-create-submit').click();
          const picked = await okJson<Ontology>(
            await fromPicker,
            'Create from the picker'
          );
          created.push(picked);
          await expect(page).toHaveURL(
            new RegExp(`[?&]ontology=${picked.id}(?:&|$)`)
          );
          await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toBeVisible();
          const read = await okJson<Ontology>(
            await api.get(
              `/api/v1/ontologies/${picked.id}?fields=owners,reviewers`
            ),
            'Read the picker ontology'
          );
          expect(read.owners?.map(({ id }) => id)).toEqual([
            isolatedUser.responseData.id,
          ]);
          expect(read.reviewers?.map(({ id }) => id)).toEqual([
            reviewer.responseData.id,
          ]);
          await attachStudioShot(page, testInfo, `p1-create-picker-${mode}`);

          await hideCatalog(page);
          await page.goto(STUDIO_PATH);
          await expect(page.getByTestId('ontology-empty-state')).toBeVisible();
          await page
            .getByRole('button', { name: 'Create from scratch' })
            .click();
          await page
            .getByTestId('ontology-create-name')
            .fill(`PW P1 empty ${mode} ${uuid()}`);
          const fromEmpty = page.waitForResponse((response) =>
            isOntologyPost(response.request())
          );
          await page.getByTestId('ontology-create-submit').click();
          const empty = await okJson<Ontology>(
            await fromEmpty,
            'Create from the empty state'
          );
          created.push(empty);
          await expect(page).toHaveURL(
            new RegExp(`[?&]ontology=${empty.id}(?:&|$)`)
          );
          await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          const bare = await okJson<Ontology>(
            await api.get(
              `/api/v1/ontologies/${empty.id}?fields=owners,reviewers`
            ),
            'Read the empty-state ontology'
          );
          expect(bare.owners?.map(({ id }) => id)).toEqual([
            isolatedUser.responseData.id,
          ]);
          expect(bare.reviewers ?? []).toHaveLength(0);
          await attachStudioShot(page, testInfo, 'p1-create');
        } finally {
          await removeFlowOntologies(api, created);
          await reviewer.delete(api);
        }
      });
    }

    for (const mode of MODES) {
      test(`flow 2: create refuses a taken name and a forbidden character, and a name that differs only in digits gets its own prefix, in ${mode} mode`, async ({
        isolatedUserPage: page,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const suffix = uuid();
        const taken = await okJson<Ontology>(
          await api.post('/api/v1/ontologies', {
            data: {
              name: `pw_p1_taken_${suffix}`,
              displayName: `Qzx Flow 37973 ${suffix}`,
              iri: `urn:pw_p1_taken_${suffix}`,
              namespace: `urn:pw_p1_taken_${suffix}:`,
            },
          }),
          'Create the taken ontology'
        );
        const created: Ontology[] = [taken];
        try {
          await useMode(page, mode);
          await page.goto(STUDIO_PATH);
          await page.getByTestId('ontology-scope-menu-trigger').click();
          await page.getByTestId('ontology-create').click();
          const dialog = page.getByTestId('ontology-create-dialog');
          const name = page.getByTestId('ontology-create-name');
          const submit = page.getByTestId('ontology-create-submit');
          let posts = 0;
          page.on('request', (request) => {
            if (isOntologyPost(request)) {
              posts += 1;
            }
          });

          await name.fill(`qzx flow 37973 ${suffix}`);
          await expect(dialog).toContainText('already exists');
          await expect(submit).toBeDisabled();
          await attachStudioShot(page, testInfo, `p1-create-errors-${mode}`);

          await name.fill('Finance "Core"');
          await expect(dialog).toContainText('cannot contain double quotes');
          await expect(submit).toBeDisabled();
          expect(posts).toBe(0);

          await name.fill(`Qzx Flow 38000 ${suffix}`);
          await expect(dialog).not.toContainText('already exists');
          await expect(submit).toBeEnabled();
          const response = page.waitForResponse((candidate) =>
            isOntologyPost(candidate.request())
          );
          await submit.click();
          const digits = await okJson<Ontology>(
            await response,
            'Create the digits-only difference'
          );
          created.push(digits);
          expect(digits.namespace).not.toBe(taken.namespace);
          expect(digits.iri).not.toBe(taken.iri);
          await expect(page).toHaveURL(
            new RegExp(`[?&]ontology=${digits.id}(?:&|$)`)
          );
        } finally {
          await removeFlowOntologies(api, created);
        }
      });

      test(`flow 3: a concept added from the toolbar, by double-click and from the Term tab opens one drawer and reaches the graph and the tree, in ${mode} mode`, async ({
        isolatedUserPage: page,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const { ontology, concepts } = await createFlowOntology(api, {
          prefix: 'pw_p1_concept',
          concepts: ['Existing'],
        });
        try {
          await useMode(page, mode);
          await openOntologyInStudio(page, ontology.id, '&mode=edit');
          await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          const before = Object.keys(await readNodePositions(page)).length;

          await page.getByTestId('ontology-add-concept').click();
          await addConceptFromDrawer(page, 'From Toolbar');

          const empty = await findEmptyCanvasPoint(page);
          await page.mouse.dblclick(empty.x, empty.y);
          await addConceptFromDrawer(page, 'From Canvas');

          await page.getByTestId('submode-tab-definitions').click();
          await page.getByTestId('ontology-add-concept').click();
          await addConceptFromDrawer(page, 'From Term Tab');

          const listed = await okJson<{ data: OntologyConcept[] }>(
            await api.get('/api/v1/ontologyConcepts', {
              params: { ontology: ontology.fullyQualifiedName, limit: 50 },
            }),
            'List the concepts'
          );
          expect(listed.data.map((concept) => concept.name).sort()).toEqual([
            'Existing',
            'FromCanvas',
            'FromTermTab',
            'FromToolbar',
          ]);

          await page.getByTestId('submode-tab-graph').click();
          await expect
            .poll(async () => Object.keys(await readNodePositions(page)).length)
            .toBe(before + 3);
          await attachStudioShot(page, testInfo, `p1-concept-${mode}`);

          await page.getByTestId('submode-tab-tree').click();
          for (const concept of listed.data) {
            await expect(
              page.getByTestId(`ontology-tree-term-${concept.id}`)
            ).toBeVisible();
          }
          expect(concepts).toHaveLength(1);
        } finally {
          await removeFlowOntologies(api, [ontology]);
        }
      });

      test(`flow 4: unsaved edits to an existing concept ask before a node click, a mode switch or closing the drawer, in ${mode} mode`, async ({
        isolatedUserPage: page,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const { ontology, concepts } = await createFlowOntology(api, {
          prefix: 'pw_p1_guard',
          concepts: ['First', 'Second'],
        });
        const [first, second] = concepts;
        const prompt = page.getByRole('dialog', {
          name: 'Discard your changes?',
        });
        const answer = async (button: 'Cancel' | 'Discard') => {
          await prompt
            .getByRole('button', { name: button, exact: true })
            .click();
          await expect(prompt).toHaveCount(0);
        };
        const description = page
          .getByTestId('ontology-concept-editor')
          .getByRole('textbox', { name: 'Description' });
        const startEditing = async (id: string, text: string) => {
          await clickGraphNode(page, id);
          await page.getByTestId('ontology-concept-edit').click();
          await description.fill(text);
        };
        try {
          await useMode(page, mode);
          await openOntologyInStudio(page, ontology.id, '&mode=edit');

          await startEditing(first.id, 'Unsaved first');
          await clickGraphNode(page, second.id);
          await expect(prompt).toBeVisible();
          await attachStudioShot(page, testInfo, `p1-guard-${mode}`);
          await answer('Cancel');
          await expect(description).toHaveValue('Unsaved first');
          await clickGraphNode(page, second.id);
          await answer('Discard');
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toContainText('Second');

          await startEditing(second.id, 'Unsaved second');
          await page.getByTestId('mode-tab-view').click();
          await answer('Cancel');
          await expect(description).toHaveValue('Unsaved second');
          await page.getByTestId('mode-tab-view').click();
          await answer('Discard');
          await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
            'aria-selected',
            'true'
          );

          await page.getByTestId('mode-tab-edit').click();
          await startEditing(first.id, 'Unsaved third');
          await page.getByTestId('ontology-concept-authoring-close').click();
          await answer('Cancel');
          await expect(description).toHaveValue('Unsaved third');
          await page.getByTestId('ontology-concept-authoring-close').click();
          await answer('Discard');
          await expect(page.getByTestId('ontology-concept-editor')).toHaveCount(
            0
          );

          const unchanged = await okJson<OntologyConcept>(
            await api.get(`/api/v1/ontologyConcepts/${first.id}`),
            'Read the concept'
          );
          expect(unchanged.description).toBe('First definition');
        } finally {
          await removeFlowOntologies(api, [ontology]);
        }
      });
    }
  }
);
