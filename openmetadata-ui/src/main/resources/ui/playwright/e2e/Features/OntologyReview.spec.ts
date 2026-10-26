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
import { readFile } from 'fs/promises';
import { ContextMemory } from '../../../src/generated/entity/context/contextMemory';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyChangeSet } from '../../../src/generated/entity/data/ontologyChangeSet';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { Task } from '../../../src/generated/entity/tasks/task';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { fillCodeEditor } from '../../utils/codeEditor';
import {
  clickIgnoringToasts,
  fullUuid,
  getWorkerAdminAPIContext,
  uuid,
} from '../../utils/common';
import { MEMORIES_API } from '../../utils/ContextCenterUtil';
import { readNodePositions } from '../../utils/ontologyStudio';

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
  const node = page.getByTestId(`ontology-scope-${ontology.id}`);
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

const openPublication = async (page: Page, ontology: Ontology) => {
  await page.goto(`/governance/ontology?ontology=${ontology.id}`);
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
  await page.getByTestId('ontology-publication-trigger').click();
  await expect(page.getByTestId('ontology-publication-modal')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Capture release', exact: true })
  ).toBeEnabled();
};

const activateRelease = async (
  page: Page,
  ontology: Ontology,
  release: OntologyRelease,
  expectedRevision: number
) => {
  const activation = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/ontologies/${ontology.id}/activation`) &&
      response.request().method() === 'PUT'
  );
  await page
    .getByRole('button', { name: 'Activate release', exact: true })
    .click();
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
  await expect(page.getByTestId('ontology-active-release')).toHaveText(
    'Active'
  );
  await expect(
    page.getByRole('button', { name: 'Activate release', exact: true })
  ).toBeDisabled();
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
        await expect(
          page.getByRole('button', { name: 'Retry', exact: true })
        ).toBeVisible();
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
          await expect(page.getByTestId('code-mirror-container')).toHaveCount(
            0
          );
          await page.unroute(versionPath);
          await error
            .getByRole('button', { name: 'Retry', exact: true })
            .click();
          await page
            .getByTestId('ontology-review-panel')
            .getByRole('button', { name: 'Customer', exact: true })
            .click();
          await expect(page.getByTestId('code-mirror-container')).toContainText(
            'Submitted customer definition'
          );
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
          const definition = review.getByTestId('code-mirror-container');
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
            .getByRole('button', { name: 'Capture release', exact: true })
            .click();
          const release = await okJson<OntologyRelease>(
            await capture,
            'Capture release in Studio'
          );
          expect(release.baseReleaseId).toBe(releases.at(-1)?.id);
          expect(release.semanticVersion).toBe(
            releases.length === 0 ? '1.0.0' : '1.1.0'
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
          ).toBeVisible();

          const submission = author.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/v1/tasks' &&
              response.request().method() === 'POST'
          );
          await author
            .getByRole('button', { name: 'Request approval', exact: true })
            .click();
          const task = await okJson<Task>(
            await submission,
            'Submit captured release for workflow approval'
          );
          tasks.push(task.id);
          await expect(author).toHaveURL(new RegExp(`/tasks/${task.id}$`));
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
              .getByTestId('code-mirror-container')
              .filter({ hasText: description })
          ).toContainText(description);
          await approveReview(reviewer, task);
          const beforeActivation = await okJson<OntologyState>(
            await api.get(`/api/v1/ontologies/${ontology.id}/state`),
            'Read approved publication state'
          );
          expect(beforeActivation.activationRevision).toBe(releases.length - 1);

          await openPublication(author, ontology);
          await author.getByTestId('ontology-publication-tab-releases').click();
          await author
            .getByTestId(`ontology-release-select-${release.id}`)
            .click();
          await activateRelease(author, ontology, release, releases.length - 1);
        }

        const [firstRelease] = releases;
        await author.reload();
        await author.getByTestId('ontology-publication-trigger').click();
        await author.getByTestId('ontology-publication-tab-releases').click();
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
        await activateRelease(author, ontology, firstRelease, 2);
        await author
          .getByTestId('ontology-release-definition')
          .getByRole('button', { name: 'Customer', exact: true })
          .click();
        await expect(author.getByTestId('code-mirror-container')).toContainText(
          'First published definition'
        );
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
          author.getByRole('button', { name: 'Capture release', exact: true })
        ).toBeVisible();
        await author.keyboard.press('Escape');
        await expect(
          author.getByTestId('ontology-publication-modal')
        ).not.toBeVisible();
        for (const [format, extension] of [
          ['turtle', 'ttl'],
          ['rdfxml', 'rdf'],
          ['ntriples', 'nt'],
          ['jsonld', 'jsonld'],
        ]) {
          const exported = author.waitForResponse((response) => {
            const url = new URL(response.url());

            return (
              url.pathname ===
                `/api/v1/ontologyReleases/${firstRelease.id}/export` &&
              url.searchParams.get('format') === format
            );
          });
          await author.getByTestId('ontology-import-export-trigger').click();
          const formatButton = author.getByTestId(
            `ontology-release-format-${format}`
          );
          await expect(formatButton).toBeVisible();
          if (format !== 'rdfxml') {
            await formatButton.click();
          }
          const response = await exported;
          expect(response.ok()).toBeTruthy();
          expect(await response.text()).toContain('First published definition');
          await expect(
            author.getByTestId('ontology-release-export-preview')
          ).not.toBeEmpty();
          if (format === 'turtle') {
            await testInfo.attach('native-release-export', {
              body: await author
                .getByRole('dialog')
                .screenshot({ animations: 'disabled' }),
              contentType: 'image/png',
            });
          }
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
          expect(content).toBe(await response.text());
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
        .getByRole('button', { name: 'Capture release', exact: true })
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
