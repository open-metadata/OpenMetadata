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

import { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { readFile } from 'fs/promises';
import { SearchIndex } from '../../../src/enums/search.enum';
import { OntologyReleaseDiff } from '../../../src/generated/api/data/ontologyReleaseDiff';
import { ContextMemory } from '../../../src/generated/entity/context/contextMemory';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyChangeSet } from '../../../src/generated/entity/data/ontologyChangeSet';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { Task } from '../../../src/generated/entity/tasks/task';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { fillCodeEditor } from '../../utils/codeEditor';
import {
  clickIgnoringToasts,
  fullUuid,
  getApiContext,
  getWorkerAdminAPIContext,
  uuid,
} from '../../utils/common';
import { MEMORIES_API } from '../../utils/ContextCenterUtil';
import {
  findOntologyInScopeMenu,
  readNodePositions,
} from '../../utils/ontologyStudio';
import { waitForSearchIndexed } from '../../utils/polling';

test.use({ isolatedUserOptions: { isAdmin: true } });

const submitReview = async (
  api: APIRequestContext,
  type: string,
  fqn: string,
  tasks: string[]
) => {
  const task = await okJson<Task>(
    await api.post('/api/v1/tasks', {
      data: {
        name: `Review ${fqn}`,
        category: 'Approval',
        type: 'RequestApproval',
        about: `<#E::${type}::${fqn}>`,
      },
    }),
    'Submit ontology review'
  );
  tasks.push(task.id);
  await expect
    .poll(async () => {
      const ready = await okJson<Task>(
        await api.get(`/api/v1/tasks/${task.id}`),
        'Read ontology review'
      );

      return ready.availableTransitions?.length;
    })
    .toBe(2);

  return task;
};

const approveReview = async (page: Page, task: Task) => {
  const resolution = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/tasks/${task.id}/resolve`) &&
      response.request().method() === 'POST'
  );
  await page.getByTestId('task-approve').click();
  expect((await resolution).status()).toBe(200);
  await expect(page.getByTestId('task-status-badge')).toHaveText('Approved');
};

const selectOntology = async (page: Page, ontology: Ontology) => {
  const scopeMenu = page.getByTestId('ontology-scope-menu-trigger');
  await scopeMenu.click();
  const node = await findOntologyInScopeMenu(page, ontology);
  await expect(node).toBeVisible();
  await node.click();
  await expect(scopeMenu).toHaveAttribute(
    'data-scope-key',
    `ontology:${ontology.id}`
  );
  await expect(page).toHaveURL(
    new RegExp(`[?&]ontology=${ontology.id}(?:&|$)`)
  );
};

// An approved release offers only Publish, so callers past approval skip the draft check.
const openPublication = async (
  page: Page,
  ontology: Ontology,
  expectDraftAction = true
) => {
  await page.goto(`/governance/ontology?ontology=${ontology.id}`);
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
  await page.getByTestId('ontology-publication-trigger').click();
  await expect(page.getByTestId('ontology-publication-modal')).toBeVisible();
  if (expectDraftAction) {
    await expect(
      page.getByRole('button', { name: 'Save as release draft', exact: true })
    ).toBeEnabled();
  }
};

const activateRelease = async (
  page: Page,
  ontology: Ontology,
  release: OntologyRelease,
  expectedRevision: number,
  action: 'publish' | 'rollback',
  testInfo: TestInfo,
  activeVersion?: string
) => {
  const activation = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/ontologies/${ontology.id}/activation`) &&
      response.request().method() === 'PUT'
  );
  if (action === 'rollback') {
    await page.getByTestId('ontology-rollback-release').click();
    await expect(page.getByTestId('ontology-rollback-confirmation')).toHaveText(
      `${ontology.name} is on v${activeVersion}. Rolling back to v${release.semanticVersion} makes v${release.semanticVersion} the version everyone sees.`
    );
    await g6Shot(page, testInfo, 'rollback');
    await clickIgnoringToasts(page.getByTestId('ontology-rollback-confirm'));
  } else {
    await clickIgnoringToasts(page.getByTestId('ontology-publish-release'));
  }
  const response = await activation;
  expect(response.request().postDataJSON()).toEqual({
    releaseId: release.id,
    expectedActivationRevision: expectedRevision,
  });
  const state = await okJson<OntologyState>(
    response,
    'Activate captured release'
  );
  expect(state.activeReleaseId).toBe(release.id);
  expect(state.activationRevision).toBe(expectedRevision + 1);
  await expect(
    page.getByTestId('ontology-release-history-trigger')
  ).toContainText(release.semanticVersion ?? String(release.releaseRevision));
  if (action === 'publish') {
    await expect(page.getByTestId('ontology-release-stage')).toContainText(
      'Published'
    );
  }
  await expect(page.getByTestId('ontology-active-release')).toHaveText(
    'Active'
  );
  await expect(
    page.getByRole('button', { name: 'Activate release', exact: true })
  ).toHaveCount(0);
};

