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
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';
import { disableAiAppMode, enableAiAppMode } from '../Utils/appMode';

test.use({ isolatedUserOptions: { isAdmin: true } });

const RELEASED_WORDING = 'Alpha wording that was published';
const DRAFT_WORDING = 'Alpha wording that only the draft has';

interface PublishedOntology {
  ontology: Ontology;
  alpha: OntologyConcept;
  tasks: string[];
}

const approveAndActivate = async (
  api: APIRequestContext,
  page: Page,
  ontology: Ontology,
  release: OntologyRelease,
  tasks: string[]
) => {
  const task = await okJson<Task>(
    await api.post('/api/v1/tasks', {
      data: {
        name: `Review ${release.fullyQualifiedName}`,
        category: 'Approval',
        type: 'RequestApproval',
        about: `<#E::ontologyRelease::${release.fullyQualifiedName}>`,
      },
    }),
    'Submit release review'
  );
  tasks.push(task.id);
  await expect
    .poll(async () => {
      const ready = await okJson<Task>(
        await api.get(`/api/v1/tasks/${task.id}`),
        'Read release review'
      );

      return ready.availableTransitions?.length;
    })
    .toBe(2);
  await page.goto(`/tasks/${task.id}`);
  const approved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/tasks/${task.id}/resolve` &&
      response.request().method() === 'POST'
  );
  await page.getByTestId('task-approve').click();
  expect((await approved).ok()).toBeTruthy();
  const state = await okJson<OntologyState>(
    await api.get(`/api/v1/ontologies/${ontology.id}/state`),
    'Read ontology state'
  );
  await okJson<OntologyState>(
    await api.put(`/api/v1/ontologies/${ontology.id}/activation`, {
      data: {
        releaseId: release.id,
        expectedActivationRevision: state.activationRevision,
      },
    }),
    'Activate release'
  );
};

const createOntology = async (
  api: APIRequestContext,
  reviewer?: UserClass
): Promise<Ontology> => {
  const name = `pw_published_view_${uuid()}`;

  return okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: {
        name,
        iri: `https://example.org/${name}`,
        namespace: `https://example.org/${name}#`,
        ...(reviewer
          ? { reviewers: [{ id: reviewer.responseData.id, type: 'user' }] }
          : {}),
      },
    }),
    'Create published-view ontology'
  );
};

const createConcept = async (
  api: APIRequestContext,
  ontology: Ontology,
  name: string,
  description?: string
) =>
  okJson<OntologyConcept>(
    await api.post('/api/v1/ontologyConcepts', {
      data: {
        name,
        description,
        ontology: ontology.fullyQualifiedName,
        conceptType: 'OWL_CLASS',
      },
    }),
    `Create concept ${name}`
  );

/** Publishes release 1, then edits the working draft so the two differ. */
const publishWithNewerDraft = async (
  api: APIRequestContext,
  reviewerPage: Page,
  reviewer: UserClass
): Promise<PublishedOntology> => {
  const tasks: string[] = [];
  const ontology = await createOntology(api, reviewer);
  const alpha = await createConcept(api, ontology, 'Alpha', RELEASED_WORDING);
  await createConcept(api, ontology, 'Beta', 'Beta wording');
  const state = await okJson<OntologyState>(
    await api.get(`/api/v1/ontologies/${ontology.id}/state`),
    'Read ontology revision'
  );
  const release = await okJson<OntologyRelease>(
    await api.post(`/api/v1/ontologies/${ontology.id}/releases`, {
      data: { expectedWorkingRevision: state.workingRevision },
    }),
    'Capture release'
  );
  await approveAndActivate(api, reviewerPage, ontology, release, tasks);
  await okJson(
    await api.patch(`/api/v1/ontologyConcepts/${alpha.id}`, {
      data: [{ op: 'replace', path: '/description', value: DRAFT_WORDING }],
      headers: { 'Content-Type': 'application/json-patch+json' },
    }),
    'Edit the draft wording'
  );

  return { ontology, alpha, tasks };
};

const cleanUp = async (
  api: APIRequestContext,
  ontologies: Ontology[],
  tasks: string[] = []
) => {
  for (const id of tasks) {
    await deleteFixtureEntity(api, `/api/v1/tasks/${id}?hardDelete=true`);
  }
  for (const { id } of ontologies) {
    await deleteFixtureEntity(api, `/api/v1/ontologies/${id}?recursive=true`);
  }
};

