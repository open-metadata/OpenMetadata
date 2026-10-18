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
import { OntologyAxiom } from '../../../src/generated/entity/data/ontologyAxiom';
import { OntologyChangeSet } from '../../../src/generated/entity/data/ontologyChangeSet';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyProperty } from '../../../src/generated/entity/data/ontologyProperty';
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { Task } from '../../../src/generated/entity/tasks/task';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { fillCodeEditor } from '../../utils/codeEditor';
import { fullUuid, getWorkerAdminAPIContext, uuid } from '../../utils/common';
import { MEMORIES_API } from '../../utils/ContextCenterUtil';
import { readGraphEdges, readNodePositions } from '../../utils/ontologyStudio';

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
  const listing = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/ontologies'
  );
  await page
    .getByRole('button', { name: 'Select Ontology', exact: true })
    .click();
  let result = await okJson<{ data: Ontology[]; paging: { after?: string } }>(
    await listing,
    'List native ontologies'
  );
  const node = page.getByTestId(`tree-node-${ontology.id}`);
  while (!result.data.some((item) => item.id === ontology.id)) {
    expect(
      result.paging.after,
      'Created ontology is available to its author'
    ).toBeTruthy();
    const nextPage = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/v1/ontologies'
    );
    await page
      .getByTestId('tree-node-load-more-root')
      .getByRole('button')
      .click();
    result = await okJson<typeof result>(
      await nextPage,
      'Read the next ontology page'
    );
  }
  await node.click();
};

