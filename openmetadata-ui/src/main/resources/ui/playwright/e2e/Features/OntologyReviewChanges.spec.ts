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
import { VersionBump } from '../../../src/generated/api/data/captureOntologyRelease';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { Task } from '../../../src/generated/entity/tasks/task';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';
import { visitTriage } from '../../utils/inbox';

test.use({ isolatedUserOptions: { isAdmin: true } });

const UUID_IN_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}/;

const g7Shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const path = testInfo.outputPath(`g7-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`g7-${name}`, { path, contentType: 'image/png' });
};

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

const createOntology = async (
  api: APIRequestContext,
  prefix: string,
  reviewerIds: string[] = []
) => {
  const name = `${prefix}_${uuid()}`;

  return okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: {
        name,
        iri: `https://example.org/${name}`,
        namespace: `https://example.org/${name}/`,
        reviewers: reviewerIds.map((id) => ({ id, type: 'user' })),
      },
    }),
    'Create ontology'
  );
};

const addConcept = async (
  api: APIRequestContext,
  ontology: Ontology,
  name: string,
  description = `${name} definition`
) =>
  okJson<OntologyConcept>(
    await api.post('/api/v1/ontologyConcepts', {
      data: {
        name,
        ontology: ontology.fullyQualifiedName,
        conceptType: 'OWL_CLASS',
        description,
      },
    }),
    `Create concept ${name}`
  );