const openConsumerPage = async (browser: Browser, api: APIRequestContext) => {
  const consumer = new UserClass();
  await consumer.create(api);
  const context = await browser.newContext();
  const page = await context.newPage();
  await consumer.signIn(page);

  return {
    consumer,
    page,
    dispose: async () => {
      await context.close();
      await consumer.delete(api);
    },
  };
};

const studioUrl = (ontology: Ontology, query = '') =>
  `/governance/ontology?ontology=${ontology.id}${query}`;

const expectSelected = async (page: Page, testId: string) =>
  expect(page.getByTestId(testId)).toHaveAttribute('aria-selected', 'true', {
    timeout: 20_000,
  });

const openConceptInTree = async (page: Page, concept: OntologyConcept) => {
  await page.getByTestId('submode-tab-tree').click();
  await page.getByTestId(`ontology-tree-term-${concept.id}`).click();
};

test.describe(
  'Ontology Studio published version and URL state',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const appMode of ['ai', 'classic'] as const) {
      test(`a user without edit rights reads the published wording in ${appMode} mode, and reload keeps the view`, async ({
        isolatedUserPage: page,
        isolatedUser: reviewer,
        browser,
      }) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const fixture = await publishWithNewerDraft(api, page, reviewer);
        const reader = await openConsumerPage(browser, api);
        try {
          await (appMode === 'ai'
            ? enableAiAppMode(reader.page)
            : disableAiAppMode(reader.page));
          await reader.page.goto(studioUrl(fixture.ontology));
          await expect(reader.page.getByTestId('mode-tab-edit')).toHaveCount(0);
          await expect(
            reader.page.getByTestId('ontology-version-switch')
          ).toHaveCount(0);
          await openConceptInTree(reader.page, fixture.alpha);

          await expect(reader.page.getByText(RELEASED_WORDING)).toBeVisible();
          await expect(reader.page.getByText(DRAFT_WORDING)).toHaveCount(0);
          await reader.page.screenshot({
            path: `test-results/g15-consumer-${appMode}.png`,
          });

          await reader.page.getByTestId('mode-tab-query').click();
          await expect(reader.page).toHaveURL(/mode=query/);
          await reader.page.reload();
          await expectSelected(reader.page, 'mode-tab-query');
        } finally {
          await reader.dispose();
          await cleanUp(api, [fixture.ontology], fixture.tasks);
        }
      });
    }

    test('a concept owner without ontology rights reads the release, then edits their concept on the draft and keeps Edit after reload', async ({
      isolatedUserPage: page,
      isolatedUser: reviewer,
      browser,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await publishWithNewerDraft(api, page, reviewer);
      const owner = await openConsumerPage(browser, api);
      try {
        await okJson(
          await api.patch(`/api/v1/ontologyConcepts/${fixture.alpha.id}`, {
            data: [
              {
                op: 'add',
                path: '/owners',
                value: [{ id: owner.consumer.responseData.id, type: 'user' }],
              },
            ],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }),
          'Make the user the concept owner'
        );
        await owner.page.goto(studioUrl(fixture.ontology));
        await expect(owner.page.getByTestId('mode-tab-edit')).toHaveCount(0);
        await openConceptInTree(owner.page, fixture.alpha);

        await expect(owner.page.getByText(RELEASED_WORDING)).toBeVisible();

        await owner.page.getByTestId('ontology-concept-edit').click();

        await expectSelected(owner.page, 'mode-tab-edit');
        await expect(owner.page).toHaveURL(/mode=edit/);
        await expect(owner.page).not.toHaveURL(/version=/);
        const editor = owner.page.getByTestId('ontology-concept-authoring');
        await expect(editor).toBeVisible();
        await expect
          .poll(() =>
            editor
              .locator('input, textarea, [contenteditable="true"]')
              .evaluateAll((fields) =>
                fields
                  .map((field) =>
                    'value' in field
                      ? (field as HTMLInputElement).value
                      : field.textContent
                  )
                  .join('|')
              )
          )
          .toContain(DRAFT_WORDING);
        await owner.page.screenshot({
          path: 'test-results/g15-owner-edit.png',
        });

        await owner.page.reload();

        await expectSelected(owner.page, 'mode-tab-edit');
        await expect(owner.page).toHaveURL(/mode=edit/);

        await owner.page.goto(studioUrl(fixture.ontology, '&mode=edit'));

        await expectSelected(owner.page, 'mode-tab-view');
        await expect(owner.page).not.toHaveURL(/mode=edit/);
      } finally {
        await owner.dispose();
        await cleanUp(api, [fixture.ontology], fixture.tasks);
      }
    });

    test('a user without edit rights is told nothing is published when the ontology has no release', async ({
      browser,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const ontology = await createOntology(api);
      await createConcept(api, ontology, 'Draftonly', 'Never released');
      const reader = await openConsumerPage(browser, api);
      try {
        await reader.page.goto(studioUrl(ontology));

        await expect(
          reader.page.getByTestId('ontology-nothing-published')
        ).toBeVisible();
        await expect(reader.page.getByText('Never released')).toHaveCount(0);
        await reader.page.screenshot({
          path: 'test-results/g15-no-release.png',
        });
      } finally {
        await reader.dispose();
        await cleanUp(api, [ontology]);
      }
    });

    test('an editor switches between Draft and Published, and Edit is offered only on Draft', async ({
      isolatedUserPage: page,
      isolatedUser: reviewer,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await publishWithNewerDraft(api, page, reviewer);
      try {
        await page.goto(studioUrl(fixture.ontology));
        await openConceptInTree(page, fixture.alpha);

        await expect(page.getByText(DRAFT_WORDING)).toBeVisible();
        await expect(page.getByTestId('mode-tab-edit')).toBeVisible();

        await page.getByTestId('ontology-version-published').click();

        await expect(page.getByText(RELEASED_WORDING)).toBeVisible();
        await expect(page.getByText(DRAFT_WORDING)).toHaveCount(0);
        await expect(page.getByTestId('mode-tab-edit')).toHaveCount(0);
        await expect(page).toHaveURL(/version=published/);
        await page.screenshot({ path: 'test-results/g15-switch.png' });

        await page.getByTestId('ontology-version-draft').click();

        await expect(page.getByText(DRAFT_WORDING)).toBeVisible();
        await expect(page.getByTestId('mode-tab-edit')).toBeVisible();
        await expect(page).not.toHaveURL(/version=/);
      } finally {
        await cleanUp(api, [fixture.ontology], fixture.tasks);
      }
    });

    test('reload keeps the mode, view and version, and Back walks the views in reverse', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const ontology = await createOntology(api);
      await createConcept(api, ontology, 'Alpha', 'Alpha wording');
      try {
        await test.step('Reload on each mode and view', async () => {
          for (const [query, modeTab, viewTab] of [
            ['&mode=edit', 'mode-tab-edit', 'submode-tab-graph'],
            ['&mode=edit&view=tree', 'mode-tab-edit', 'submode-tab-tree'],
            ['&view=tree', 'mode-tab-view', 'submode-tab-tree'],
            ['&mode=query', 'mode-tab-query', 'submode-tab-console'],
            [
              '&mode=query&view=builder',
              'mode-tab-query',
              'submode-tab-builder',
            ],
          ] as const) {
            await page.goto(studioUrl(ontology, query));
            await expectSelected(page, modeTab);
            await expectSelected(page, viewTab);
            await page.reload();
            await expectSelected(page, modeTab);
            await expectSelected(page, viewTab);
          }
          await page.screenshot({ path: 'test-results/g15-reload.png' });
        });

        await test.step('Back returns to each previous view', async () => {
          await page.goto(studioUrl(ontology));
          await expectSelected(page, 'submode-tab-graph');
          await page.getByTestId('submode-tab-tree').click();
          await page.getByTestId('mode-tab-edit').click();
          await page.getByTestId('mode-tab-query').click();
          await expect(page).toHaveURL(/mode=query/);

          await page.goBack();
          await expectSelected(page, 'mode-tab-edit');
          await page.goBack();
          await expectSelected(page, 'mode-tab-view');
          await expectSelected(page, 'submode-tab-tree');
          await page.goBack();
          await expectSelected(page, 'submode-tab-graph');
          await page.screenshot({ path: 'test-results/g15-back.png' });
        });
      } finally {
        await cleanUp(api, [ontology]);
      }
    });

    test('a shared link opens the same view for another user, within their rights', async ({
      isolatedUserPage: page,
      isolatedUser: reviewer,
      browser,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await publishWithNewerDraft(api, page, reviewer);
      const reader = await openConsumerPage(browser, api);
      try {
        const link = studioUrl(
          fixture.ontology,
          `&view=tree&version=published&concept=${fixture.alpha.id}`
        );
        await page.goto(link);
        await expectSelected(page, 'submode-tab-tree');
        await expect(page.getByText(RELEASED_WORDING)).toBeVisible();

        await reader.page.goto(link);

        await expect(reader.page.getByTestId('mode-tab-edit')).toHaveCount(0);
        await expectSelected(reader.page, 'submode-tab-tree');
        await expect(reader.page.getByText(RELEASED_WORDING)).toBeVisible();

        await reader.page.goto(studioUrl(fixture.ontology, '&mode=edit'));
        await expectSelected(reader.page, 'mode-tab-view');
        await expect(reader.page.getByTestId('mode-tab-edit')).toHaveCount(0);
        await reader.page.screenshot({ path: 'test-results/g15-share.png' });
      } finally {
        await reader.dispose();
        await cleanUp(api, [fixture.ontology], fixture.tasks);
      }
    });

    test('the Overview tab shows the counts, owners, reviewers, version and namespace the API holds', async ({
      isolatedUserPage: page,
      isolatedUser: reviewer,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await publishWithNewerDraft(api, page, reviewer);
      try {
        await page.goto(studioUrl(fixture.ontology, '&view=ontology'));
        const overview = page.getByTestId('ontology-overview');

        await expect(overview).toBeVisible();
        await expect(
          page.getByTestId('ontology-overview-count-concepts')
        ).toContainText('2');
        await expect(
          page.getByTestId('ontology-overview-namespace')
        ).toContainText(fixture.ontology.namespace);
        await expect(
          page.getByTestId('ontology-overview-version')
        ).toContainText('Release 1');
        await expect(
          page.getByTestId('ontology-overview-reviewers')
        ).toContainText(reviewer.getUserDisplayName());
        await page.screenshot({ path: 'test-results/g15-overview.png' });

        const bare = await createOntology(api);
        try {
          await page.goto(studioUrl(bare, '&view=ontology'));

          await expect(
            page.getByTestId('ontology-overview-count-concepts')
          ).toContainText('0');
          await expect(
            page.getByTestId('ontology-overview-version')
          ).toContainText('Draft');
        } finally {
          await cleanUp(api, [bare]);
        }
      } finally {
        await cleanUp(api, [fixture.ontology], fixture.tasks);
      }
    });

    // Signing out revokes the account's token, so it cannot be the worker's shared account.
    test('the health card stays minimized after a reload and after signing in again', async ({
      browser,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const user = new UserClass(undefined, true);
      await user.create(api);
      const page = await browser.newPage();
      const ontology = await createOntology(api);
      await createConcept(api, ontology, 'Lonely');
      try {
        await user.signIn(page);
        await page.goto(studioUrl(ontology));
        await page.getByRole('button', { name: 'Minimize' }).click();
        await expect(page.getByTestId('ontology-health-restore')).toBeVisible();
        await page.screenshot({ path: 'test-results/g15-health.png' });

        await page.reload();
        await expect(page.getByTestId('ontology-health-restore')).toBeVisible();

        await user.logout(page);
        await user.signIn(page);
        await page.goto(studioUrl(ontology));

        await expect(page.getByTestId('ontology-health-restore')).toBeVisible();
      } finally {
        await page.close();
        await user.delete(api);
        await cleanUp(api, [ontology]);
      }
    });

    test('an unknown ontology id and an unknown concept id each say the item was not found', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const ontology = await createOntology(api);
      await createConcept(api, ontology, 'Alpha', 'Alpha wording');
      try {
        await page.goto(
          `/governance/ontology?ontology=${'00000000-0000-4000-8000-000000000000'}`
        );
        await expect(page.getByTestId('ontology-not-found')).toBeVisible();

        await page.goto(
          studioUrl(ontology, '&concept=00000000-0000-4000-8000-000000000000')
        );
        await expect(
          page.getByTestId('ontology-concept-not-found')
        ).toBeVisible();
        await page.screenshot({ path: 'test-results/g15-bad-ids.png' });
      } finally {
        await cleanUp(api, [ontology]);
      }
    });
  }
);