const g6Shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const path = testInfo.outputPath(`g6-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`g6-${name}`, { path, contentType: 'image/png' });
};

const cleanReviews = async (api: APIRequestContext, tasks: string[]) => {
  for (const id of tasks) {
    const task = await okJson<Task>(
      await api.get(`/api/v1/tasks/${id}`),
      'Read fixture review'
    );
    if (!task.resolution) {
      await okJson<Task>(
        await api.post(`/api/v1/tasks/${id}/close`, { data: {} }),
        'Close fixture review'
      );
    }
    await deleteFixtureEntity(api, `/api/v1/tasks/${id}?hardDelete=true`);
  }
};

test.describe(
  'Native ontology review',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const status of [403, 404]) {
      test(`preserves native scope and exposes recovery when a deep link fails with ${status}`, async ({
        freshUserPage: { page },
      }) => {
        const ontologyId = fullUuid();
        const ontologyPath = `/api/v1/ontologies/${ontologyId}`;
        await page.route(`**${ontologyPath}?*`, (route) =>
          route.fulfill({ status, json: { message: 'Ontology unavailable' } })
        );
        const loading = page.waitForResponse(
          (response) => new URL(response.url()).pathname === ontologyPath
        );
        await page.goto(
          `/governance/ontology?ontology=${ontologyId}&draft=${fullUuid()}&source=context-center`
        );

        expect((await loading).status()).toBe(status);
        await expect(page).toHaveURL(new RegExp('ontology=' + ontologyId));
        await expect(
          page.getByTestId('ontology-studio-shell').getByRole('alert')
        ).toBeVisible();
        await expect(
          page.getByTestId('ontology-scope-menu-trigger')
        ).toHaveText('Ontology');
        await expect(page.getByTestId('ontology-explorer')).toHaveCount(0);
        if (status === 404) {
          await expect(page.getByTestId('ontology-not-found')).toContainText(
            'This ontology was not found.'
          );
          await expect(
            page.getByRole('button', { name: 'Reload', exact: true })
          ).toHaveCount(0);
        } else {
          await expect(
            page.getByRole('button', { name: 'Reload', exact: true })
          ).toBeVisible();
        }
        await page
          .getByRole('button', { name: 'All ontologies', exact: true })
          .click();
        await expect(page).toHaveURL(
          /\/governance\/ontology\?source=context-center$/
        );
        await expect(
          page.getByTestId('ontology-scope-menu-trigger')
        ).toHaveAttribute('data-scope-key', 'ontology:all');
      });
    }

    test('reviews frozen release contents and blocks approval when they cannot be loaded', async ({
      freshUserPage: { page, user },
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const name = `pw_ontology_review_${uuid()}`;
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: {
            name,
            iri: `https://example.org/${name}`,
            namespace: `https://example.org/${name}/`,
            reviewers: [{ id: user.responseData.id, type: 'user' }],
          },
        }),
        'Create reviewed ontology'
      );
      const tasks: string[] = [];

      try {
        const concept = await okJson<OntologyConcept>(
          await api.post('/api/v1/ontologyConcepts', {
            data: {
              name: 'Customer',
              ontology: ontology.fullyQualifiedName,
              conceptType: 'OWL_CLASS',
              description: 'Submitted customer definition',
            },
          }),
          'Create ontology concept'
        );
        const state = await okJson<OntologyState>(
          await api.get(`/api/v1/ontologies/${ontology.id}/state`),
          'Read ontology revision'
        );
        const release = await okJson<OntologyRelease>(
          await api.post(`/api/v1/ontologies/${ontology.id}/releases`, {
            data: { expectedWorkingRevision: state.workingRevision },
          }),
          'Capture ontology release'
        );
        const releaseTask = await submitReview(
          api,
          'ontologyRelease',
          release.fullyQualifiedName,
          tasks
        );

        await test.step('Missing submitted content fails visibly and can be retried', async () => {
          const versionPath = `**/api/v1/ontologyReleases/${release.id}/versions/*`;
          await page.route(versionPath, (route) =>
            route.fulfill({
              status: 404,
              json: { message: 'Version unavailable' },
            })
          );
          await page.goto(`/tasks/${releaseTask.id}`);
          const error = page.getByRole('alert').filter({
            hasText: 'The submitted version could not be loaded',
          });
          await expect(error).toBeVisible();
          await expect(page.getByTestId('task-approve')).toHaveCount(0);
          await expect(
            page.getByTestId('ontology-review-field-changes')
          ).toHaveCount(0);
          await page.unroute(versionPath);
          await error
            .getByRole('button', { name: 'Retry', exact: true })
            .click();
          await page
            .getByTestId('ontology-review-panel')
            .getByRole('button', { name: 'Customer', exact: true })
            .click();
          await expect(
            page.getByTestId('ontology-review-field-changes')
          ).toContainText('Submitted customer definition');
        });

        await test.step('Release review keeps the captured content after a draft edit', async () => {
          const updated = await okJson<OntologyConcept>(
            await api.patch(`/api/v1/ontologyConcepts/${concept.id}`, {
              headers: { 'Content-Type': 'application/json-patch+json' },
              data: [
                {
                  op: 'replace',
                  path: '/description',
                  value: 'Later draft definition',
                },
              ],
            }),
            'Edit the working concept'
          );
          expect(updated.description).toBe('Later draft definition');

          await page.goto(`/tasks/${releaseTask.id}`);
          const review = page.getByTestId('ontology-review-panel');
          await review
            .getByRole('button', { name: 'Customer', exact: true })
            .click();
          const definition = review.getByTestId(
            'ontology-review-field-changes'
          );
          await expect(definition).toContainText(
            'Submitted customer definition'
          );
          await expect(definition).not.toContainText('Later draft definition');
          await page.screenshot({
            path: testInfo.outputPath('captured-review.png'),
            fullPage: true,
          });

          await approveReview(page, releaseTask);
          const approved = await okJson<OntologyRelease>(
            await api.get(`/api/v1/ontologyReleases/${release.id}`),
            'Read approved release'
          );
          expect(approved.entityStatus).toBe('Approved');
          const currentState = await okJson<OntologyState>(
            await api.get(`/api/v1/ontologies/${ontology.id}/state`),
            'Read publication state'
          );
          expect(currentState.activeReleaseId).toBeUndefined();
        });
      } finally {
        await cleanReviews(api, tasks);
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true`
        );
      }
    });
  }
);

test.describe(
  'Native ontology publication',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('manages reviewers with reload persistence and locks settings during an open review', async ({
      isolatedUserPage: author,
      isolatedUser,
    }) => {
      const api = await getWorkerAdminAPIContext();
      // Only needs to exist as a pickable user, so skip a browser sign-in.
      const reviewer = new UserClass();
      const teamName = `pw_review_team_${uuid()}`;
      const team = new TeamClass({
        name: teamName,
        displayName: teamName,
        description: 'Review exclusion fixture',
        teamType: 'Group',
        users: [],
        policies: [],
      });
      const name = `pw_review_settings_${uuid()}`;
      const tasks: string[] = [];
      let ontology: Ontology | undefined;
      try {
        await reviewer.create(api);
        await team.create(api);
        await waitForSearchIndexed(
          api,
          reviewer.responseData.name,
          SearchIndex.USER,
          {
            matchBy: 'nameOrDisplayName',
          }
        );
        await waitForSearchIndexed(
          api,
          isolatedUser.responseData.name,
          SearchIndex.USER,
          { matchBy: 'nameOrDisplayName' }
        );
        await waitForSearchIndexed(
          api,
          team.responseData.name,
          SearchIndex.TEAM,
          {
            matchBy: 'nameOrDisplayName',
          }
        );
        ontology = await okJson<Ontology>(
          await api.post('/api/v1/ontologies', {
            data: {
              name,
              iri: `urn:${name}`,
              namespace: `urn:${name}:`,
              reviewers: [],
            },
          }),
          'Create reviewer settings ontology'
        );
        const ontologyId = ontology.id;
        await okJson<OntologyConcept>(
          await api.post('/api/v1/ontologyConcepts', {
            data: {
              name: 'Customer',
              ontology: ontology.fullyQualifiedName,
              conceptType: 'OWL_CLASS',
            },
          }),
          'Create reviewable concept'
        );
        await author.goto(`/governance/ontology?ontology=${ontology.id}`);
        await author.getByTestId('ontology-publication-trigger').click();
        const card = author.getByTestId('ontology-release-reviewers');
        const picker = card.getByRole('combobox', { name: 'Add reviewer' });
        const searchFor = async (name: string) => {
          const users = author.waitForResponse((response) => {
            const url = new URL(response.url());

            return (
              url.pathname === '/api/v1/search/query' &&
              url.searchParams.get('q') === name &&
              url.searchParams.get('index') === SearchIndex.USER
            );
          });
          const teams = author.waitForResponse((response) => {
            const url = new URL(response.url());

            return (
              url.pathname === '/api/v1/search/query' &&
              url.searchParams.get('q') === name &&
              url.searchParams.get('index') === SearchIndex.TEAM
            );
          });
          await picker.fill(name);
          expect((await users).status()).toBe(200);
          expect((await teams).status()).toBe(200);
          await expect(picker).toHaveValue(name);
        };

        await test.step('Add a user and exclude the current user, added user and teams', async () => {
          await expect(picker).toBeEnabled();
          await searchFor(reviewer.responseData.name);
          const firstAddition = author.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                `/api/v1/ontologies/${ontologyId}` &&
              response.request().method() === 'PATCH'
          );
          await author
            .getByRole('option', {
              name:
                reviewer.responseData.displayName ?? reviewer.responseData.name,
            })
            .click();
          expect((await firstAddition).status()).toBe(200);
          await expect(card).toContainText(
            reviewer.responseData.displayName ?? reviewer.responseData.name
          );
          await picker.fill(reviewer.responseData.name);
          await expect(picker).toHaveValue(reviewer.responseData.name);
          await expect(
            author.getByRole('option', {
              name:
                reviewer.responseData.displayName ?? reviewer.responseData.name,
            })
          ).toHaveCount(0);
          await searchFor(isolatedUser.responseData.name);
          await expect(
            author.getByRole('option', {
              name:
                isolatedUser.responseData.displayName ??
                isolatedUser.responseData.name,
            })
          ).toHaveCount(0);
          await searchFor(team.responseData.name);
          await expect(
            author.getByRole('option', { name: team.responseData.displayName })
          ).toHaveCount(0);
        });

        await test.step('Remove and restore the reviewer across reloads', async () => {
          await author.reload();
          await author.getByTestId('ontology-publication-trigger').click();
          const restored = author.getByTestId('ontology-release-reviewers');
          const row = restored.getByRole('row', {
            name: new RegExp(
              reviewer.responseData.displayName ?? reviewer.responseData.name
            ),
          });
          await expect(row).toBeVisible();
          const removal = author.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                `/api/v1/ontologies/${ontologyId}` &&
              response.request().method() === 'PATCH'
          );
          await row.press('Delete');
          expect((await removal).status()).toBe(200);
          await expect(row).toHaveCount(0);
          await author.reload();
          await author.getByTestId('ontology-publication-trigger').click();
          const emptyCard = author.getByTestId('ontology-release-reviewers');
          await expect(emptyCard).toContainText('No configured reviewers');
          const emptyPicker = emptyCard.getByRole('combobox', {
            name: 'Add reviewer',
          });
          await emptyPicker.fill(reviewer.responseData.name);
          const addition = author.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                `/api/v1/ontologies/${ontologyId}` &&
              response.request().method() === 'PATCH'
          );
          await author
            .getByRole('option', {
              name:
                reviewer.responseData.displayName ?? reviewer.responseData.name,
            })
            .click();
          expect((await addition).status()).toBe(200);
          await expect(emptyCard).toContainText(
            reviewer.responseData.displayName ?? reviewer.responseData.name
          );
        });

        await test.step('Freeze reviewer and rule controls for the submitted review', async () => {
          const rule = author
            .getByTestId('ontology-release-reviewers')
            .getByRole('button', {
              name: 'Any one',
            });
          await rule.click();
          const ruleUpdate = author.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                `/api/v1/ontologies/${ontologyId}` &&
              response.request().method() === 'PATCH'
          );
          await author
            .getByRole('option', { name: 'All', exact: true })
            .click();
          expect((await ruleUpdate).status()).toBe(200);
          const state = await okJson<OntologyState>(
            await api.get(`/api/v1/ontologies/${ontologyId}/state`),
            'Read reviewer settings revision'
          );
          const release = await okJson<OntologyRelease>(
            await api.post(`/api/v1/ontologies/${ontologyId}/releases`, {
              data: { expectedWorkingRevision: state.workingRevision },
            }),
            'Capture reviewer settings release'
          );
          await submitReview(
            api,
            'ontologyRelease',
            release.fullyQualifiedName,
            tasks
          );
          await author.reload();
          await author.getByTestId('ontology-publication-trigger').click();
          const locked = author.getByTestId('ontology-release-reviewers');
          await expect(
            locked.getByRole('combobox', { name: 'Add reviewer' })
          ).toBeDisabled();
          // A locked control also renders a focusable tooltip trigger with the
          // same name, so match the disabled select itself.
          await expect(
            locked
              .getByRole('button', { name: 'All' })
              .and(author.locator('[data-disabled="true"]'))
          ).toBeVisible();
          await expect(locked).toContainText('locked by review');
          await expect(
            locked.getByRole('row', {
              name: new RegExp(
                reviewer.responseData.displayName ?? reviewer.responseData.name
              ),
            })
          ).toBeVisible();
        });
      } finally {
        await cleanReviews(api, tasks);
        if (ontology) {
          await deleteFixtureEntity(
            api,
            `/api/v1/ontologies/${ontology.id}?recursive=true`
          );
        }
        await team.delete(api);
        await reviewer.delete(api);
      }
    });

    test('shows the exact punctuation and newline reason after a reviewer rejects', async ({
      isolatedUserPage: author,
      freshUserPage: { page: reviewerPage, user: reviewer },
    }) => {
      const api = await getWorkerAdminAPIContext();
      const name = `pw_review_rejection_${uuid()}`;
      const reason =
        '<b>Reject this version.</b>\n  Keep “Customer”; fix range & retry.';
      const tasks: string[] = [];
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: {
            name,
            iri: `urn:${name}`,
            namespace: `urn:${name}:`,
            reviewers: [{ id: reviewer.responseData.id, type: 'user' }],
          },
        }),
        'Create rejection ontology'
      );
      try {
        await okJson<OntologyConcept>(
          await api.post('/api/v1/ontologyConcepts', {
            data: {
              name: 'Customer',
              ontology: ontology.fullyQualifiedName,
              conceptType: 'OWL_CLASS',
            },
          }),
          'Create rejected concept'
        );
        const state = await okJson<OntologyState>(
          await api.get(`/api/v1/ontologies/${ontology.id}/state`),
          'Read rejection revision'
        );
        const release = await okJson<OntologyRelease>(
          await api.post(`/api/v1/ontologies/${ontology.id}/releases`, {
            data: { expectedWorkingRevision: state.workingRevision },
          }),
          'Capture rejected release'
        );
        const task = await submitReview(
          api,
          'ontologyRelease',
          release.fullyQualifiedName,
          tasks
        );
        await reviewerPage.goto(`/tasks/${task.id}`);
        await expect(reviewerPage.getByTestId('task-reject')).toBeEnabled();
        await reviewerPage.getByTestId('task-reject').click();
        const comment = reviewerPage.getByTestId('task-action-comment');
        await comment.getByRole('textbox').fill(reason);
        const resolution = reviewerPage.waitForResponse(
          (response) =>
            response.url().endsWith(`/api/v1/tasks/${task.id}/resolve`) &&
            response.request().method() === 'POST'
        );
        await reviewerPage.getByTestId('task-action-comment-confirm').click();
        expect((await resolution).status()).toBe(200);
        await author.goto(`/governance/ontology?ontology=${ontology.id}`);
        await author.getByTestId('ontology-publication-trigger').click();
        const displayed = author.getByTestId('ontology-rejection-reason');
        await expect(displayed).toBeVisible();
        await expect(displayed).toHaveText(reason);
        await expect(displayed.locator('b')).toHaveCount(0);
        await expect(
          author.getByTestId('ontology-request-review')
        ).toBeDisabled();
      } finally {
        await cleanReviews(api, tasks);
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true`
        );
      }
    });

    test('captures, reviews, activates and rolls back sealed releases in Studio', async ({
      isolatedUserPage: author,
      freshUserPage: { page: reviewer, user },
    }, testInfo) => {
      test.slow();
      const pageErrors: string[] = [];
      author.on('pageerror', (error) => pageErrors.push(error.message));
      reviewer.on('pageerror', (error) => pageErrors.push(error.message));
      const api = await getWorkerAdminAPIContext();
      const name = `pw_publication_${uuid()}`;
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: {
            name,
            iri: `https://example.org/${name}`,
            namespace: `https://example.org/${name}/`,
            reviewers: [{ id: user.responseData.id, type: 'user' }],
          },
        }),
        'Create publication fixture'
      );
      const tasks: string[] = [];
      const releases: OntologyRelease[] = [];
      try {
        const concept = await okJson<OntologyConcept>(
          await api.post('/api/v1/ontologyConcepts', {
            data: {
              name: 'Customer',
              ontology: ontology.fullyQualifiedName,
              conceptType: 'OWL_CLASS',
              description: 'First published definition',
            },
          }),
          'Create publication concept'
        );

        for (const description of [
          'First published definition',
          'Second published definition',
        ]) {
          await openPublication(author, ontology);
          await author
            .getByTestId('ontology-release-notes')
            .getByRole('textbox')
            .fill(description);
          const capture = author.waitForResponse(
            (response) =>
              response
                .url()
                .endsWith(`/api/v1/ontologies/${ontology.id}/releases`) &&
              response.request().method() === 'POST'
          );
          await author
            .getByRole('button', { name: 'Save as release draft', exact: true })
            .click();
          const release = await okJson<OntologyRelease>(
            await capture,
            'Capture release in Studio'
          );
          expect(release.baseReleaseId).toBe(releases.at(-1)?.id);
          expect(release.semanticVersion).toBe(
            releases.length === 0 ? '0.1.0' : '0.1.1'
          );
          expect(release.releaseNotes).toBe(description);
          releases.push(release);
          expect(release.entityStatus).toBe('Draft');
          await expect(
            author.getByRole('button', {
              name: 'Activate release',
              exact: true,
            })
          ).toBeDisabled();
          await expect(
            author
              .getByTestId('ontology-release-definition')
              .getByRole('alert')
              .filter({ hasText: 'Logical consistency has not been checked' })
          ).toHaveCount(0);

          const submission = author.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/v1/tasks' &&
              response.request().method() === 'POST'
          );
          await clickIgnoringToasts(
            author.getByTestId('ontology-request-review')
          );
          const task = await okJson<Task>(
            await submission,
            'Submit captured release for workflow approval'
          );
          tasks.push(task.id);
          await expect(
            author.getByTestId('ontology-publication-notice-requested')
          ).toContainText(`${release.semanticVersion} sent to`);
          await expect(author).toHaveURL(/\/governance\/ontology/);
          await expect
            .poll(async () => {
              const pending = await okJson<Task>(
                await api.get(`/api/v1/tasks/${task.id}`),
                'Read workflow task'
              );
              return pending.availableTransitions?.length;
            })
            .toBe(2);

          await okJson<OntologyConcept>(
            await api.patch(`/api/v1/ontologyConcepts/${concept.id}`, {
              headers: { 'Content-Type': 'application/json-patch+json' },
              data: [
                {
                  op: 'replace',
                  path: '/description',
                  value: 'Second published definition',
                },
              ],
            }),
            'Edit draft independently of review'
          );
          await reviewer.goto(`/tasks/${task.id}`);
          await reviewer
            .getByTestId('ontology-review-panel')
            .getByRole('button', { name: 'Customer', exact: true })
            .click();
          await expect(
            reviewer
              .getByTestId('ontology-review-field-changes')
              .filter({ hasText: description })
          ).toContainText(description);
          await approveReview(reviewer, task);
          const beforeActivation = await okJson<OntologyState>(
            await api.get(`/api/v1/ontologies/${ontology.id}/state`),
            'Read approved publication state'
          );
          expect(beforeActivation.activationRevision).toBe(releases.length - 1);

          await openPublication(author, ontology, false);
          await expect(
            author.getByTestId('ontology-release-stage')
          ).toContainText('Approved');
          await expect(
            author.getByTestId('ontology-publish-release')
          ).toContainText(release.semanticVersion ?? '');
          await author.getByTestId('ontology-publication-tab-releases').click();
          await author
            .getByTestId(`ontology-release-select-${release.id}`)
            .click();
          await activateRelease(
            author,
            ontology,
            release,
            releases.length - 1,
            'publish',
            testInfo
          );
        }

        const [firstRelease] = releases;
        await author.reload();
        await author.getByTestId('ontology-release-history-trigger').click();
        await expect(
          author.getByTestId('ontology-publication-tab-releases')
        ).toHaveAttribute('aria-selected', 'true');
        await author
          .getByTestId(
            `ontology-release-select-${releases[releases.length - 1].id}`
          )
          .click();
        await expect(author.getByTestId('ontology-active-release')).toHaveText(
          'Active'
        );
        await author
          .getByTestId(`ontology-release-select-${firstRelease.id}`)
          .click();
        await activateRelease(
          author,
          ontology,
          firstRelease,
          2,
          'rollback',
          testInfo,
          releases[releases.length - 1].semanticVersion
        );
        await author.getByTestId('ontology-publication-tab-changes').click();
        await expect(
          author.getByTestId('ontology-publish-release')
        ).toContainText(`v${releases[releases.length - 1].semanticVersion}`);
        await expect(
          author.getByTestId('ontology-publish-release')
        ).not.toContainText(`v${firstRelease.semanticVersion}`);
        await author.getByTestId('ontology-publication-tab-releases').click();
        await author
          .getByTestId(`ontology-release-select-${firstRelease.id}`)
          .click();
        await expect(author.getByTestId('ontology-active-release')).toHaveText(
          'Active'
        );
        await expect(
          author.getByTestId('ontology-rollback-release')
        ).toHaveCount(0);
        await expect(
          author.getByRole('button', { name: 'Activate release' })
        ).toHaveCount(0);
        await author
          .getByTestId('ontology-release-definition')
          .getByRole('button', { name: 'Customer', exact: true })
          .click();
        await expect(
          author.getByTestId('ontology-review-field-changes')
        ).toContainText('First published definition');
        await author.screenshot({
          path: testInfo.outputPath('studio-release-rollback.png'),
          fullPage: true,
        });
        await reviewer.goto(`/governance/ontology?ontology=${ontology.id}`);
        await reviewer.getByTestId('mode-tab-query').click();
        await fillCodeEditor(
          reviewer,
          reviewer.getByTestId('ontology-sparql-editor'),
          `SELECT ?description WHERE { <${concept.iri}> <http://www.w3.org/2000/01/rdf-schema#comment> ?description }`
        );
        const queried = reviewer.waitForResponse(
          (response) =>
            new URL(response.url()).pathname ===
              `/api/v1/ontologies/${ontology.id}/sparql` &&
            response.request().method() === 'POST'
        );
        await reviewer.getByTestId('ontology-sparql-run').click();
        expect((await queried).ok()).toBeTruthy();
        await expect(
          reviewer.getByTestId('ontology-sparql-result')
        ).toContainText('First published definition');
        await expect(
          reviewer.getByTestId('ontology-sparql-result')
        ).not.toContainText('Second published definition');
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologyConcepts/${concept.id}`
        );
        await author.getByTestId('ontology-publication-tab-changes').click();
        await expect(
          author.getByTestId('ontology-release-definition')
        ).toBeVisible();
        await expect(
          author.getByTestId('ontology-publication-text')
        ).toBeVisible();
        await author.keyboard.press('Escape');
        await expect(
          author.getByTestId('ontology-publication-modal')
        ).not.toBeVisible();
        for (const [card, extension] of [
          ['rdfxml', 'rdf'],
          ['jsonld', 'jsonld'],
          ['skos', 'ttl'],
          ['csv', 'csv'],
        ]) {
          const exportPath = `/api/v1/ontologyReleases/${firstRelease.id}/export`;
          const previewed = author.waitForResponse((response) => {
            const url = new URL(response.url());

            return (
              url.pathname === exportPath &&
              url.searchParams.get('format') === card
            );
          });
          await author.getByTestId('ontology-import-export-trigger').click();
          const formatButton = author.getByTestId(
            `ontology-release-format-${card}`
          );
          await expect(formatButton).toBeVisible();
          if (card !== 'rdfxml') {
            await formatButton.click();
          }
          const preview = await previewed;
          expect(preview.ok()).toBeTruthy();
          expect(await preview.text()).toContain('First published definition');
          await expect(
            author.getByTestId('ontology-release-export-preview')
          ).not.toBeEmpty();
          if (card === 'rdfxml') {
            await testInfo.attach('native-release-export', {
              body: await author
                .getByRole('dialog')
                .screenshot({ animations: 'disabled' }),
              contentType: 'image/png',
            });
          }
          const fetched = author.waitForResponse((response) => {
            const url = new URL(response.url());

            return (
              url.pathname === exportPath &&
              url.searchParams.get('format') === card &&
              url.searchParams.get('shaclGate') === 'false'
            );
          });
          const downloaded = author.waitForEvent('download');
          await clickIgnoringToasts(
            author.getByTestId('ontology-run-release-export')
          );
          const download = await downloaded;
          expect(download.suggestedFilename()).toBe(
            `${name}-release-${firstRelease.releaseRevision}.${extension}`
          );
          const path = testInfo.outputPath(download.suggestedFilename());
          await download.saveAs(path);
          const content = await readFile(path, 'utf8');
          expect(content).toBe(await (await fetched).text());
          expect(content).toContain(concept.iri);
          expect(content).toContain('First published definition');
          expect(content).not.toContain('Second published definition');
        }
        expect(pageErrors).toEqual([]);
      } finally {
        await cleanReviews(api, tasks);
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true`
        );
      }
    });

    test('reuses the unchanged Draft and sends the captured version to the reviewer', async ({
      isolatedUserPage: author,
      freshUserPage: { user },
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      const name = `pw_draft_reuse_${uuid()}`;
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: {
            name,
            iri: `https://example.org/${name}`,
            namespace: `https://example.org/${name}/`,
            reviewers: [{ id: user.responseData.id, type: 'user' }],
          },
        }),
        'Create draft reuse fixture'
      );
      const tasks: string[] = [];
      try {
        await okJson<OntologyConcept>(
          await api.post('/api/v1/ontologyConcepts', {
            data: {
              name: 'Customer',
              ontology: ontology.fullyQualifiedName,
              conceptType: 'OWL_CLASS',
            },
          }),
          'Create draft reuse concept'
        );
        await openPublication(author, ontology);

        const captures: OntologyRelease[] = [];
        for (let attempt = 0; attempt < 2; attempt++) {
          await author
            .getByTestId('ontology-release-notes')
            .getByRole('textbox')
            .fill(
              attempt === 0 ? 'Original notes' : 'Edited notes, not stored'
            );
          const capture = author.waitForResponse(
            (response) =>
              response
                .url()
                .endsWith(`/api/v1/ontologies/${ontology.id}/releases`) &&
              response.request().method() === 'POST'
          );
          await author
            .getByRole('button', { name: 'Save as release draft', exact: true })
            .click();
          captures.push(
            await okJson<OntologyRelease>(
              await capture,
              'Capture unchanged working revision'
            )
          );
          await expect(
            author.getByRole('button', {
              name: 'Save as release draft',
              exact: true,
            })
          ).toBeEnabled();
        }

        await expect(
          author.getByTestId('ontology-publication-notice-unchanged')
        ).toContainText('Nothing changed since v0.1.0 was saved');
        await expect(
          author.getByTestId('ontology-publication-unchanged-notes')
        ).toHaveText('Its release notes: Original notes');
        await g6Shot(author, testInfo, 'draft-reuse');
        expect(captures[0].releaseNotes).toBe('Original notes');
        expect(captures[0].semanticVersion).toBe('0.1.0');
        expect(captures[1].id).toBe(captures[0].id);
        const history = await okJson<{ data: OntologyRelease[] }>(
          await api.get(`/api/v1/ontologies/${ontology.id}/releases`),
          'List releases after repeated capture'
        );
        expect(history.data.map((release) => release.id)).toEqual([
          captures[0].id,
        ]);

        await author.getByTestId('ontology-publication-tab-releases').click();
        await expect(
          author.getByTestId('ontology-release-history').getByRole('listitem')
        ).toHaveCount(1);
        await expect(
          author.getByTestId(`ontology-release-select-${captures[0].id}`)
        ).toHaveText('0.1.0');

        await author.getByTestId('ontology-publication-tab-changes').click();
        const submission = author.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/api/v1/tasks' &&
            response.request().method() === 'POST'
        );
        await clickIgnoringToasts(
          author.getByTestId('ontology-request-review')
        );
        const task = await okJson<Task>(
          await submission,
          'Request review of the reused Draft'
        );
        tasks.push(task.id);
        expect(task.about?.id).toBe(captures[0].id);
        const reviewed = await okJson<OntologyRelease>(
          await api.get(`/api/v1/ontologyReleases/${captures[0].id}`),
          'Read the release under review'
        );
        expect(reviewed.semanticVersion).toBe('0.1.0');
        expect(reviewed.reviewTask).toBe(task.id);
      } finally {
        await cleanReviews(api, tasks);
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true`
        );
      }
    });

    test('refuses a second open review for another Draft of the same ontology', async ({
      freshUserPage: { user },
    }) => {
      const api = await getWorkerAdminAPIContext();
      const name = `pw_one_review_${uuid()}`;
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: {
            name,
            iri: `https://example.org/${name}`,
            namespace: `https://example.org/${name}/`,
            reviewers: [{ id: user.responseData.id, type: 'user' }],
          },
        }),
        'Create single review fixture'
      );
      const tasks: string[] = [];
      try {
        const concept = await okJson<OntologyConcept>(
          await api.post('/api/v1/ontologyConcepts', {
            data: {
              name: 'Customer',
              ontology: ontology.fullyQualifiedName,
              conceptType: 'OWL_CLASS',
            },
          }),
          'Create single review concept'
        );
        const capture = async () => {
          const state = await okJson<OntologyState>(
            await api.get(`/api/v1/ontologies/${ontology.id}/state`),
            'Read working revision'
          );

          return okJson<OntologyRelease>(
            await api.post(`/api/v1/ontologies/${ontology.id}/releases`, {
              data: { expectedWorkingRevision: state.workingRevision },
            }),
            'Capture Draft'
          );
        };
        const first = await capture();
        await okJson<OntologyConcept>(
          await api.patch(`/api/v1/ontologyConcepts/${concept.id}`, {
            headers: { 'Content-Type': 'application/json-patch+json' },
            data: [{ op: 'replace', path: '/description', value: 'Edited' }],
          }),
          'Edit between captures'
        );
        const second = await capture();
        expect(second.id).not.toBe(first.id);

        const open = await submitReview(
          api,
          'ontologyRelease',
          first.fullyQualifiedName,
          tasks
        );
        const refused = await api.post('/api/v1/tasks', {
          data: {
            name: `Review ${second.fullyQualifiedName}`,
            category: 'Approval',
            type: 'RequestApproval',
            about: `<#E::ontologyRelease::${second.fullyQualifiedName}>`,
          },
        });

        expect(refused.status()).toBe(409);
        expect(await refused.text()).toContain(
          `${first.name} already has an open review`
        );

        await okJson<Task>(
          await api.post(`/api/v1/tasks/${open.id}/close`, { data: {} }),
          'Close the open review'
        );
        tasks.splice(tasks.indexOf(open.id), 1);
        await deleteFixtureEntity(
          api,
          `/api/v1/tasks/${open.id}?hardDelete=true`
        );
        const next = await submitReview(
          api,
          'ontologyRelease',
          second.fullyQualifiedName,
          tasks
        );
        expect(next.id).not.toBe(open.id);
      } finally {
        await cleanReviews(api, tasks);
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true`
        );
      }
    });
  }
);

test(
  'reviews a native memory draft through its Context Center link and captures the applied definition',
  { tag: ['@Features', '@Governance'] },
  async ({ isolatedUserPage: page }) => {
    const api = await getWorkerAdminAPIContext();
    const name = `pw_native_memory_${uuid()}`;
    const ontology = await okJson<Ontology>(
      await api.post('/api/v1/ontologies', {
        data: {
          name,
          iri: `urn:${name}`,
          namespace: `urn:${name}:`,
        },
      }),
      'Create native memory ontology'
    );
    let memory: ContextMemory | undefined;
    let draft: OntologyChangeSet | undefined;
    try {
      memory = await okJson<ContextMemory>(
        await api.post(MEMORIES_API, {
          data: {
            name: `${name}_source`,
            question: 'Who is a customer?',
            answer: 'A customer buys products.',
            entityStatus: 'Approved',
          },
        }),
        'Create source memory'
      );
      const state = await okJson<OntologyState>(
        await api.get(`/api/v1/ontologies/${ontology.id}/state`),
        'Read working revision'
      );
      const conceptId = fullUuid();
      const iri = `urn:${name}:Customer`;
      draft = await okJson<OntologyChangeSet>(
        await api.post('/api/v1/ontologyChangeSets', {
          data: {
            name: `${name}_draft`,
            displayName: 'Native memory proposal',
            description: 'A customer definition proposed from memory',
            ontology: ontology.fullyQualifiedName,
            baseWorkingRevision: state.workingRevision,
            operations: [
              {
                id: fullUuid(),
                operationType: 'UPSERT_CONCEPT',
                state: 'ACTIVE',
                sourceMemoryIds: [memory.id],
                concept: {
                  id: conceptId,
                  name: 'Customer',
                  fullyQualifiedName: `${ontology.fullyQualifiedName}.Customer`,
                  ontology: { id: ontology.id, type: 'ontology' },
                  iri,
                  conceptType: 'OWL_CLASS',
                  description: 'A customer buys products.',
                },
              },
            ],
          },
        }),
        'Create native memory draft'
      );
      await page.goto(`/governance/ontology?draft=${draft.id}`);
      await expect(
        page.getByTestId('ontology-memory-definition')
      ).toContainText(iri);
      const submitted = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/v1/ontologyChangeSets/${draft?.id}/submit` &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('ontology-memory-submit').click();
      expect(
        (
          await okJson<OntologyChangeSet>(
            await submitted,
            'Submit native memory draft'
          )
        ).state
      ).toBe('SUBMITTED');
      const applied = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/v1/ontologyChangeSets/${draft?.id}/apply` &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('ontology-memory-apply').click();
      expect(
        (
          await okJson<OntologyChangeSet>(
            await applied,
            'Apply native memory draft'
          )
        ).state
      ).toBe('APPLIED');
      await expect(
        page.getByTestId(`ontology-memory-draft-${draft.id}`)
      ).toBeHidden();
      await selectOntology(page, ontology);
      await page.getByTestId('fit-view').click();
      const positions = await readNodePositions(page);
      await page.mouse.click(positions[conceptId].x, positions[conceptId].y);
      await expect(
        page.getByTestId('ontology-concept-inspector')
      ).toContainText('A customer buys products.');
      await page.getByTestId('ontology-publication-trigger').click();
      const captured = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/v1/ontologies/${ontology.id}/releases` &&
          response.request().method() === 'POST'
      );
      await page
        .getByRole('button', { name: 'Save as release draft', exact: true })
        .click();
      expect(
        (
          await okJson<OntologyRelease>(
            await captured,
            'Capture memory-derived working model'
          )
        ).memberCount
      ).toBe(2);
    } finally {
      if (draft)
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologyChangeSets/${draft.id}?hardDelete=true`
        );
      if (memory)
        await deleteFixtureEntity(
          api,
          `${MEMORIES_API}/${memory.id}?hardDelete=true`
        );
      const archived = await deleteFixtureEntity(
        api,
        `/api/v1/ontologies/${ontology.id}?recursive=true`
      );
      expect(archived.ok()).toBeTruthy();
    }
  }
);

const createPublicationFixture = async (
  api: APIRequestContext,
  prefix: string,
  reviewerIds: string[]
) => {
  const name = `${prefix}_${uuid()}`;
  const ontology = await okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: {
        name,
        iri: `https://example.org/${name}`,
        namespace: `https://example.org/${name}/`,
        reviewers: reviewerIds.map((id) => ({ id, type: 'user' })),
      },
    }),
    'Create publish dialog ontology'
  );
  const concept = await okJson<OntologyConcept>(
    await api.post('/api/v1/ontologyConcepts', {
      data: {
        name: 'Customer',
        ontology: ontology.fullyQualifiedName,
        conceptType: 'OWL_CLASS',
        description: 'First definition',
      },
    }),
    'Create publish dialog concept'
  );

  return { ontology, concept };
};

