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
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { Task } from '../../../src/generated/entity/tasks/task';
import { OntologyState } from '../../../src/generated/type/ontologyState';
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
  createUserWithRoles,
  openPageAs,
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
          ).toContainText('v0.1.0');
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
          ).toContainText(`v${release.semanticVersion}`);
          await attachStudioShot(author, testInfo, `p1-reviewed-${mode}`);
        } finally {
          await actors.cleanup();
        }
      });
    }
  }
);