const describeConcept = async (
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

const readState = async (api: APIRequestContext, ontology: Ontology) =>
  okJson<OntologyState>(
    await api.get(`/api/v1/ontologies/${ontology.id}/state`),
    'Read ontology state'
  );

const captureRelease = async (
  api: APIRequestContext,
  ontology: Ontology,
  versionBump?: VersionBump
) => {
  const state = await readState(api, ontology);

  return okJson<OntologyRelease>(
    await api.post(`/api/v1/ontologies/${ontology.id}/releases`, {
      data: {
        expectedWorkingRevision: state.workingRevision,
        expectedActivationRevision: state.activationRevision,
        expectedLatestReleaseRevision: state.lastReleaseRevision,
        ...(versionBump ? { versionBump } : {}),
      },
    }),
    'Capture release'
  );
};

/** With no reviewers the owner publishes directly, so this gives a live baseline. */
const publishBaseline = async (api: APIRequestContext, ontology: Ontology) => {
  const release = await captureRelease(api, ontology, VersionBump.Major);
  const state = await readState(api, ontology);
  await okJson(
    await api.put(`/api/v1/ontologies/${ontology.id}/activation`, {
      data: {
        releaseId: release.id,
        expectedActivationRevision: state.activationRevision,
      },
    }),
    'Activate baseline'
  );

  return release;
};

const openDialog = async (page: Page, ontology: Ontology) => {
  await page.goto(`/governance/ontology?ontology=${ontology.id}`);
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
  await page.getByTestId('ontology-publication-trigger').click();
  await expect(page.getByTestId('ontology-publication-modal')).toBeVisible();
  await expect(page.getByTestId('ontology-publication-text')).toBeVisible();
};

// The ontology's own row sits among the class rows, so pick the class ones.
const conceptRows = (page: Page) =>
  page
    .getByTestId('ontology-working-concept-summary')
    .filter({ hasText: /^Class / });

const cleanUp = async (
  api: APIRequestContext,
  ontologies: Ontology[],
  tasks: string[] = []
) => {
  for (const id of tasks) {
    await api.post(`/api/v1/tasks/${id}/close`, { data: {} });
    await deleteFixtureEntity(api, `/api/v1/tasks/${id}?hardDelete=true`);
  }
  for (const ontology of ontologies) {
    await deleteFixtureEntity(
      api,
      `/api/v1/ontologies/${ontology.id}?recursive=true`
    );
  }
};

test.describe(
  'Review dialog change list (G7)',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const mode of ['ai', 'classic'] as const) {
      test(`lane 1: names API-created concepts by label, never by their UUID IRI, in ${mode} mode`, async ({
        isolatedUserPage: author,
        isolatedUser,
      }, testInfo) => {
        const api = await getWorkerAdminAPIContext();
        await setMode(api, isolatedUser.responseData.id, mode);
        const ontology = await createOntology(api, 'pw_g7_labels');
        try {
          const concept = await addConcept(api, ontology, 'Customer Account');
          expect(concept.iri).toMatch(UUID_IN_TEXT);
          await openDialog(author, ontology);

          await expect(conceptRows(author)).toHaveText([
            'Class Customer Account · 0 properties',
          ]);
          await expect(
            author.getByTestId('ontology-publication-modal')
          ).not.toContainText(UUID_IN_TEXT);
          await g7Shot(author, testInfo, `labels-${mode}`);
        } finally {
          await cleanUp(api, [ontology]);
        }
      });
    }

    test('lane 2: filters and search show the matching rows with correct counts', async ({
      isolatedUserPage: author,
      isolatedUser,
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      await setMode(api, isolatedUser.responseData.id, 'ai');
      const ontology = await createOntology(api, 'pw_g7_filters');
      try {
        await addConcept(api, ontology, 'Beta');
        const gamma = await addConcept(api, ontology, 'Gamma');
        const beta = await okJson<OntologyConcept>(
          await api.get(
            `/api/v1/ontologyConcepts/name/${encodeURIComponent(
              `${ontology.fullyQualifiedName}.Beta`
            )}`
          ),
          'Read Beta'
        );
        await publishBaseline(api, ontology);
        await addConcept(api, ontology, 'Delta');
        await addConcept(api, ontology, 'Delphi');
        await describeConcept(api, beta, 'Beta, reworded');
        await okJson(
          await api.delete(`/api/v1/ontologyConcepts/${gamma.id}`),
          'Remove Gamma'
        );
        await openDialog(author, ontology);
        await expect(
          author.getByTestId('ontology-change-filter-all')
        ).toHaveText('All · 4');

        await expect(
          author.getByTestId('ontology-change-filter-added')
        ).toHaveText('Added · 2');
        await expect(
          author.getByTestId('ontology-change-filter-changed')
        ).toHaveText('Changed · 1');
        await expect(
          author.getByTestId('ontology-change-filter-removed')
        ).toHaveText('Removed · 1');

        await author.getByTestId('ontology-change-filter-added').click();
        await expect(conceptRows(author)).toHaveText([
          'Class Delphi · 0 properties',
          'Class Delta · 0 properties',
        ]);
        await author.getByTestId('ontology-change-filter-changed').click();
        await expect(conceptRows(author)).toHaveText([
          'Class Beta · 0 properties',
        ]);
        await author.getByTestId('ontology-change-filter-removed').click();
        await expect(conceptRows(author)).toHaveText([
          'Class Gamma · 0 properties',
        ]);
        await g7Shot(author, testInfo, 'filters');

        await author.getByTestId('ontology-change-filter-all').click();
        await author.getByTestId('ontology-change-search').fill('del');
        await expect(conceptRows(author)).toHaveCount(2);
        await expect(
          author.getByTestId('ontology-change-filter-all')
        ).toHaveText('All · 2');
      } finally {
        await cleanUp(api, [ontology]);
      }
    });

    test('lane 3: a removal pre-selects Major with the reason beside it', async ({
      isolatedUserPage: author,
      isolatedUser,
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      await setMode(api, isolatedUser.responseData.id, 'ai');
      const ontology = await createOntology(api, 'pw_g7_major');
      try {
        await addConcept(api, ontology, 'Keep');
        const drop = await addConcept(api, ontology, 'Drop');
        await publishBaseline(api, ontology);
        await okJson(
          await api.delete(`/api/v1/ontologyConcepts/${drop.id}`),
          'Remove Drop'
        );
        await openDialog(author, ontology);

        await expect(
          author.getByRole('radio', { name: /Major/ })
        ).toBeChecked();
        await expect(author.getByTestId('ontology-version-reason')).toHaveText(
          'You removed definitions that readers may rely on, so a Major version is suggested.'
        );
        await expect(
          author
            .getByTestId('ontology-version-preview')
            .filter({ hasText: /^v1\.0\.0 → v2\.0\.0$/ })
        ).not.toHaveCount(0);
        await g7Shot(author, testInfo, 'major');
      } finally {
        await cleanUp(api, [ontology]);
      }
    });

    test('lane 4: a first release suggests v0.1.0 and offers v1.0.0 as stable', async ({
      isolatedUserPage: author,
      isolatedUser,
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      await setMode(api, isolatedUser.responseData.id, 'ai');
      const ontology = await createOntology(api, 'pw_g7_first');
      try {
        await addConcept(api, ontology, 'Customer');
        await openDialog(author, ontology);

        await expect(
          author.getByRole('radio', { name: /Minor/ })
        ).toBeChecked();
        await expect(
          author
            .getByTestId('ontology-version-preview')
            .filter({ hasText: /^Draft → v0\.1\.0$/ })
        ).not.toHaveCount(0);
        await expect(
          author.getByTestId('ontology-version-reason')
        ).toContainText(
          'This is the first release. v0.1.0 starts the unstable 0.x line. Choose Major for v1.0.0 as the stable release.'
        );
        await expect(
          author.getByTestId('ontology-version-major')
        ).toContainText('1.0.0');
        await g7Shot(author, testInfo, 'first');
      } finally {
        await cleanUp(api, [ontology]);
      }
    });

    test('lane 5: a structure error shows when the dialog opens, before any capture', async ({
      isolatedUserPage: author,
      isolatedUser,
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      await setMode(api, isolatedUser.responseData.id, 'ai');
      const ontology = await createOntology(api, 'pw_g7_validate');
      try {
        await addConcept(api, ontology, 'Customer');
        await author.route(
          '**/api/v1/ontologies/*/working/validation*',
          (route) =>
            route.fulfill({
              json: {
                valid: false,
                violationCount: 1,
                violations: [
                  {
                    code: 'SUBCLASS_CYCLE',
                    message: 'Customer is its own ancestor',
                    path: '/Customer',
                    severity: 'ERROR',
                  },
                ],
              },
            })
        );
        const releases: string[] = [];
        author.on('request', (request) => {
          if (
            request.method() === 'POST' &&
            request.url().endsWith(`/ontologies/${ontology.id}/releases`)
          ) {
            releases.push(request.url());
          }
        });
        await openDialog(author, ontology);

        await expect(
          author.getByTestId('ontology-working-violations')
        ).toContainText('Customer is its own ancestor');
        await expect(
          author.getByTestId('ontology-release-validation')
        ).toContainText('Structural validation: Failed');
        expect(releases).toEqual([]);
        await g7Shot(author, testInfo, 'validate-open');
      } finally {
        await cleanUp(api, [ontology]);
      }
    });

    test('lane 6: logical consistency reads Not applicable and raises no warning when inference is off', async ({
      isolatedUserPage: author,
      isolatedUser,
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      await setMode(api, isolatedUser.responseData.id, 'ai');
      const ontology = await createOntology(api, 'pw_g7_logical');
      try {
        await addConcept(api, ontology, 'Customer');
        await captureRelease(api, ontology, VersionBump.Minor);
        await openDialog(author, ontology);

        await expect(
          author.getByTestId('ontology-logical-consistency')
        ).toHaveText('Logical consistency: Not applicable');
        await expect(
          author.getByTestId('ontology-release-validation').getByRole('alert')
        ).toHaveCount(0);
        await g7Shot(author, testInfo, 'logical');
      } finally {
        await cleanUp(api, [ontology]);
      }
    });
  }
);

test.describe(
  'Review task contents and banner (G7)',
  { tag: ['@Features', '@Governance'] },
  () => {
    const requestReview = async (page: Page, ontology: Ontology) => {
      await openDialog(page, ontology);
      const created = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/v1/tasks' &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('ontology-request-review').click();
      const task = await okJson<Task>(await created, 'Request review');
      await expect(
        page.getByTestId('ontology-publication-notice-requested')
      ).toBeVisible();

      return task;
    };

    test('lane 7: a reviewer sees each changed field with old and new values and no JSON', async ({
      isolatedUserPage: author,
      isolatedUser,
      freshUserPage: { page: reviewer, user },
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      await user.setAdminRole(api);
      await setMode(api, isolatedUser.responseData.id, 'ai');
      const ontology = await createOntology(api, 'pw_g7_diff');
      const tasks: string[] = [];
      try {
        const customer = await addConcept(
          api,
          ontology,
          'Customer',
          'Someone who buys'
        );
        await publishBaseline(api, ontology);
        await okJson(
          await api.patch(`/api/v1/ontologies/${ontology.id}`, {
            headers: { 'Content-Type': 'application/json-patch+json' },
            data: [
              {
                op: 'add',
                path: '/reviewers',
                value: [{ id: user.responseData.id, type: 'user' }],
              },
            ],
          }),
          'Add reviewer'
        );
        await describeConcept(api, customer, 'Someone who buys or subscribes');
        const task = await requestReview(author, ontology);
        tasks.push(task.id);

        await reviewer.goto(`/tasks/${task.id}`);
        const panel = reviewer.getByTestId('ontology-review-panel');
        await panel
          .getByRole('button', { name: 'Customer', exact: true })
          .click();
        const changes = panel.getByTestId('ontology-review-field-change');

        await expect(changes).toHaveText([
          'descriptionBefore: Someone who buysAfter: Someone who buys or subscribes',
        ]);
        await expect(
          panel.getByTestId('ontology-review-field-changes')
        ).not.toContainText(/[{}"]/);
        await expect(panel.getByTestId('code-mirror-container')).toHaveCount(0);
        await g7Shot(reviewer, testInfo, 'diff');
      } finally {
        await cleanUp(api, [ontology], tasks);
      }
    });

    test('lane 8: task rows in the Studio drawer and the Inbox name the ontology and the version', async ({
      isolatedUserPage: author,
      isolatedUser,
      freshUserPage: { page: reviewer, user },
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      await user.setAdminRole(api);
      await setMode(api, isolatedUser.responseData.id, 'ai');
      await setMode(api, user.responseData.id, 'ai');
      const first = await createOntology(api, 'pw_g7_tasks_a', [
        user.responseData.id,
      ]);
      const second = await createOntology(api, 'pw_g7_tasks_b', [
        user.responseData.id,
      ]);
      const tasks: string[] = [];
      try {
        for (const ontology of [first, second]) {
          await addConcept(api, ontology, 'Customer');
          tasks.push((await requestReview(author, ontology)).id);
        }
        const titles = [first, second].map(
          (ontology) => `Review ${ontology.name} v0.1.0`
        );

        await reviewer.goto(`/governance/ontology?ontology=${first.id}`);
        await reviewer.getByTestId('ontology-tasks-trigger').click();
        for (const title of titles) {
          await expect(
            reviewer.getByRole('button', { name: new RegExp(`${title}$`) })
          ).toBeVisible();
        }
        await g7Shot(reviewer, testInfo, 'task-titles');

        await visitTriage(reviewer);
        for (const title of titles) {
          await expect(reviewer.getByTestId('inbox-tasks-tab')).toContainText(
            title
          );
        }
        await g7Shot(reviewer, testInfo, 'task-titles-inbox');
      } finally {
        await cleanUp(api, [first, second], tasks);
      }
    });

    test('lane 9: the banner asks the reviewer, only for the ontology in view, and never the requester', async ({
      isolatedUserPage: author,
      isolatedUser,
      freshUserPage: { page: reviewer, user },
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      await user.setAdminRole(api);
      await setMode(api, isolatedUser.responseData.id, 'ai');
      await setMode(api, user.responseData.id, 'ai');
      const reviewed = await createOntology(api, 'pw_g7_banner_a', [
        user.responseData.id,
      ]);
      const other = await createOntology(api, 'pw_g7_banner_b');
      const tasks: string[] = [];
      try {
        await addConcept(api, reviewed, 'Customer');
        await addConcept(api, other, 'Order');
        const task = await requestReview(author, reviewed);
        tasks.push(task.id);

        await author.goto(`/governance/ontology?ontology=${reviewed.id}`);
        await expect(
          author.getByTestId('ontology-tasks-trigger')
        ).toBeVisible();
        await expect(author.getByTestId('ontology-review-banner')).toHaveCount(
          0
        );

        await reviewer.goto(`/governance/ontology?ontology=${reviewed.id}`);
        const banner = reviewer.getByTestId('ontology-review-banner');
        await expect(banner).toContainText('asked you to review v0.1.0');
        await expect(
          banner.getByRole('button', { name: 'Review', exact: true })
        ).toBeVisible();
        await g7Shot(reviewer, testInfo, 'banner');

        await reviewer.goto(`/governance/ontology?ontology=${other.id}`);
        await expect(
          reviewer.getByTestId('ontology-tasks-trigger')
        ).toBeVisible();
        await expect(
          reviewer.getByTestId('ontology-review-banner')
        ).toHaveCount(0);

        await reviewer.goto('/governance/ontology');
        await expect(
          reviewer.getByTestId('ontology-open-reviews-banner')
        ).toContainText(`asked you to review ${reviewed.name}`);
      } finally {
        await cleanUp(api, [reviewed, other], tasks);
      }
    });

    test('lane 10: a new ontology with one concept shows Draft once, a count of 1 and "1 concept"', async ({
      isolatedUserPage: author,
      isolatedUser,
    }, testInfo) => {
      const api = await getWorkerAdminAPIContext();
      await setMode(api, isolatedUser.responseData.id, 'classic');
      const ontology = await createOntology(api, 'pw_g7_counts');
      try {
        await addConcept(api, ontology, 'Customer');
        await author.goto(`/governance/ontology?ontology=${ontology.id}`);
        await expect(author.getByTestId('ontology-studio-shell')).toBeVisible();

        await expect(
          author.getByTestId('ontology-version-draft-count')
        ).toHaveText('1');
        await expect(author.getByTestId('ontology-explorer-stats')).toHaveText(
          '1 concept · 0 relations'
        );
        await expect(author.getByText(/Draft · Draft/)).toHaveCount(0);
        await g7Shot(author, testInfo, 'counts');

        await openDialog(author, ontology);
        await expect(author.getByTestId('ontology-change-counts')).toHaveText(
          '1 change: 1 concept'
        );
      } finally {
        await cleanUp(api, [ontology]);
      }
    });
  }
);

test.describe(
  'Review dialog performance (G7)',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('probe: the dialog paints and validates a 400-concept draft within budget', async ({
      isolatedUserPage: author,
      isolatedUser,
    }, testInfo) => {
      test.setTimeout(600_000);
      const api = await getWorkerAdminAPIContext();
      await setMode(api, isolatedUser.responseData.id, 'ai');
      const ontology = await createOntology(api, 'pw_g7_perf');
      try {
        const names = Array.from({ length: 400 }, (_, i) => `Concept${i}`);
        for (let start = 0; start < names.length; start += 20) {
          await Promise.all(
            names
              .slice(start, start + 20)
              .map((name) => addConcept(api, ontology, name))
          );
        }
        await author.goto(`/governance/ontology?ontology=${ontology.id}`);
        await expect(author.getByTestId('ontology-studio-shell')).toBeVisible();
        const firstPaint: number[] = [];
        const validation: number[] = [];
        for (let run = 0; run < 10; run++) {
          await author.reload();
          await expect(
            author.getByTestId('ontology-studio-shell')
          ).toBeVisible();
          const trigger = author.getByTestId('ontology-publication-trigger');
          await expect(trigger).toBeEnabled();
          const started = Date.now();
          await trigger.click();
          await expect(
            author.getByTestId('ontology-publication-modal')
          ).toBeVisible();
          firstPaint.push(Date.now() - started);
          await expect(
            author.getByTestId('ontology-release-validation')
          ).toContainText('Structural validation: Passed', { timeout: 30_000 });
          validation.push(Date.now() - started);
        }
        const median = (values: number[]) =>
          [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
        const report = `first paint ms ${firstPaint.join(',')} (median ${median(
          firstPaint
        )}); validation ms ${validation.join(',')} (median ${median(
          validation
        )})`;
        testInfo.annotations.push({ type: 'g7-perf', description: report });
        console.log(`G7 PERF ${report}`);

        expect(median(validation)).toBeLessThan(3000);
      } finally {
        await cleanUp(api, [ontology]);
      }
    });
  }
);