const editConcept = async (
  api: APIRequestContext,
  concept: OntologyConcept,
  description: string
) =>
  okJson<OntologyConcept>(
    await api.patch(`/api/v1/ontologyConcepts/${concept.id}`, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      data: [{ op: 'replace', path: '/description', value: description }],
    }),
    'Edit concept'
  );

const setMode = async (
  api: APIRequestContext,
  userId: string,
  mode: 'ai' | 'classic'
) =>
  okJson(
    await api.put(`/api/v1/users/${userId}/preferences/appMode`, {
      data: { type: 'appMode', config: { value: mode } },
    }),
    'Set app mode'
  );

const openDialog = async (page: Page, ontology: Ontology) => {
  await page.goto(`/governance/ontology?ontology=${ontology.id}`);
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
  await page.getByTestId('ontology-publication-trigger').click();
  await expect(page.getByTestId('ontology-publication-modal')).toBeVisible();
  await expect(page.getByTestId('ontology-publication-text')).toBeVisible();
};

const removeFixture = async (
  api: APIRequestContext,
  ontology: Ontology,
  tasks: string[] = []
) => {
  await cleanReviews(api, tasks);
  await deleteFixtureEntity(
    api,
    `/api/v1/ontologies/${ontology.id}?recursive=true`
  );
};