const openPublication = async (page: Page, ontology: Ontology) => {
  await page.goto('/governance/ontology');
  await selectOntology(page, ontology);
  await page.getByTestId('mode-tab-releases').click();
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
      test(`returns to glossary Studio when an ontology deep link fails with ${status}`, async ({
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
        await expect(page).toHaveURL(
          /\/governance\/ontology\?source=context-center$/
        );
        await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
          'aria-selected',
          'true'
        );
        await expect(page.getByTestId('ontology-explorer')).toBeVisible();
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
          releases.push(release);
          expect(release.entityStatus).toBe('Draft');
          await expect(
            author.getByRole('button', {
              name: 'Activate release',
              exact: true,
            })
          ).toBeDisabled();
          await expect(author.getByRole('alert')).toContainText(
            'Logical consistency has not been checked'
          );

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
          await author.getByLabel('Ontology release', { exact: true }).click();
          await author.getByTestId(`tree-node-${release.id}`).click();
          await activateRelease(author, ontology, release, releases.length - 1);
        }

        const [firstRelease] = releases;
        await author.reload();
        await author.getByTestId('mode-tab-releases').click();
        await expect(author.getByTestId('ontology-active-release')).toHaveText(
          'Active'
        );
        await author.getByLabel('Ontology release', { exact: true }).click();
        await author.getByTestId(`tree-node-${firstRelease.id}`).click();
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
        for (const [format, label, extension] of [
          ['turtle', 'Turtle (.ttl)', 'ttl'],
          ['rdfxml', 'RDF/XML (.rdf)', 'rdf'],
          ['ntriples', 'N-Triples (.nt)', 'nt'],
          ['jsonld', 'JSON-LD', 'jsonld'],
        ]) {
          const exported = author.waitForResponse((response) => {
            const url = new URL(response.url());

            return (
              url.pathname ===
                `/api/v1/ontologyReleases/${firstRelease.id}/export` &&
              url.searchParams.get('format') === format
            );
          });
          const downloaded = author.waitForEvent('download');
          await author
            .getByTestId('ontology-release-definition')
            .getByRole('button', { name: 'Export', exact: true })
            .click();
          if (format === 'turtle') {
            await testInfo.attach('native-release-export', {
              body: await author
                .getByRole('menu', { name: 'Export', exact: true })
                .screenshot({ animations: 'disabled' }),
              contentType: 'image/png',
            });
          }
          await author
            .getByRole('menuitem', { name: label, exact: true })
            .click();
          const response = await exported;
          expect(response.ok()).toBeTruthy();
          const download = await downloaded;
          expect(download.suggestedFilename()).toBe(
            `ontology-release-${firstRelease.id}.${extension}`
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
  'authors a native ontology and concept in Studio with independent reviewers',
  { tag: ['@Features', '@Governance'] },
  async (
    { isolatedUserPage: author, freshUserPage: { user: reviewer } },
    testInfo
  ) => {
    test.slow();
    const api = await getWorkerAdminAPIContext();
    const name = `pw_authoring_${uuid()}`;
    let ontology: Ontology | undefined;
    try {
      await author.goto('/governance/ontology');
      await author.getByTestId('ontology-create').click();
      const form = author.getByTestId('ontology-create-form');
      await form.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
      await form
        .getByRole('textbox', { name: 'Ontology IRI', exact: true })
        .fill(`urn:${name}`);
      await form
        .getByRole('textbox', { name: 'Namespace', exact: true })
        .fill('relative/path');
      await form.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(form).toContainText('Enter a valid concept IRI.');
      await form
        .getByRole('textbox', { name: 'Namespace', exact: true })
        .fill(`urn:${name}:`);
      await form
        .getByRole('combobox', { name: 'Reviewers', exact: true })
        .fill(reviewer.responseData.name);
      await author
        .getByRole('option')
        .filter({
          hasText:
            reviewer.responseData.displayName ?? reviewer.responseData.name,
        })
        .click();
      await form
        .getByRole('combobox', { name: 'Reviewers', exact: true })
        .press('Escape');
      const created = author.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/v1/ontologies' &&
          response.request().method() === 'POST'
      );
      await form.getByRole('button', { name: 'Save', exact: true }).click();
      ontology = await okJson<Ontology>(
        await created,
        'Create ontology in Studio'
      );
      expect(ontology.reviewers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: reviewer.responseData.id,
            type: 'user',
          }),
        ])
      );
      expect(ontology.owners).toHaveLength(1);

      await author.getByTestId('mode-tab-model').click();
      await author.getByTestId('ontology-add-concept').click();
      const editor = author.getByTestId('ontology-concept-editor');
      await editor
        .getByRole('textbox', { name: 'Name', exact: true })
        .fill('Customer');
      await editor
        .getByRole('textbox', { name: 'Description', exact: true })
        .fill('Native customer definition');
      await expect(editor.getByRole('button', { name: /Type$/ })).toContainText(
        'OWL_CLASS'
      );
      const conceptCreated = author.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/v1/ontologyConcepts' &&
          response.request().method() === 'POST'
      );
      await editor.getByRole('button', { name: 'Save', exact: true }).click();
      const concept = await okJson<OntologyConcept>(
        await conceptCreated,
        'Create concept in Studio'
      );
      expect(concept.ontology.id).toBe(ontology.id);
      expect(concept.iri).toMatch(new RegExp(`^urn:${name}:`));
      await expect(
        editor.getByRole('textbox', { name: 'Concept IRI', exact: true })
      ).toHaveValue(concept.iri);
      await expect(
        editor.getByRole('textbox', { name: 'Name', exact: true })
      ).toBeDisabled();
      await editor
        .getByRole('textbox', { name: 'Display Name', exact: true })
        .fill('Customers');
      await editor
        .getByRole('button', { name: 'Add mapping', exact: true })
        .click();
      const mappingEditor = editor.getByTestId('ontology-concept-mapping');
      const mapping = {
        conceptIri: `https://example.org/${name}/Customer`,
        mappingType: 'EXACT_MATCH',
        schemeIri: `https://example.org/${name}/vocabulary`,
        source: 'External vocabulary',
      };
      await mappingEditor
        .getByRole('textbox', { name: 'Concept IRI', exact: true })
        .fill(mapping.conceptIri);
      await mappingEditor
        .getByRole('textbox', { name: 'Scheme IRI', exact: true })
        .fill(mapping.schemeIri);
      await mappingEditor
        .getByRole('textbox', { name: 'Source', exact: true })
        .fill(mapping.source);
      const edited = author.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/v1/ontologyConcepts/${concept.id}`) &&
          response.request().method() === 'PATCH'
      );
      await editor.getByRole('button', { name: 'Save', exact: true }).click();
      const updated = await okJson<OntologyConcept>(
        await edited,
        'Update concept in Studio'
      );
      expect(updated.iri).toBe(concept.iri);
      expect(updated.displayName).toBe('Customers');
      expect(updated.conceptMappings).toEqual([mapping]);
      await author.reload();
      await author.getByTestId('mode-tab-model').click();
      await author
        .getByRole('button', { name: 'Customers', exact: true })
        .click();
      await expect(
        editor.getByRole('textbox', { name: 'Description', exact: true })
      ).toHaveValue('Native customer definition');
      await expect(
        mappingEditor.getByRole('textbox', { name: 'Concept IRI', exact: true })
      ).toHaveValue(mapping.conceptIri);
      await expect(
        mappingEditor.getByRole('textbox', { name: 'Scheme IRI', exact: true })
      ).toHaveValue(mapping.schemeIri);
      await expect(
        mappingEditor.getByRole('textbox', { name: 'Source', exact: true })
      ).toHaveValue(mapping.source);
      await testInfo.attach('native-concept-mappings', {
        body: await mappingEditor.screenshot(),
        contentType: 'image/png',
      });
      await mappingEditor
        .getByRole('button', { name: 'Remove', exact: true })
        .click();
      const mappingRemoved = author.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/v1/ontologyConcepts/${concept.id}`) &&
          response.request().method() === 'PATCH'
      );
      await editor.getByRole('button', { name: 'Save', exact: true }).click();
      const withoutMapping = await okJson<OntologyConcept>(
        await mappingRemoved,
        'Remove native concept mapping'
      );
      expect(withoutMapping.conceptMappings).toEqual([]);
      expect(withoutMapping.iri).toBe(concept.iri);
      await expect(mappingEditor).toHaveCount(0);
      await author.getByTestId('ontology-model-property').click();
      await author.getByTestId('ontology-add-property').click();
      const propertyEditor = author.getByTestId('ontology-property-editor');
      await propertyEditor
        .getByRole('textbox', { name: 'Name', exact: true })
        .fill('status');
      await propertyEditor.getByRole('button', { name: /Type$/ }).click();
      await author.getByRole('option', { name: 'DATA', exact: true }).click();
      await propertyEditor
        .getByRole('textbox', { name: 'Domain classes', exact: true })
        .fill(concept.iri);
      await propertyEditor
        .getByRole('textbox', { name: 'Range', exact: true })
        .fill('http://www.w3.org/2001/XMLSchema#string');
      await propertyEditor
        .getByRole('button', { name: 'Add Value', exact: true })
        .click();
      await propertyEditor
        .getByRole('textbox', { name: 'Value', exact: true })
        .fill(' active ');
      await propertyEditor
        .getByRole('textbox', { name: 'Data Type', exact: true })
        .fill('http://www.w3.org/2001/XMLSchema#string');
      const propertyCreated = author.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/v1/ontologyProperties' &&
          response.request().method() === 'POST'
      );
      await propertyEditor
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      const property = await okJson<OntologyProperty>(
        await propertyCreated,
        'Create native data property in Studio'
      );
      expect(property.ontology.id).toBe(ontology.id);
      expect(property.kind).toBe('DATA');
      expect(property.domain).toEqual([concept.iri]);
      expect(property.enumValues).toEqual([
        {
          value: ' active ',
          datatypeIri: 'http://www.w3.org/2001/XMLSchema#string',
        },
      ]);
      await propertyEditor
        .getByRole('textbox', { name: 'Display Name', exact: true })
        .fill('Customer status');
      const propertyPatched = author.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(`/api/v1/ontologyProperties/${property.id}`) &&
          response.request().method() === 'PATCH'
      );
      await propertyEditor
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      const savedProperty = await okJson<OntologyProperty>(
        await propertyPatched,
        'Update native property in Studio'
      );
      expect(savedProperty.iri).toBe(property.iri);
      expect(savedProperty.enumValues).toEqual(property.enumValues);
      await author.reload();
      await author.getByTestId('mode-tab-model').click();
      await author.getByTestId('ontology-model-property').click();
      await author
        .getByRole('button', { name: 'Customer status', exact: true })
        .click();
      await expect(
        propertyEditor.getByRole('textbox', { name: 'Value', exact: true })
      ).toHaveValue(' active ');
      for (const permanent of [false, true]) {
        await test.step(`Delete the native property (permanent: ${permanent})`, async () => {
          await author
            .getByRole('button', { name: 'Delete', exact: true })
            .click();
          const modal = author.getByTestId('delete-modal');
          if (permanent) {
            await modal.getByTestId('hard-delete').click();
          }
          const deleted = author.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                `/api/v1/ontologyProperties/${property.id}` &&
              response.request().method() === 'DELETE'
          );
          await modal.getByTestId('confirm-button').click();
          const response = await deleted;
          expect(response.status()).toBe(200);
          expect(new URL(response.url()).searchParams.get('hardDelete')).toBe(
            String(permanent)
          );
          await expect(propertyEditor).not.toBeVisible();
          const stored = await api.get(
            `/api/v1/ontologyProperties/${property.id}?include=all`
          );
          if (permanent) {
            expect(stored.status()).toBe(404);
          } else {
            expect(
              (await okJson<OntologyProperty>(stored, 'Read deleted property'))
                .deleted
            ).toBe(true);
            await okJson<OntologyProperty>(
              await api.put('/api/v1/ontologyProperties/restore', {
                data: { id: property.id },
              }),
              'Restore property before permanent deletion'
            );
            await author.reload();
            await author.getByTestId('mode-tab-model').click();
            await author.getByTestId('ontology-model-property').click();
            await author
              .getByRole('button', { name: 'Customer status', exact: true })
              .click();
          }
        });
      }
      const parent = await okJson<OntologyConcept>(
        await api.post('/api/v1/ontologyConcepts', {
          data: {
            name: 'Party',
            ontology: ontology.fullyQualifiedName,
            conceptType: 'OWL_CLASS',
          },
        }),
        'Declare the superclass'
      );
      await author.getByTestId('ontology-model-axiom').click();
      await author.getByTestId('ontology-add-axiom').click();
      const axiom = author.getByTestId('ontology-axiom-panel');
      await axiom
        .getByRole('textbox', { name: 'Name', exact: true })
        .fill('CustomerIsParty');
      await axiom
        .getByRole('textbox', { name: 'Display Name', exact: true })
        .fill('Customer is a Party');
      await axiom
        .getByRole('textbox', { name: 'Description', exact: true })
        .fill('Customers are parties');
      await axiom
        .getByRole('textbox', { name: 'Subject', exact: true })
        .fill(concept.iri);
      await axiom
        .getByRole('textbox', { name: /^Concept IRI/ })
        .fill(parent.iri);
      await expect(axiom.getByTestId('ontology-axiom-submit')).toBeEnabled();
      const axiomCreated = author.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/v1/ontologyAxioms' &&
          response.request().method() === 'POST'
      );
      await axiom.getByTestId('ontology-axiom-submit').click();
      const hierarchy = await okJson<OntologyAxiom>(
        await axiomCreated,
        'Create the native subclass axiom'
      );
      expect(hierarchy.ontology.id).toBe(ontology.id);
      await expect(author.getByText('Saved', { exact: true })).toBeVisible();
      await author.getByTestId('mode-tab-graph').click();
      await expect(author.locator('.ontology-g6-container')).toBeVisible();
      expect(await readNodePositions(author)).toEqual(
        expect.objectContaining({
          [concept.id]: expect.any(Object),
          [parent.id]: expect.any(Object),
        })
      );
      expect(await readGraphEdges(author)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            from: concept.id,
            to: parent.id,
            relationType: 'subClassOf',
          }),
        ])
      );
      await author.getByTestId('submode-tab-tree').click();
      await expect(
        author.getByTestId(`ontology-tree-term-${concept.id}`)
      ).toBeVisible();
      await expect(
        author.getByTestId(`ontology-tree-term-${parent.id}`)
      ).toBeVisible();
      await author.screenshot({
        path: testInfo.outputPath('native-definition-authoring.png'),
        fullPage: true,
      });
    } finally {
      if (ontology) {
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true`
        );
      }
    }
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
      await page.getByTestId('mode-tab-model').click();
      await page.getByRole('button', { name: 'Customer', exact: true }).click();
      await expect(
        page
          .getByTestId('ontology-concept-editor')
          .getByRole('textbox', { name: 'Description', exact: true })
      ).toHaveValue('A customer buys products.');
      await page.getByTestId('mode-tab-releases').click();
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
