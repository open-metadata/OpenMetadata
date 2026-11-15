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

import { APIRequestContext, Locator, Page } from '@playwright/test';
import { VersionBump } from '../../../src/generated/api/data/captureOntologyRelease';
import {
  Ontology,
  OntologyApprovalRule,
} from '../../../src/generated/entity/data/ontology';
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { Task, TaskStatus } from '../../../src/generated/entity/tasks/task';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { UserClass } from '../../support/user/UserClass';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getAuthContext,
  getToken,
  getWorkerAdminAPIContext,
  uuid,
} from '../../utils/common';

test.use({ isolatedUserOptions: { isAdmin: true } });

const createReview = async (
  api: APIRequestContext,
  reviewers: string[],
  rule: OntologyApprovalRule,
  ontologies: string[],
  tasks: string[]
) => {
  const name = 'pw_review_drawer_' + uuid();
  const ontology = await okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: {
        name,
        iri: 'urn:' + name,
        namespace: 'urn:' + name + ':',
        reviewers: reviewers.map((id) => ({ id, type: 'user' })),
        approvalRule: rule,
      },
    }),
    'Create drawer ontology'
  );
  ontologies.push(ontology.id);
  await okJson(
    await api.post('/api/v1/ontologyConcepts', {
      data: {
        name: 'Customer',
        ontology: ontology.fullyQualifiedName,
        conceptType: 'OWL_CLASS',
        description: 'Captured review content',
      },
    }),
    'Create reviewed concept'
  );
  const state = await okJson<OntologyState>(
    await api.get('/api/v1/ontologies/' + ontology.id + '/state'),
    'Read working revision'
  );
  const release = await okJson<OntologyRelease>(
    await api.post('/api/v1/ontologies/' + ontology.id + '/releases', {
      data: {
        expectedWorkingRevision: state.workingRevision,
        expectedActivationRevision: state.activationRevision,
        expectedLatestReleaseRevision: state.lastReleaseRevision,
        versionBump: VersionBump.Minor,
      },
    }),
    'Capture reviewed release'
  );
  expect(release.semanticVersion).toBe('0.1.0');
  const task = await okJson<Task>(
    await api.post('/api/v1/tasks', {
      data: {
        name: 'Review ' + name,
        category: 'Approval',
        type: 'RequestApproval',
        about: '<#E::ontologyRelease::' + release.fullyQualifiedName + '>',
      },
    }),
    'Request release review'
  );
  tasks.push(task.id);
  await expect
    .poll(
      async () =>
        (
          await okJson<Task>(
            await api.get('/api/v1/tasks/' + task.id),
            'Read review transitions'
          )
        ).availableTransitions?.length
    )
    .toBe(2);
  return { ontology, release, task };
};

const clean = async (
  api: APIRequestContext,
  tasks: string[],
  ontologies: string[]
) => {
  for (const id of tasks) {
    const task = await okJson<Task>(
      await api.get('/api/v1/tasks/' + id),
      'Read fixture task'
    );
    if (
      !task.resolution &&
      [TaskStatus.Open, TaskStatus.InProgress, TaskStatus.Pending].includes(
        task.status
      )
    ) {
      await okJson(
        await api.post('/api/v1/tasks/' + id + '/close', { data: {} }),
        'Close fixture task'
      );
    }
    await expect
      .poll(
        async () => {
          const response = await api.delete(
            '/api/v1/tasks/' + id + '?hardDelete=true'
          );
          if (response.status() === 400) {
            expect((await response.json()).message).toBe(
              'Close the ontology review and wait for workflow cleanup before deleting its task'
            );
            return false;
          }
          await okJson(response, 'Delete reconciled fixture task');
          return true;
        },
        { timeout: 45_000, intervals: [500, 1000, 2000] }
      )
      .toBe(true);
    expect((await api.get('/api/v1/tasks/' + id)).status()).toBe(404);
  }
  for (const id of ontologies) {
    const deleted = await deleteFixtureEntity(
      api,
      '/api/v1/ontologies/' + id + '?recursive=true'
    );
    expect(deleted.status()).toBe(200);
    expect((await api.get('/api/v1/ontologies/' + id)).status()).toBe(404);
  }
};