test.describe(
  'Publish dialog states',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const mode of ['ai', 'classic'] as const) {
      test(`with no reviewers the footer offers Publish and Save as release draft in ${mode} mode`, async ({
        isolatedUserPage: author,
        isolatedUser,
      }, testInfo) => {
        const api = await getWorkerAdminAPIContext();
        await setMode(api, isolatedUser.responseData.id, mode);
        const { ontology } = await createPublicationFixture(
          api,
          'pw_g6_noreviewers',
          []
        );
        try {
          await openDialog(author, ontology);

          await expect(
            author.getByTestId('ontology-publish-release')
          ).toHaveText('Publish v0.1.0');
          await expect(
            author.getByTestId('ontology-publish-release')
          ).toBeEnabled();
          await expect(
            author.getByTestId('ontology-capture-release')
          ).toHaveText('Save as release draft');
          await expect(
            author.getByTestId('ontology-capture-release')
          ).toBeEnabled();
          await expect(
            author.getByTestId('ontology-request-review')
          ).toHaveCount(0);
          await expect(
            author.getByTestId('ontology-publication-text')
          ).toHaveText(
            'No reviewers set. Publishing makes this version live for everyone.'
          );
          await g6Shot(
            author,
            testInfo,
            mode === 'ai' ? 'no-reviewers' : 'classic'
          );
        } finally {
          await removeFixture(api, ontology);
        }
      });
    }

    test('publishes in one click with no reviewers and the version chip and URL follow without a reload', async ({
      isolatedUserPage: author,
      isolatedUser,
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      await setMode(api, isolatedUser.responseData.id, 'ai');
      const { ontology } = await createPublicationFixture(
        api,
        'pw_g6_direct',
        []
      );
      try {
        await author.goto(`/governance/ontology?ontology=${ontology.id}`);
        await expect(author.getByTestId('ontology-studio-shell')).toBeVisible();
        let loads = 0;
        author.on('load', () => {
          loads += 1;
        });
        await author.getByTestId('ontology-publication-trigger').click();
        await expect(
          author.getByTestId('ontology-publish-release')
        ).toBeEnabled();
        const activation = author.waitForResponse(
          (response) =>
            response
              .url()
              .endsWith(`/api/v1/ontologies/${ontology.id}/activation`) &&
            response.request().method() === 'PUT'
        );
        await clickIgnoringToasts(
          author.getByTestId('ontology-publish-release')
        );
        const state = await okJson<OntologyState>(
          await activation,
          'Publish with no reviewers'
        );

        await expect(
          author.getByTestId('ontology-publication-notice-published')
        ).toContainText(
          `v0.1.0 published. Everyone using ${ontology.name} now sees this version.`
        );
        const release = await okJson<OntologyRelease>(
          await api.get(`/api/v1/ontologyReleases/${state.activeReleaseId}`),
          'Read the published release'
        );
        expect(release.semanticVersion).toBe('0.1.0');
        expect(release.approvalBasis).toBe('NO_REVIEWERS_CONFIGURED');
        await author.getByRole('heading', { name: 'Review & publish' }).click();
        await author.keyboard.press('Escape');
        await expect(
          author.getByTestId('ontology-publication-modal')
        ).toHaveCount(0);
        await expect(
          author.getByTestId('ontology-release-history-trigger')
        ).toContainText('v0.1.0');
        await author.getByTestId('ontology-version-published').click();
        await expect(author).toHaveURL(/version=published/);
        await expect(
          author.getByTestId('ontology-version-published')
        ).toHaveAttribute('aria-pressed', 'true');
        await expect(
          author.getByTestId('ontology-release-history-trigger')
        ).toContainText('v0.1.0');
        expect(loads).toBe(0);
        await g6Shot(author, testInfo, 'published');
      } finally {
        await removeFixture(api, ontology);
      }
    });

    test('lists the first validation errors and disables Publish when the release is invalid', async ({
      isolatedUserPage: author,
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      const { ontology } = await createPublicationFixture(
        api,
        'pw_g6_invalid',
        []
      );
      try {
        await author.route(
          '**/api/v1/ontologyReleases/*/validation*',
          async (route) => {
            const real = await route.fetch();
            const report = await real.json();
            await route.fulfill({
              response: real,
              json: {
                ...report,
                structure: {
                  ...report.structure,
                  valid: false,
                  violationCount: 2,
                  violations: [
                    {
                      violation: {
                        message: 'Customer has no label',
                        path: '/a',
                      },
                    },
                    {
                      violation: {
                        message: 'Order loops on itself',
                        path: '/b',
                      },
                    },
                  ],
                },
              },
            });
          }
        );
        await openDialog(author, ontology);
        await author.getByTestId('ontology-capture-release').click();

        await expect(
          author.getByTestId('ontology-publish-release')
        ).toBeDisabled();
        await expect(
          author
            .getByTestId('ontology-publication-errors')
            .getByRole('listitem')
        ).toHaveText(['Customer has no label', 'Order loops on itself']);
        await expect(
          author.getByTestId('ontology-publication-text')
        ).toContainText('Fix these to publish.');
        await g6Shot(author, testInfo, 'invalid');
      } finally {
        await removeFixture(api, ontology);
      }
    });

    test('adding and removing a reviewer flips the primary action with no reload, and a sole self-reviewer cannot request', async ({
      isolatedUserPage: author,
      isolatedUser,
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      const reviewer = new UserClass();
      await reviewer.create(api);
      const reviewerName =
        reviewer.responseData.displayName ?? reviewer.responseData.name;
      const { ontology } = await createPublicationFixture(
        api,
        'pw_g6_flip',
        []
      );
      try {
        await waitForSearchIndexed(
          api,
          reviewer.responseData.name,
          SearchIndex.USER,
          { matchBy: 'nameOrDisplayName' }
        );
        await openDialog(author, ontology);
        await expect(
          author.getByTestId('ontology-publish-release')
        ).toBeVisible();
        let loads = 0;
        author.on('load', () => {
          loads += 1;
        });

        const card = author.getByTestId('ontology-release-reviewers');
        const picker = card.getByRole('combobox', { name: 'Add reviewer' });
        await picker.fill(reviewer.responseData.name);
        const added = author.waitForResponse(
          (response) =>
            new URL(response.url()).pathname ===
              `/api/v1/ontologies/${ontology.id}` &&
            response.request().method() === 'PATCH'
        );
        await author.getByRole('option', { name: reviewerName }).click();
        expect((await added).status()).toBe(200);

        await expect(
          author.getByTestId('ontology-request-review')
        ).toBeEnabled();
        await expect(
          author.getByTestId('ontology-publish-release')
        ).toHaveCount(0);
        await expect(
          author.getByTestId('ontology-publication-text')
        ).toHaveText('The draft stays editable while the review is open.');
        await g6Shot(author, testInfo, 'flip');

        const removed = author.waitForResponse(
          (response) =>
            new URL(response.url()).pathname ===
              `/api/v1/ontologies/${ontology.id}` &&
            response.request().method() === 'PATCH'
        );
        await card
          .getByRole('row', { name: new RegExp(reviewerName) })
          .press('Delete');
        expect((await removed).status()).toBe(200);

        await expect(author.getByTestId('ontology-publish-release')).toHaveText(
          'Publish v0.1.0'
        );
        await expect(author.getByTestId('ontology-request-review')).toHaveCount(
          0
        );
        await expect(
          author.getByTestId('ontology-publication-text')
        ).toHaveText(
          'No reviewers set. Publishing makes this version live for everyone.'
        );
        expect(loads).toBe(0);

        await okJson<Ontology>(
          await api.patch(`/api/v1/ontologies/${ontology.id}`, {
            headers: { 'Content-Type': 'application/json-patch+json' },
            data: [
              {
                op: 'add',
                path: '/reviewers',
                value: [{ id: isolatedUser.responseData.id, type: 'user' }],
              },
            ],
          }),
          'Make the author the only reviewer'
        );
        await openDialog(author, ontology);

        await expect(
          author.getByTestId('ontology-request-review')
        ).toBeDisabled();
        await expect(
          author.getByTestId('ontology-publication-text')
        ).toHaveText(
          'You are the only reviewer. Add another reviewer, or remove yourself to publish without review.'
        );
        await g6Shot(author, testInfo, 'solo');
      } finally {
        await removeFixture(api, ontology);
        await reviewer.delete(api);
      }
    });

    test('Request review keeps the author in Studio, and the author can withdraw the request', async ({
      isolatedUserPage: author,
      freshUserPage: { user: reviewer },
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      const reviewerName =
        reviewer.responseData.displayName ?? reviewer.responseData.name;
      const { ontology } = await createPublicationFixture(
        api,
        'pw_g6_withdraw',
        [reviewer.responseData.id]
      );
      const tasks: string[] = [];
      try {
        await openDialog(author, ontology);
        const submission = author.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/api/v1/tasks' &&
            response.request().method() === 'POST'
        );
        await clickIgnoringToasts(
          author.getByTestId('ontology-request-review')
        );
        const task = await okJson<Task>(await submission, 'Request review');
        tasks.push(task.id);

        await expect(
          author.getByTestId('ontology-publication-notice-requested')
        ).toContainText(`v0.1.0 sent to ${reviewerName} for review`);
        await expect(author.getByTestId('ontology-view-request')).toBeVisible();
        await expect(author).toHaveURL(/\/governance\/ontology/);
        await expect(
          author.getByTestId('ontology-publication-text')
        ).not.toContainText('OntologyAuthor');
        await expect(
          author.getByTestId('ontology-publish-release')
        ).toBeDisabled();
        await g6Shot(author, testInfo, 'stay');

        const closed = author.waitForResponse(
          (response) =>
            response.url().endsWith(`/api/v1/tasks/${task.id}/close`) &&
            response.request().method() === 'POST'
        );
        await author.getByTestId('ontology-withdraw-request').click();
        expect((await closed).status()).toBe(200);

        await expect(
          author.getByTestId('ontology-publication-notice-withdrawn')
        ).toContainText(
          'Review request for v0.1.0 withdrawn. The release is a draft again.'
        );
        await expect(
          author.getByTestId('ontology-request-review')
        ).toBeEnabled();
        await g6Shot(author, testInfo, 'withdraw');
        const release = await okJson<OntologyRelease>(
          await api
            .get(`/api/v1/ontologies/${ontology.id}/releases`)
            .then(async (response) => {
              const list = await okJson<{ data: OntologyRelease[] }>(
                response,
                'List releases'
              );

              return api.get(`/api/v1/ontologyReleases/${list.data[0].id}`);
            }),
          'Read the withdrawn release'
        );
        expect(release.entityStatus).toBe('Draft');
        const withdrawn = await okJson<Task>(
          await api.get(`/api/v1/tasks/${task.id}`),
          'Read the withdrawn task'
        );
        expect(withdrawn.status).not.toBe('Open');
      } finally {
        await removeFixture(api, ontology, tasks);
      }
    });

    test('a rejection and an approval reach the author in the dialog and the banner', async ({
      isolatedUserPage: author,
      isolatedUser,
      freshUserPage: { page: reviewerPage, user: reviewer },
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      await setMode(api, isolatedUser.responseData.id, 'ai');
      const reviewerName =
        reviewer.responseData.displayName ?? reviewer.responseData.name;
      const reason = 'Add a label to Customer.';
      const { ontology, concept } = await createPublicationFixture(
        api,
        'pw_g6_decisions',
        [reviewer.responseData.id]
      );
      const tasks: string[] = [];
      const requestReview = async () => {
        await openDialog(author, ontology);
        const submission = author.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/api/v1/tasks' &&
            response.request().method() === 'POST'
        );
        await clickIgnoringToasts(
          author.getByTestId('ontology-request-review')
        );
        const task = await okJson<Task>(await submission, 'Request review');
        tasks.push(task.id);
        await expect
          .poll(async () => {
            const ready = await okJson<Task>(
              await api.get(`/api/v1/tasks/${task.id}`),
              'Read request'
            );

            return ready.availableTransitions?.length;
          })
          .toBe(2);

        return task;
      };
      try {
        const rejected = await requestReview();
        await reviewerPage.goto(`/tasks/${rejected.id}`);
        await reviewerPage.getByTestId('task-reject').click();
        await reviewerPage
          .getByTestId('task-action-comment')
          .getByRole('textbox')
          .fill(reason);
        await reviewerPage.getByTestId('task-action-comment-confirm').click();
        await expect(reviewerPage.getByTestId('task-status-badge')).toHaveText(
          'Rejected'
        );

        await openDialog(author, ontology);
        await expect(
          author.getByTestId('ontology-rejection-reason')
        ).toHaveText(reason);
        await expect(
          author.getByTestId('ontology-publication-text')
        ).toContainText('Edit the ontology, then request review again.');
        await expect(
          author.getByTestId('ontology-request-review')
        ).toBeDisabled();
        await g6Shot(author, testInfo, 'rejected');

        await editConcept(api, concept, 'Second definition');
        await openDialog(author, ontology);
        await expect(
          author.getByTestId('ontology-request-review')
        ).toBeEnabled();

        const approved = await requestReview();
        await approveReview(
          await (async () => {
            await reviewerPage.goto(`/tasks/${approved.id}`);

            return reviewerPage;
          })(),
          approved
        );
        await reviewerPage.goto(
          `/governance/ontology?ontology=${ontology.id}&source=review&task=${approved.id}`
        );
        await expect(
          reviewerPage.getByTestId('ontology-only-author-publishes')
        ).toHaveText('Only an author or owner can publish.');
        await expect(
          reviewerPage.getByTestId('ontology-publication-trigger')
        ).toHaveCount(0);

        await author.goto(`/governance/ontology?ontology=${ontology.id}`);
        await expect(
          author.getByTestId('ontology-review-decision-banner')
        ).toContainText(`${reviewerName} approved`);
        await author.getByTestId('ontology-publication-trigger').click();
        await expect(
          author.getByTestId('ontology-publish-release')
        ).toBeEnabled();
        await expect(
          author.getByTestId('ontology-publish-release')
        ).toContainText('Publish v');
        await expect(
          author.getByTestId('ontology-capture-release')
        ).toHaveCount(0);
        await g6Shot(author, testInfo, 'approved');

        await openDialog(author, ontology);
        const activation = author.waitForResponse(
          (response) =>
            response
              .url()
              .endsWith(`/api/v1/ontologies/${ontology.id}/activation`) &&
            response.request().method() === 'PUT'
        );
        await clickIgnoringToasts(
          author.getByTestId('ontology-publish-release')
        );
        const state = await okJson<OntologyState>(
          await activation,
          'Publish the approved release'
        );
        const published = await okJson<OntologyRelease>(
          await api.get(`/api/v1/ontologyReleases/${state.activeReleaseId}`),
          'Read the published release'
        );
        expect(published.approvalBasis).toBe('REVIEWED');
        await expect(
          author.getByTestId('ontology-publication-notice-published')
        ).toBeVisible();
      } finally {
        await removeFixture(api, ontology, tasks);
      }
    });

    test('the author Inbox lists the reviewer rejection and approval', async ({
      isolatedUserPage: author,
      isolatedUser,
      freshUserPage: { page: reviewerPage, user: reviewer },
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      await setMode(api, isolatedUser.responseData.id, 'ai');
      const { ontology } = await createPublicationFixture(api, 'pw_g6_inbox', [
        reviewer.responseData.id,
      ]);
      const tasks: string[] = [];
      const state = await okJson<OntologyState>(
        await api.get(`/api/v1/ontologies/${ontology.id}/state`),
        'Read working revision'
      );
      try {
        const release = await okJson<OntologyRelease>(
          await api.post(`/api/v1/ontologies/${ontology.id}/releases`, {
            data: { expectedWorkingRevision: state.workingRevision },
          }),
          'Save a release draft'
        );
        const rejected = await submitReview(
          api,
          'ontologyRelease',
          release.fullyQualifiedName,
          tasks
        );
        await reviewerPage.goto(`/tasks/${rejected.id}`);
        await reviewerPage.getByTestId('task-reject').click();
        await reviewerPage
          .getByTestId('task-action-comment')
          .getByRole('textbox')
          .fill('Add a label to Customer.');
        await reviewerPage.getByTestId('task-action-comment-confirm').click();
        await expect(reviewerPage.getByTestId('task-status-badge')).toHaveText(
          'Rejected'
        );
        await expect(async () => {
          await author.goto('/inbox/activity');
          await expect
            .poll(
              () =>
                author
                  .getByText(/rejected release #1: Add a label to Customer\./)
                  .count(),
              { timeout: 10_000 }
            )
            .toBeGreaterThan(0);
        }).toPass({ timeout: 60_000 });
        await g6Shot(author, testInfo, 'inbox-rejected');

        await editConcept(
          api,
          await okJson<OntologyConcept>(
            await api.get(
              `/api/v1/ontologyConcepts/name/${encodeURIComponent(
                `${ontology.fullyQualifiedName}.Customer`
              )}`
            ),
            'Read concept'
          ),
          'Second definition'
        );
        const next = await okJson<OntologyRelease>(
          await api.post(`/api/v1/ontologies/${ontology.id}/releases`, {
            data: {
              expectedWorkingRevision: (
                await okJson<OntologyState>(
                  await api.get(`/api/v1/ontologies/${ontology.id}/state`),
                  'Read working revision'
                )
              ).workingRevision,
            },
          }),
          'Save the next release draft'
        );
        const approved = await submitReview(
          api,
          'ontologyRelease',
          next.fullyQualifiedName,
          tasks
        );
        await reviewerPage.goto(`/tasks/${approved.id}`);
        await approveReview(reviewerPage, approved);
        await expect(async () => {
          await author.goto('/inbox/activity');
          await expect
            .poll(() => author.getByText(/approved release #2/).count(), {
              timeout: 10_000,
            })
            .toBeGreaterThan(0);
        }).toPass({ timeout: 60_000 });
        await g6Shot(author, testInfo, 'inbox-approved');
      } finally {
        await removeFixture(api, ontology, tasks);
      }
    });

    for (const mode of ['ai', 'classic'] as const) {
      test(`Publish is disabled in All ontologies with the reason and opens no dialog in ${mode} mode`, async ({
        isolatedUserPage: page,
        isolatedUser,
      }) => {
        const api = await getWorkerAdminAPIContext();
        await setMode(api, isolatedUser.responseData.id, mode);
        const { ontology } = await createPublicationFixture(
          api,
          'pw_g6_all',
          []
        );
        try {
          await page.goto('/governance/ontology');
          await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
          const publish = page.getByTestId('ontology-publication-trigger');

          await expect(publish).toBeDisabled();
          const reason = page.getByTestId('ontology-publication-reason');

          await expect(reason).toBeVisible();
          await expect(reason).toHaveText('Choose an ontology to publish');
          await expect(publish).toHaveAccessibleDescription(
            'Choose an ontology to publish'
          );
          const box = await publish.boundingBox();
          await page.mouse.click((box?.x ?? 0) + 20, (box?.y ?? 0) + 10);
          await expect(
            page.getByTestId('ontology-publication-modal')
          ).toHaveCount(0);
        } finally {
          await removeFixture(api, ontology);
        }
      });
    }
  }
);

const g8Shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const path = testInfo.outputPath(`g8-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`g8-${name}`, { path, contentType: 'image/png' });
};

// Playwright drops the attachments of passing tests, so the review evidence is written straight to the folder the PR body reads.
const g8ReviewShot = async (page: Page, lane: 1 | 2, mode: string) => {
  const directory = process.env.G8_REVIEW_SHOT_DIR;
  if (directory) {
    await page.screenshot({
      path: `${directory}/G8-review-history-${lane}-${mode}.png`,
      fullPage: true,
    });
  }
};

type SealOptions = {
  notes?: string;
  publish?: boolean;
  bump?: 'major' | 'minor';
};

const sealRelease = async (
  api: APIRequestContext,
  ontologyId: string,
  { notes, publish = true, bump = 'minor' }: SealOptions = {}
) => {
  const state = await okJson<OntologyState>(
    await api.get(`/api/v1/ontologies/${ontologyId}/state`),
    'Read release fence'
  );
  const release = await okJson<OntologyRelease>(
    await api.post(`/api/v1/ontologies/${ontologyId}/releases`, {
      data: {
        expectedWorkingRevision: state.workingRevision,
        expectedLatestReleaseRevision: state.lastReleaseRevision,
        expectedActivationRevision: state.activationRevision,
        versionBump: bump,
        releaseNotes: notes,
      },
    }),
    'Seal release'
  );
  if (publish) {
    await okJson(
      await api.put(`/api/v1/ontologies/${ontologyId}/activation`, {
        data: {
          releaseId: release.id,
          expectedActivationRevision: state.activationRevision,
        },
      }),
      'Publish release directly'
    );
  }

  return okJson<OntologyRelease>(
    await api.get(`/api/v1/ontologyReleases/${release.id}`),
    'Read sealed release'
  );
};

const publishApproved = async (
  api: APIRequestContext,
  ontologyId: string,
  releaseId: string
) => {
  const state = await okJson<OntologyState>(
    await api.get(`/api/v1/ontologies/${ontologyId}/state`),
    'Read activation fence'
  );
  await okJson(
    await api.put(`/api/v1/ontologies/${ontologyId}/activation`, {
      data: {
        releaseId,
        expectedActivationRevision: state.activationRevision,
      },
    }),
    'Publish approved release'
  );
};

const addConcept = async (
  api: APIRequestContext,
  ontology: Ontology,
  name: string
) =>
  okJson<OntologyConcept>(
    await api.post('/api/v1/ontologyConcepts', {
      data: {
        name,
        ontology: ontology.fullyQualifiedName,
        conceptType: 'OWL_CLASS',
        description: `${name} definition`,
      },
    }),
    `Create ${name}`
  );

const resolveReview = async (
  adminApi: APIRequestContext,
  reviewerApi: APIRequestContext,
  release: OntologyRelease,
  resolutionType: 'Approved' | 'Rejected',
  tasks: string[],
  comment?: string
) => {
  const task = await submitReview(
    adminApi,
    'ontologyRelease',
    release.fullyQualifiedName,
    tasks
  );
  await okJson(
    await reviewerApi.post(`/api/v1/tasks/${task.id}/resolve`, {
      data: { resolutionType, comment },
    }),
    `Resolve review as ${resolutionType}`
  );
};

const openReleases = async (page: Page, ontology: Ontology) => {
  await page.goto(`/governance/ontology?ontology=${ontology.id}`);
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
  await page.getByTestId('ontology-release-history-trigger').click();
  await expect(page.getByTestId('ontology-release-history')).toBeVisible();
};

const chooseRelease = async (page: Page, picker: string, version: string) => {
  await page.getByRole('button', { name: picker, exact: true }).click();
  await page.getByText(`${version} (`).click();
};

const expectedBreakdown = (release: OntologyRelease) => {
  const summary = release.changeSummary;
  if (!summary) {
    throw new Error('Sealed release has no change summary');
  }

  return `${summary.added} added · ${
    summary.changed + (summary.deprecated ?? 0)
  } changed · ${summary.removed} removed`;
};

test.describe(
  'Release history and compare (G8)',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const mode of ['ai', 'classic'] as const) {
      test(`fills history rows and compares two releases in ${mode} mode`, async ({
        isolatedUserPage: page,
        isolatedUser,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        await setMode(api, isolatedUser.responseData.id, mode);
        const { ontology, concept } = await createPublicationFixture(
          api,
          'pw_g8_compare',
          []
        );
        try {
          const legacy = await addConcept(api, ontology, 'Legacy');
          const first = await sealRelease(api, ontology.id, {
            notes: 'first cut',
          });
          await editConcept(api, concept, 'Customer redefined');
          await addConcept(api, ontology, 'Invoice');
          await api.delete(
            `/api/v1/ontologyConcepts/${legacy.id}?hardDelete=true`
          );
          const second = await sealRelease(api, ontology.id, {
            notes: 'second pass',
          });
          expect(first.semanticVersion).toBe('0.1.0');
          expect(second.semanticVersion).toBe('0.2.0');

          await openReleases(page, ontology);

          await expect(page.getByTestId('ontology-release-row')).toHaveCount(2);
          for (const release of [first, second]) {
            await expect(
              page.getByTestId(`ontology-release-select-${release.id}`)
            ).toHaveText(release.semanticVersion ?? '');
            await expect(
              page.getByTestId(`ontology-release-decision-${release.id}`)
            ).toHaveText('Published without review');
            await expect(
              page.getByTestId(`ontology-release-count-${release.id}`)
            ).toHaveText(expectedBreakdown(release));
          }
          await expect(
            page.getByTestId(`ontology-release-kinds-${first.id}`)
          ).toHaveText('2 concepts');
          await expect(
            page.getByTestId(`ontology-release-kinds-${second.id}`)
          ).toHaveText('3 concepts');
          await g8Shot(page, testInfo, mode === 'ai' ? 'rows' : 'classic');
          await g8ReviewShot(page, 1, mode);

          await chooseRelease(page, 'From version', '0.1.0');
          await chooseRelease(page, 'To version', '0.2.0');
          const diff = await okJson<OntologyReleaseDiff>(
            await api.get(
              `/api/v1/ontologyReleases/${second.id}/diff?baseReleaseId=${first.id}&limit=500`
            ),
            'Read release diff'
          );
          const expected = (kinds: string[]) =>
            diff.data
              .filter(
                (change) =>
                  kinds.includes(change.changeType) &&
                  change.memberKind !== 'ONTOLOGY'
              )
              .map((change) => change.entity.name);
          expect(expected(['ADDED'])).toEqual(['Invoice']);
          expect(expected(['REMOVED'])).toEqual(['Legacy']);
          expect(expected(['CHANGED', 'DEPRECATED'])).toEqual(['Customer']);
          await expect(
            page.getByTestId('ontology-compare-added')
          ).toContainText('Invoice');
          await expect(
            page.getByTestId('ontology-compare-changed')
          ).toContainText('Customer');
          await expect(
            page.getByTestId('ontology-compare-removed')
          ).toContainText('Legacy');
          await expect(page.getByTestId('ontology-compare-counts')).toHaveText(
            '3 changes · 3 concepts'
          );
          await g8Shot(
            page,
            testInfo,
            mode === 'ai' ? 'compare' : 'classic-compare'
          );
          await g8ReviewShot(page, 2, mode);
        } finally {
          await removeFixture(api, ontology);
        }
      });
    }

    test('lists per-kind counts on a row and keeps the plain counts for a release captured before kinds existed', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const { ontology } = await createPublicationFixture(
        api,
        'pw_g8_kinds',
        []
      );
      try {
        await addConcept(api, ontology, 'Legacy');
        const older = await sealRelease(api, ontology.id, { notes: 'older' });
        await addConcept(api, ontology, 'Invoice');
        const newer = await sealRelease(api, ontology.id, { notes: 'newer' });
        await page.route(
          new RegExp(`/api/v1/ontologies/${ontology.id}/releases\\?`),
          async (route) => {
            const response = await route.fetch();
            const body = await response.json();
            for (const release of body.data) {
              if (release.id === older.id) {
                delete release.changeSummary.kindCounts;
              }
            }
            await route.fulfill({ response, json: body });
          }
        );

        await openReleases(page, ontology);

        await expect(
          page.getByTestId(`ontology-release-kinds-${newer.id}`)
        ).toHaveText('1 concept');
        await expect(
          page.getByTestId(`ontology-release-count-${older.id}`)
        ).toHaveText('3 added · 0 changed · 0 removed');
        await expect(
          page.getByTestId(`ontology-release-kinds-${older.id}`)
        ).toHaveCount(0);
      } finally {
        await removeFixture(api, ontology);
      }
    });

    test('says there are no differences when a release is compared with itself', async ({
      isolatedUserPage: page,
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      const { ontology } = await createPublicationFixture(
        api,
        'pw_g8_same',
        []
      );
      try {
        await sealRelease(api, ontology.id);
        await openReleases(page, ontology);

        await chooseRelease(page, 'From version', '0.1.0');
        await chooseRelease(page, 'To version', '0.1.0');

        await expect(page.getByTestId('ontology-compare-empty')).toHaveText(
          'No differences between 0.1.0 and 0.1.0.'
        );
        await g8Shot(page, testInfo, 'same');
      } finally {
        await removeFixture(api, ontology);
      }
    });

    test('reads Published without review on a directly published release row and detail', async ({
      isolatedUserPage: page,
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      const { ontology } = await createPublicationFixture(
        api,
        'pw_g8_direct',
        []
      );
      try {
        const release = await sealRelease(api, ontology.id, {
          notes: 'direct',
        });
        expect(release.approvalBasis).toBe('NO_REVIEWERS_CONFIGURED');
        await openReleases(page, ontology);

        await expect(
          page.getByTestId(`ontology-release-decision-${release.id}`)
        ).toHaveText('Published without review');
        await page.getByTestId(`ontology-release-select-${release.id}`).click();
        const detail = page.getByTestId('ontology-release-definition');
        await expect(
          detail.getByRole('heading', { name: 'v0.1.0' })
        ).toBeVisible();
        await expect(detail.getByTestId('ontology-release-direct')).toHaveText(
          'Published without review'
        );
        await expect(
          detail.getByTestId('ontology-release-event').filter({
            hasText: 'Published without review',
          })
        ).toHaveCount(1);
        await g8Shot(page, testInfo, 'direct');
      } finally {
        await removeFixture(api, ontology);
      }
    });

    test('shows reviewer, reason and filters for approved, rejected and draft releases', async ({
      isolatedUserPage: page,
      freshUserPage: { page: reviewerPage, user: reviewer },
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const { apiContext: reviewerApi, afterAction } = await getApiContext(
        reviewerPage
      );
      const { ontology, concept } = await createPublicationFixture(
        api,
        'pw_g8_decided',
        [reviewer.responseData.id]
      );
      const tasks: string[] = [];
      try {
        const approved = await sealRelease(api, ontology.id, {
          notes: 'billing launch',
          publish: false,
        });
        await resolveReview(api, reviewerApi, approved, 'Approved', tasks);
        await publishApproved(api, ontology.id, approved.id);
        await editConcept(api, concept, 'Second definition');
        const rejected = await sealRelease(api, ontology.id, {
          notes: 'risky rewrite',
          publish: false,
        });
        await resolveReview(
          api,
          reviewerApi,
          rejected,
          'Rejected',
          tasks,
          'Definitions overlap with Customer'
        );
        await editConcept(api, concept, 'Third definition');
        const draft = await sealRelease(api, ontology.id, {
          notes: 'work in progress',
          publish: false,
          bump: 'major',
        });

        await openReleases(page, ontology);
        const versions = () =>
          page
            .locator('[data-testid^="ontology-release-select-"]')
            .allTextContents();
        await expect.poll(versions).toEqual(['1.0.0', '0.2.0', '0.1.0']);
        await expect(
          page.getByTestId(`ontology-release-decision-${approved.id}`)
        ).toContainText(`Approved by ${reviewer.responseData.name}`);
        await expect(
          page.getByTestId(`ontology-release-decision-${rejected.id}`)
        ).toContainText(`Rejected by ${reviewer.responseData.name}`);

        await page
          .getByTestId(`ontology-release-select-${rejected.id}`)
          .click();
        const detail = page.getByTestId('ontology-release-definition');
        await expect(
          detail.getByTestId('ontology-release-event-reason')
        ).toHaveText('Reason: Definitions overlap with Customer');
        await expect(
          detail
            .getByTestId('ontology-release-event')
            .filter({ hasText: 'Rejected' })
        ).toContainText(reviewer.responseData.name);
        await g8Shot(page, testInfo, 'rejected');

        const search = page.getByTestId('ontology-release-search');
        await search.fill('0.2');
        await expect.poll(versions).toEqual(['0.2.0']);
        await search.fill('BILLING');
        await expect.poll(versions).toEqual(['0.1.0']);
        await g8Shot(page, testInfo, 'search');
        await search.fill('');

        const filters: [string, string[]][] = [
          ['published', ['0.1.0']],
          ['rejected', ['0.2.0']],
          ['draft', ['1.0.0']],
          ['all', ['1.0.0', '0.2.0', '0.1.0']],
        ];
        for (const [filter, expected] of filters) {
          await page.getByTestId(`ontology-release-filter-${filter}`).click();
          await expect.poll(versions).toEqual(expected);
        }
        expect(draft.semanticVersion).toBe('1.0.0');
        await page.getByTestId('ontology-release-filter-rejected').click();
        await g8Shot(page, testInfo, 'filter');
      } finally {
        await afterAction();
        await removeFixture(api, ontology, tasks);
      }
    });

    test('pages thirty releases and keeps the selection across pages', async ({
      isolatedUserPage: page,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const { ontology, concept } = await createPublicationFixture(
        api,
        'pw_g8_paging',
        []
      );
      try {
        const releases: OntologyRelease[] = [];
        for (let index = 0; index < 30; index += 1) {
          await editConcept(api, concept, `Definition ${index}`);
          releases.push(await sealRelease(api, ontology.id));
        }
        await openReleases(page, ontology);

        await expect(page.getByTestId('ontology-release-row')).toHaveCount(10);
        await expect(page.getByTestId('ontology-release-page')).toHaveText(
          'Page 1 / 3'
        );
        const newest = releases[29];
        await page.getByTestId(`ontology-release-select-${newest.id}`).click();
        const detail = page.getByTestId('ontology-release-definition');
        await expect(
          detail.getByRole('heading', { name: `v${newest.semanticVersion}` })
        ).toBeVisible();

        await page.getByTestId('ontology-release-next').click();
        await expect(page.getByTestId('ontology-release-page')).toHaveText(
          'Page 2 / 3'
        );
        await expect(
          page.getByTestId(`ontology-release-select-${newest.id}`)
        ).toHaveCount(0);
        await expect(
          detail.getByRole('heading', { name: `v${newest.semanticVersion}` })
        ).toBeVisible();
        await page.getByTestId('ontology-release-next').click();
        await page.getByTestId('ontology-release-load-more').click();
        await expect(page.getByTestId('ontology-release-row')).toHaveCount(10);
        await g8Shot(page, testInfo, 'paging');

        await page.getByTestId('ontology-release-previous').click();
        await page.getByTestId('ontology-release-previous').click();
        await expect(
          page.getByTestId(`ontology-release-select-${newest.id}`)
        ).toHaveAttribute('aria-expanded', 'true');
      } finally {
        await removeFixture(api, ontology);
      }
    });

    test('lets a viewer without edit rights read rows and compare with no write action', async ({
      isolatedUserPage: author,
      freshUserPage: { page: viewer },
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      const { ontology, concept } = await createPublicationFixture(
        api,
        'pw_g8_viewer',
        []
      );
      try {
        const first = await sealRelease(api, ontology.id);
        await editConcept(api, concept, 'Changed once');
        const second = await sealRelease(api, ontology.id);
        void author;

        await openReleases(viewer, ontology);

        await expect(
          viewer.getByTestId(`ontology-release-select-${second.id}`)
        ).toHaveText('0.2.0');
        await chooseRelease(viewer, 'From version', '0.1.0');
        await chooseRelease(viewer, 'To version', '0.2.0');
        await expect(
          viewer.getByTestId('ontology-compare-changed')
        ).toContainText('Customer');
        await viewer.getByTestId(`ontology-release-select-${first.id}`).click();
        await expect(
          viewer
            .getByTestId('ontology-release-definition')
            .getByRole('heading', { name: 'v0.1.0' })
        ).toBeVisible();
        await expect(
          viewer.getByTestId('ontology-rollback-release')
        ).toBeDisabled();
        for (const testId of [
          'ontology-publish-release',
          'ontology-capture-release',
          'ontology-request-review',
        ]) {
          await expect(viewer.getByTestId(testId)).toHaveCount(0);
        }
        await g8Shot(viewer, testInfo, 'viewer');
      } finally {
        await removeFixture(api, ontology);
      }
    });
  }
);
