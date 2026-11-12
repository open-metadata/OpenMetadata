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

import { APIRequestContext, Browser, Page } from '@playwright/test';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { Task } from '../../../src/generated/entity/tasks/task';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { UserClass } from '../../support/user/UserClass';
import { okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
  uuid,
} from '../../utils/common';
import {
  attachStudioShot,
  clickGraphNode,
  createFlowConcept,
  createFlowOntology,
  createUserWithRoles,
  findEmptyCanvasPoint,
  openOntologyInStudio,
  openPageAs,
  readNodePositions,
  releaseNameContaining,
  removeFlowOntologies,
  STUDIO_PATH,
} from '../../utils/ontologyStudio';
import { disableAiAppMode, enableAiAppMode } from '../Utils/appMode';

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
        // Four random letters keep the 8-character prefix unique per run, so
        // no number is appended and the digit is the only thing that differs.
        const letters = [...suffix.slice(0, 4)]
          .map((digit) => String.fromCodePoint(97 + Number.parseInt(digit, 16)))
          .join('');
        const stem = `zq${letters}`;
        const { baseUri } = await okJson<{ baseUri: string }>(
          await api.get('/api/v1/rdf/status'),
          'Read the RDF base URI'
        );
        const ontologyIri = (prefix: string) =>
          `${baseUri.replace(/\/+$/, '')}/onto/${prefix}`;
        const taken = await okJson<Ontology>(
          await api.post('/api/v1/ontologies', {
            data: {
              name: `pw_p1_taken_${suffix}`,
              displayName: `${stem} 1`,
              iri: ontologyIri(`${stem}1`),
              namespace: `${ontologyIri(`${stem}1`)}#`,
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

          await name.fill(`${stem.toUpperCase()} 1`);
          await expect(dialog).toContainText('already exists');
          await expect(submit).toBeDisabled();
          await attachStudioShot(page, testInfo, `p1-create-errors-${mode}`);

          await name.fill('Finance "Core"');
          await expect(dialog).toContainText('cannot contain double quotes');
          await expect(submit).toBeDisabled();
          expect(posts).toBe(0);

          await name.fill(`${stem} 2`);
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
          expect(taken.iri).toBe(ontologyIri(`${stem}1`));
          expect(taken.namespace).toBe(`${ontologyIri(`${stem}1`)}#`);
          expect(digits.iri).toBe(ontologyIri(`${stem}2`));
          expect(digits.namespace).toBe(`${ontologyIri(`${stem}2`)}#`);
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

          // The graph re-renders after the first concept lands; a double-click in that window is
          // dropped, so re-measure and retry until the drawer opens.
          await expect(async () => {
            const empty = await findEmptyCanvasPoint(page);
            await page.mouse.dblclick(empty.x, empty.y);
            await expect(
              page.getByTestId('ontology-new-class-panel')
            ).toBeVisible({ timeout: 3000 });
          }).toPass({ timeout: 20000 });
          await addConceptFromDrawer(page, 'From Canvas');

          await page.getByTestId('submode-tab-definitions').click();
          await page
            .getByRole('tab', { name: 'Concepts', exact: true })
            .click();
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
          await page.getByTestId('ontology-concept-close').click();
          await answer('Cancel');
          await expect(description).toHaveValue('Unsaved third');
          await page.getByTestId('ontology-concept-close').click();
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

    const isActivation =
      (ontologyId: string) =>
      (response: { url(): string; request(): { method(): string } }) =>
        response
          .url()
          .endsWith(`/api/v1/ontologies/${ontologyId}/activation`) &&
        response.request().method() === 'PUT';

    const openPublicationDialog = async (page: Page, ontology: Ontology) => {
      await openOntologyInStudio(page, ontology.id);
      await page.getByTestId('ontology-publication-trigger').click();
      await expect(
        page.getByTestId('ontology-publication-modal')
      ).toBeVisible();
      await expect(page.getByTestId('ontology-publication-text')).toBeVisible();
    };

    const closePublicationDialog = async (page: Page) => {
      await page
        .getByTestId('ontology-publication-modal')
        .getByRole('button', { name: 'Close', exact: true })
        .click();
      await expect(page.getByTestId('ontology-publication-modal')).toHaveCount(
        0
      );
    };

    const reviewActors = async (
      api: APIRequestContext,
      browser: Browser,
      reviewerIds: (id: string) => string[] = () => []
    ) => {
      const author = await createUserWithRoles(api, ['OntologyAuthor']);
      const reviewer = await createUserWithRoles(api, ['OntologyReviewer']);
      const { ontology, concepts } = await createFlowOntology(api, {
        prefix: 'pw_p1_publish',
        ownerIds: [author.responseData.id],
        reviewerIds: reviewerIds(reviewer.responseData.id),
        concepts: ['Customer'],
      });
      const authorPage = await openPageAs(browser, author);
      const reviewerPage = await openPageAs(browser, reviewer);
      const tasks: string[] = [];
      const cleanup = async () => {
        await authorPage.close();
        await reviewerPage.close();
        for (const id of tasks) {
          const task = await okJson<Task>(
            await api.get(`/api/v1/tasks/${id}`),
            'Read the review task'
          );
          if (!task.resolution) {
            await api.post(`/api/v1/tasks/${id}/close`, { data: {} });
          }
          await api.delete(`/api/v1/tasks/${id}?hardDelete=true`);
        }
        await removeFlowOntologies(api, [ontology]);
        await author.delete(api);
        await reviewer.delete(api);
      };

      return {
        author,
        reviewer,
        ontology,
        concept: concepts[0],
        authorPage,
        reviewerPage,
        tasks,
        cleanup,
      };
    };

    const requestReview = async (page: Page, tasks: string[]) => {
      const submission = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/v1/tasks' &&
          response.request().method() === 'POST'
      );
      await clickIgnoringToasts(page.getByTestId('ontology-request-review'));
      const task = await okJson<Task>(await submission, 'Request review');
      tasks.push(task.id);

      return task;
    };

    const reviewNow = async (page: Page, ontology: Ontology) => {
      await openOntologyInStudio(page, ontology.id);
      await page
        .getByRole('button', { name: 'Review now', exact: true })
        .click();
      await expect(page.getByTestId('ontology-task-detail')).toBeVisible();
    };

    const decide = async (page: Page, button: string) => {
      const resolved = page.waitForResponse(
        (response) =>
          /\/api\/v1\/tasks\/[^/]+\/resolve$/.test(response.url()) &&
          response.request().method() === 'POST'
      );
      await clickIgnoringToasts(
        page
          .getByTestId('ontology-task-detail')
          .getByRole('button', { name: button, exact: true })
      );
      expect((await resolved).status()).toBe(200);
    };

    for (const mode of MODES) {
      test(`flow 5: an author publishes in one click when no reviewers are set and View shows the new version, in ${mode} mode`, async ({
        browser,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const actors = await reviewActors(api, browser);
        const { authorPage: page, ontology } = actors;
        try {
          await useMode(page, mode);
          await openPublicationDialog(page, ontology);
          await expect(page.getByTestId('ontology-publish-release')).toHaveText(
            'Publish v0.1.0'
          );
          await expect(page.getByTestId('ontology-request-review')).toHaveCount(
            0
          );
          const activation = page.waitForResponse(isActivation(ontology.id));
          await clickIgnoringToasts(
            page.getByTestId('ontology-publish-release')
          );
          const state = await okJson<OntologyState>(
            await activation,
            'Publish directly'
          );
          await expect(
            page.getByTestId('ontology-publication-notice-published')
          ).toContainText(`v0.1.0 published. Everyone using ${ontology.name}`);
          await attachStudioShot(page, testInfo, `p1-direct-${mode}`);
          await closePublicationDialog(page);

          await page.getByTestId('mode-tab-view').click();
          await page.getByTestId('ontology-version-published').click();
          await expect(page).toHaveURL(/version=published/);
          await expect(
            page.getByTestId('ontology-release-history-trigger')
          ).toHaveAccessibleName(releaseNameContaining('v0.1.0'));
          await page.getByTestId('submode-tab-tree').click();
          await expect(
            page.getByTestId(`ontology-tree-term-${actors.concept.id}`)
          ).toBeVisible();
          const release = await okJson<OntologyRelease>(
            await api.get(`/api/v1/ontologyReleases/${state.activeReleaseId}`),
            'Read the release'
          );
          expect(release.semanticVersion).toBe('0.1.0');
          expect(release.approvalBasis).toBe('NO_REVIEWERS_CONFIGURED');
        } finally {
          await actors.cleanup();
        }
      });

      test(`flow 6: a reviewer added in the publish dialog approves from Tasks, the author sees it in the Inbox and publishes, in ${mode} mode`, async ({
        browser,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const actors = await reviewActors(api, browser);
        const { authorPage: author, reviewerPage: reviewer, ontology } = actors;
        const reviewerName =
          actors.reviewer.responseData.displayName ??
          actors.reviewer.responseData.name;
        try {
          await useMode(author, mode);
          await openPublicationDialog(author, ontology);
          await expect(
            author.getByTestId('ontology-publish-release')
          ).toBeVisible();
          const picker = author
            .getByTestId('ontology-release-reviewers')
            .getByRole('combobox', { name: 'Add reviewer' });
          const option = author
            .getByRole('option')
            .filter({ hasText: reviewerName });
          await expect(async () => {
            await picker.click();
            await picker.fill('');
            await picker.fill(reviewerName);
            await expect(option).toBeVisible({ timeout: 5_000 });
          }).toPass({ timeout: 30_000 });
          await option.click();
          await expect(
            author.getByTestId('ontology-request-review')
          ).toBeEnabled();
          await expect(
            author.getByTestId('ontology-publish-release')
          ).toHaveCount(0);

          const task = await requestReview(author, actors.tasks);
          await expect(
            author.getByTestId('ontology-publication-notice-requested')
          ).toContainText(`sent to ${reviewerName} for review`);
          await expect(author).toHaveURL(/\/governance\/ontology/);

          await reviewNow(reviewer, ontology);
          await expect(
            reviewer.getByTestId('ontology-review-panel')
          ).toBeVisible();
          await decide(reviewer, 'Approve');
          await expect(
            reviewer.getByTestId('ontology-task-detail')
          ).toContainText('Approved');
          expect(
            (
              await okJson<Task>(
                await api.get(`/api/v1/tasks/${task.id}`),
                'Read the approved task'
              )
            ).resolution?.type
          ).toBeTruthy();

          // Classic mode has no Inbox route, so its author reads the decision in Studio.
          if (mode === 'ai') {
            await expect(async () => {
              await author.goto('/inbox/activity');
              await expect
                .poll(
                  () =>
                    author.getByText(`${reviewerName} approved v0.1.0`).count(),
                  { timeout: 10_000 }
                )
                .toBeGreaterThan(0);
            }).toPass({ timeout: 60_000 });
          } else {
            await openOntologyInStudio(author, ontology.id);
            await expect(
              author.getByTestId('ontology-review-decision-banner')
            ).toContainText(`${reviewerName} approved`);
          }
          await attachStudioShot(author, testInfo, `p1-reviewed-inbox-${mode}`);

          await openPublicationDialog(author, ontology);
          const activation = author.waitForResponse(isActivation(ontology.id));
          await clickIgnoringToasts(
            author.getByTestId('ontology-publish-release')
          );
          const state = await okJson<OntologyState>(
            await activation,
            'Publish the approved release'
          );
          const release = await okJson<OntologyRelease>(
            await api.get(`/api/v1/ontologyReleases/${state.activeReleaseId}`),
            'Read the published release'
          );
          expect(release.approvalBasis).toBe('REVIEWED');
          await closePublicationDialog(author);
          await author.getByTestId('mode-tab-view').click();
          await author.getByTestId('ontology-version-published').click();
          await expect(
            author.getByTestId('ontology-release-history-trigger')
          ).toHaveAccessibleName(
            releaseNameContaining(`v${release.semanticVersion}`)
          );
          await attachStudioShot(author, testInfo, `p1-reviewed-${mode}`);
        } finally {
          await actors.cleanup();
        }
      });
    }

    const editDescription = async (
      page: Page,
      conceptId: string,
      text: string
    ) => {
      await page.getByTestId('submode-tab-tree').click();
      await page.getByTestId(`ontology-tree-term-${conceptId}`).click();
      await page
        .getByTestId('ontology-concept-editor')
        .getByRole('textbox', { name: 'Description' })
        .fill(text);
      const saved = page.waitForResponse(
        (response) =>
          response.request().method() !== 'GET' &&
          /\/api\/v1\/ontology(ChangeSets|Concepts)\//.test(response.url())
      );
      await page
        .getByTestId('ontology-concept-editor')
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      expect((await saved).ok()).toBe(true);
    };

    for (const mode of MODES) {
      test(`flow 7: a rejection shows its reason to the author, who edits and asks again, and withdraws the second request, in ${mode} mode`, async ({
        browser,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const actors = await reviewActors(api, browser, (id) => [id]);
        const { authorPage: author, reviewerPage: reviewer, ontology } = actors;
        const reason = 'Add a label to Customer.';
        try {
          await useMode(author, mode);
          await openPublicationDialog(author, ontology);
          await requestReview(author, actors.tasks);
          await expect(
            author.getByTestId('ontology-publication-notice-requested')
          ).toBeVisible();

          await reviewNow(reviewer, ontology);
          await reviewer
            .getByTestId('ontology-task-detail')
            .getByRole('button', { name: 'Reject', exact: true })
            .click();
          await reviewer.getByLabel('Reason').fill(reason);
          await decide(reviewer, 'Reject with comment');
          await expect(
            reviewer.getByTestId('ontology-task-detail')
          ).toContainText(reason);

          await openPublicationDialog(author, ontology);
          await expect(
            author.getByTestId('ontology-rejection-reason')
          ).toHaveText(reason);
          await expect(
            author.getByTestId('ontology-request-review')
          ).toBeDisabled();
          await attachStudioShot(
            author,
            testInfo,
            `p1-reject-withdraw-${mode}`
          );
          await closePublicationDialog(author);

          await openOntologyInStudio(author, ontology.id, '&mode=edit');
          await editDescription(
            author,
            actors.concept.id,
            'Customer, relabelled'
          );

          await openPublicationDialog(author, ontology);
          await expect(
            author.getByTestId('ontology-request-review')
          ).toBeEnabled();
          const second = await requestReview(author, actors.tasks);
          await expect(
            author.getByTestId('ontology-publication-notice-requested')
          ).toBeVisible();

          const closed = author.waitForResponse(
            (response) =>
              response.url().endsWith(`/api/v1/tasks/${second.id}/close`) &&
              response.request().method() === 'POST'
          );
          await author.getByTestId('ontology-withdraw-request').click();
          expect((await closed).status()).toBe(200);
          await expect(
            author.getByTestId('ontology-publication-notice-withdrawn')
          ).toContainText('withdrawn. The release is a draft again.');
          await expect(
            author.getByTestId('ontology-request-review')
          ).toBeEnabled();

          const releases = await okJson<{ data: OntologyRelease[] }>(
            await api.get(`/api/v1/ontologies/${ontology.id}/releases`),
            'List the releases'
          );
          const latest = await okJson<OntologyRelease>(
            await api.get(`/api/v1/ontologyReleases/${releases.data[0].id}`),
            'Read the withdrawn release'
          );
          expect(latest.entityStatus).toBe('Draft');
        } finally {
          await actors.cleanup();
        }
      });

      test(`flow 8: each role sees only the actions it allows, in ${mode} mode`, async ({
        browser,
      }) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const { ontology } = await createFlowOntology(api, {
          prefix: 'pw_p1_roles',
          concepts: ['Customer', 'Order'],
        });
        const state = await okJson<OntologyState>(
          await api.get(`/api/v1/ontologies/${ontology.id}/state`),
          'Read the fence'
        );
        const release = await okJson<OntologyRelease>(
          await api.post(`/api/v1/ontologies/${ontology.id}/releases`, {
            data: { expectedWorkingRevision: state.workingRevision },
          }),
          'Capture the release'
        );
        await okJson(
          await api.put(`/api/v1/ontologies/${ontology.id}/activation`, {
            data: {
              releaseId: release.id,
              expectedActivationRevision: state.activationRevision,
            },
          }),
          'Publish the release'
        );
        const roles = {
          OntologyAuthor: true,
          DataSteward: true,
          OntologyReviewer: false,
          DataConsumer: false,
        } as const;
        const users: UserClass[] = [];
        const pages: Page[] = [];
        try {
          for (const [role, canWrite] of Object.entries(roles)) {
            const user = await createUserWithRoles(api, [
              role as keyof typeof roles,
            ]);
            users.push(user);
            const page = await openPageAs(browser, user);
            pages.push(page);
            await useMode(page, mode);
            await openOntologyInStudio(page, ontology.id, '&mode=edit');

            await expect(page.getByTestId('mode-tab-view')).toBeVisible();
            await expect(page.getByTestId('mode-tab-query')).toBeVisible();
            await expect(
              page.getByTestId('ontology-tasks-trigger')
            ).toBeVisible();
            const writes = canWrite ? 1 : 0;
            await expect(
              page.getByTestId('mode-tab-edit'),
              `${role} Edit tab`
            ).toHaveCount(writes);
            await expect(
              page.getByTestId('ontology-publication-trigger'),
              `${role} Publish`
            ).toHaveCount(writes);
            await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
              'aria-selected',
              canWrite ? 'false' : 'true'
            );
            if (canWrite) {
              await expect(
                page.getByTestId('ontology-add-concept')
              ).toBeVisible();
            } else {
              await expect(
                page.getByTestId('ontology-add-concept')
              ).toHaveCount(0);
            }
            await page.getByTestId('ontology-scope-menu-trigger').click();
            await expect(
              page.getByTestId('ontology-create'),
              `${role} Create ontology`
            ).toHaveCount(writes);
            await page.keyboard.press('Escape');
          }
          await attachStudioShot(
            pages[pages.length - 1],
            test.info(),
            'p1-roles'
          );
        } finally {
          await Promise.all(pages.map((page) => page.close()));
          await removeFlowOntologies(api, [ontology]);
          for (const user of users) {
            await user.delete(api);
          }
        }
      });

      test(`flow 9: an author rolls back to an older release, View shows it, and compare lists the differences, in ${mode} mode`, async ({
        browser,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const author = await createUserWithRoles(api, ['OntologyAuthor']);
        const { ontology, concepts } = await createFlowOntology(api, {
          prefix: 'pw_p1_history',
          ownerIds: [author.responseData.id],
          concepts: ['Customer'],
        });
        const seal = async (notes: string) => {
          const state = await okJson<OntologyState>(
            await api.get(`/api/v1/ontologies/${ontology.id}/state`),
            'Read the fence'
          );
          const release = await okJson<OntologyRelease>(
            await api.post(`/api/v1/ontologies/${ontology.id}/releases`, {
              data: {
                expectedWorkingRevision: state.workingRevision,
                expectedLatestReleaseRevision: state.lastReleaseRevision,
                expectedActivationRevision: state.activationRevision,
                versionBump: 'minor',
                releaseNotes: notes,
              },
            }),
            'Seal the release'
          );
          await okJson(
            await api.put(`/api/v1/ontologies/${ontology.id}/activation`, {
              data: {
                releaseId: release.id,
                expectedActivationRevision: state.activationRevision,
              },
            }),
            'Publish the release'
          );

          return release;
        };
        const page = await openPageAs(browser, author);
        try {
          const first = await seal('first cut');
          await okJson(
            await api.patch(`/api/v1/ontologyConcepts/${concepts[0].id}`, {
              headers: { 'Content-Type': 'application/json-patch+json' },
              data: [
                { op: 'replace', path: '/description', value: 'Customer v2' },
              ],
            }),
            'Edit the concept'
          );
          await createFlowConcept(api, ontology, 'Invoice');
          const second = await seal('second pass');
          expect([first.semanticVersion, second.semanticVersion]).toEqual([
            '0.1.0',
            '0.2.0',
          ]);

          await useMode(page, mode);
          await openOntologyInStudio(page, ontology.id);
          await page.getByTestId('ontology-release-history-trigger').click();
          await expect(page.getByTestId('ontology-release-row')).toHaveCount(2);

          // AI mode keeps Compare on its own screen behind the history toolbar.
          if (mode === 'ai') {
            await page.getByTestId('ontology-release-compare-open').click();
          }
          await page
            .getByRole('button', { name: 'From version', exact: true })
            .click();
          await page.getByText('0.1.0 (').click();
          await page
            .getByRole('button', { name: 'To version', exact: true })
            .click();
          await page.getByText('0.2.0 (').click();
          await expect(
            page.getByTestId('ontology-compare-added')
          ).toContainText('Invoice');
          await expect(
            page.getByTestId('ontology-compare-changed')
          ).toContainText('Customer');
          await expect(page.getByTestId('ontology-compare-counts')).toHaveText(
            '2 changes · 2 concepts'
          );
          await attachStudioShot(page, testInfo, `p1-history-compare-${mode}`);

          if (mode === 'ai') {
            await page.getByTestId('ontology-release-compare-back').click();
          }
          await page.getByTestId(`ontology-release-select-${first.id}`).click();
          const activation = page.waitForResponse(isActivation(ontology.id));
          await page.getByTestId('ontology-rollback-release').click();
          await clickIgnoringToasts(
            page.getByTestId('ontology-rollback-confirm')
          );
          const rolled = await okJson<OntologyState>(
            await activation,
            'Roll back'
          );
          expect(rolled.activeReleaseId).toBe(first.id);
          await closePublicationDialog(page);

          await page.getByTestId('mode-tab-view').click();
          await page.getByTestId('ontology-version-published').click();
          await expect(
            page.getByTestId('ontology-release-history-trigger')
          ).toHaveAccessibleName(releaseNameContaining('v0.1.0'));
          await page.getByTestId('submode-tab-tree').click();
          await expect(
            page.getByTestId('ontology-tree-term-' + concepts[0].id)
          ).toBeVisible();
          await expect(page.getByRole('treegrid').getByRole('row')).toHaveCount(
            1
          );
          await attachStudioShot(page, testInfo, `p1-history-${mode}`);
        } finally {
          await page.close();
          await removeFlowOntologies(api, [ontology]);
          await author.delete(api);
        }
      });

      test(`flow 10: the tree and the graph reach every concept from the keyboard and Enter opens it, in ${mode} mode`, async ({
        isolatedUserPage: page,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const { ontology, concepts } = await createFlowOntology(api, {
          prefix: 'pw_p1_keys',
          concepts: ['Alpha', 'Bravo', 'Charlie'],
        });
        const inspector = page.getByTestId('ontology-concept-inspector');
        try {
          await useMode(page, mode);
          await openOntologyInStudio(page, ontology.id);

          const rowOf = (id: string) =>
            page.getByTestId(`ontology-tree-term-${id}`);
          await page.getByTestId('submode-tab-tree').click();
          await expect(page.getByRole('treegrid').getByRole('row')).toHaveCount(
            3
          );
          await rowOf(concepts[0].id).focus();
          for (const [index, concept] of concepts.entries()) {
            await expect(rowOf(concept.id)).toBeFocused();
            await page.keyboard.press('Enter');
            await expect(inspector).toContainText(concept.name);
            await expect(page).toHaveURL(
              new RegExp(`[?&]concept=${concept.id}(&|$)`)
            );
            if (index < concepts.length - 1) {
              await rowOf(concept.id).focus();
              await page.keyboard.press('ArrowDown');
            }
          }
          for (const concept of [concepts[0], concepts[1]]) {
            await rowOf(concept.id).click();
            await expect(inspector).toContainText(concept.name);
            await expect(page).toHaveURL(
              new RegExp(`[?&]concept=${concept.id}(&|$)`)
            );
          }
          await attachStudioShot(page, testInfo, `p1-keyboard-${mode}`);

          await page.getByTestId('submode-tab-graph').click();
          const list = page.getByRole('listbox', { name: 'Concepts (3)' });
          for (
            let presses = 0;
            presses < 150 &&
            !(await list.evaluate((el) => el === document.activeElement));
            presses += 1
          ) {
            await page.keyboard.press('Tab');
          }
          await expect(list).toBeFocused();
          const names = (await list.getByRole('option').allTextContents()).map(
            (name) => name.trim()
          );
          expect([...names].sort()).toEqual(['Alpha', 'Bravo', 'Charlie']);
          await page.keyboard.press('Home');
          for (const [index, name] of names.entries()) {
            await page.keyboard.press('Enter');
            await expect(inspector).toContainText(name);
            const opened = concepts.find((concept) => concept.name === name);
            await expect(page).toHaveURL(
              new RegExp(`[?&]concept=${opened?.id}(&|$)`)
            );
            await expect(list).toBeFocused();
            if (index < names.length - 1) {
              await page.keyboard.press('ArrowDown');
            }
          }
        } finally {
          await removeFlowOntologies(api, [ontology]);
        }
      });
    }
  }
);