const openTask = async (page: Page, task: Task, ontology: Ontology) => {
  await page.goto(
    '/governance/ontology?ontology=' +
      ontology.id +
      '&source=review-test&task=' +
      task.id
  );
  await expect(
    page.getByTestId('task-detail-panel').getByTestId('ontology-review-panel')
  ).toBeVisible();
};

// The Studio Tasks dialog shows the Inbox task panel.
const taskDetail = (page: Page) => page.getByTestId('task-detail-panel');

const actionButton = (page: Page, name: string) =>
  taskDetail(page).getByRole('button', { name, exact: true });

const vote = async (page: Page, task: Task, button: Locator) => {
  const resolved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        '/api/v1/tasks/' + task.id + '/resolve' &&
      response.request().method() === 'POST'
  );
  await clickIgnoringToasts(button);
  const response = await resolved;
  expect(response.status()).toBe(200);
  return response;
};

test.describe(
  'Ontology review Tasks drawer',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const rule of [
      OntologyApprovalRule.AnyReviewer,
      OntologyApprovalRule.AllReviewers,
    ]) {
      test(
        'author and two reviewers complete ' +
          rule +
          ' and publish the approved version',
        async ({
          isolatedUserPage: authorPage,
          freshUserPage: first,
          browser,
        }) => {
          test.slow();
          const admin = await getWorkerAdminAPIContext();
          await authorPage.goto('/');
          const author = await getAuthContext(await getToken(authorPage));
          const second = new UserClass(undefined, true);
          const secondPage = await browser.newPage();
          const ontologies: string[] = [];
          const tasks: string[] = [];
          try {
            await first.user.setAdminRole(admin);
            await second.create(admin);
            await second.signIn(secondPage);
            const fixture = await createReview(
              author,
              [first.user.responseData.id, second.responseData.id],
              rule,
              ontologies,
              tasks
            );
            await test.step('The requester sees frozen pending reviewers without vote actions', async () => {
              await openTask(authorPage, fixture.task, fixture.ontology);
              await expect(
                taskDetail(authorPage).getByTestId('task-status-badge')
              ).toBeVisible();
              await expect(actionButton(authorPage, 'Approve')).toHaveCount(0);
              await expect(actionButton(authorPage, 'Reject')).toHaveCount(0);
              await authorPage.getByTestId('ontology-tasks-close').click();
              await expect(authorPage).toHaveURL(/source=review-test/);
              await expect(authorPage).not.toHaveURL(/[?&]task=/);
              // The banner announces only reviews waiting on the viewer's vote.
              await expect(
                authorPage.getByTestId('ontology-review-banner')
              ).toHaveCount(0);
            });
            await first.page.goto(
              '/governance/ontology?ontology=' + fixture.ontology.id
            );
            await expect(
              first.page.getByTestId('ontology-tasks-trigger')
            ).toContainText('1');
            const firstBanner = first.page.getByTestId(
              'ontology-review-banner'
            );
            await expect(firstBanner).toContainText('asked you to review');
            await firstBanner
              .getByRole('button', { name: 'Review', exact: true })
              .click();
            await expect(first.page).toHaveURL(
              new RegExp('task=' + fixture.task.id)
            );
            let finalPage = first.page;
            if (rule === OntologyApprovalRule.AllReviewers) {
              await test.step('The first All vote remains a green partial approval', async () => {
                await vote(
                  first.page,
                  fixture.task,
                  actionButton(first.page, 'Approve')
                );
                await expect(actionButton(first.page, 'Approve')).toHaveCount(
                  0
                );
                const partial = await okJson<Task>(
                  await admin.get('/api/v1/tasks/' + fixture.task.id),
                  'Read partially approved task'
                );
                expect(partial.status).toBe(TaskStatus.Open);
                // The approval toast can sit over the dialog's close button.
                await clickIgnoringToasts(
                  first.page.getByTestId('ontology-tasks-close')
                );
                await expect(
                  first.page.getByTestId('ontology-review-banner')
                ).toHaveCount(0);
                await expect(
                  first.page.getByTestId('ontology-tasks-trigger')
                ).toContainText('0');
              });
              finalPage = secondPage;
              await secondPage.goto(
                '/governance/ontology?ontology=' + fixture.ontology.id
              );
              const secondBanner = secondPage.getByTestId(
                'ontology-review-banner'
              );
              await expect(secondBanner).toContainText('asked you to review');
              await secondBanner
                .getByRole('button', { name: 'Review', exact: true })
                .click();
            }
            await test.step('Final approval survives a UUID reload', async () => {
              await vote(
                finalPage,
                fixture.task,
                actionButton(finalPage, 'Approve')
              );
              const status =
                taskDetail(finalPage).getByTestId('task-status-badge');
              await expect(status).toHaveText('Approved');
              await finalPage.reload();
              await expect(
                taskDetail(finalPage).getByTestId('ontology-review-panel')
              ).toBeVisible();
              await expect(status).toHaveText('Approved');
              await expect(actionButton(finalPage, 'Approve')).toHaveCount(0);
            });
            await test.step('The author publishes the approved version', async () => {
              await authorPage.goto(
                '/governance/ontology?ontology=' + fixture.ontology.id
              );
              await authorPage
                .getByTestId('ontology-publication-trigger')
                .click();
              const activation = authorPage.waitForResponse(
                (response) =>
                  new URL(response.url()).pathname ===
                    '/api/v1/ontologies/' +
                      fixture.ontology.id +
                      '/activation' && response.request().method() === 'PUT'
              );
              await clickIgnoringToasts(
                authorPage.getByTestId('ontology-publish-release')
              );
              const activated = await okJson<OntologyState>(
                await activation,
                'Publish reviewed release'
              );
              expect(activated.activeReleaseId).toBe(fixture.release.id);
            });
          } finally {
            await clean(admin, tasks, ontologies);
            await secondPage.close();
            await second.delete(admin);
            await author.dispose();
          }
        }
      );
    }

    test('requires a rejection reason and preserves it in the decided task and thread', async ({
      isolatedUserPage: authorPage,
      freshUserPage: reviewer,
    }) => {
      test.slow();
      const admin = await getWorkerAdminAPIContext();
      await authorPage.goto('/');
      const author = await getAuthContext(await getToken(authorPage));
      const ontologies: string[] = [];
      const tasks: string[] = [];
      try {
        await reviewer.user.setAdminRole(admin);
        const fixture = await createReview(
          author,
          [reviewer.user.responseData.id],
          OntologyApprovalRule.AnyReviewer,
          ontologies,
          tasks
        );
        await openTask(reviewer.page, fixture.task, fixture.ontology);
        await actionButton(reviewer.page, 'Reject').click();
        const reject = reviewer.page.getByTestId('task-action-comment-confirm');
        // The test id sits on the shared TextArea's field wrapper, not the textarea itself.
        const reason = reviewer.page
          .getByTestId('task-action-comment')
          .getByRole('textbox');
        await reason.fill('   ');
        await expect(reject).toBeDisabled();
        const original =
          '  Correct the customer definition.\nKeep the captured scope.  ';
        await reason.fill(original);
        const response = await vote(reviewer.page, fixture.task, reject);
        // The comment dialog trims what it sends.
        expect(response.request().postDataJSON().comment).toBe(original.trim());
        const status = taskDetail(reviewer.page).getByTestId(
          'task-status-badge'
        );
        await expect(status).toHaveText('Rejected');
        await expect(actionButton(reviewer.page, 'Approve')).toHaveCount(0);
        const review = await okJson<{ latestDecision: { reason: string } }>(
          await author.get(
            '/api/v1/ontologyReleases/' + fixture.release.id + '/review'
          ),
          'Read rejected review'
        );
        expect(review.latestDecision.reason).toBe(original.trim());
        await reviewer.page.reload();
        await expect(status).toHaveText('Rejected');
      } finally {
        await clean(admin, tasks, ontologies);
        await author.dispose();
      }
    });
  }
);
