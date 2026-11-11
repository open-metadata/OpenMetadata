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
import { promises as fs } from 'node:fs';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { Task } from '../../../src/generated/entity/tasks/task';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { UserClass } from '../../support/user/UserClass';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { fillCodeEditor } from '../../utils/codeEditor';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';
import { findOntologyInQueryPicker } from '../../utils/ontologyStudio';
import { disableAiAppMode, enableAiAppMode } from '../Utils/appMode';

test.use({ isolatedUserOptions: { isAdmin: true } });

const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const PUBLISHED_CONCEPT = 'Publishedconcept';
const DRAFT_CONCEPT = 'Draftonlyconcept';

const labelQuery = (label: string) =>
  `SELECT ?c WHERE { ?c <${RDFS_LABEL}> "${label}" }`;

interface QueryFixture {
  ontology: Ontology;
  releaseVersion: string | undefined;
  tasks: string[];
}

const createConcept = async (
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
      },
    }),
    `Create concept ${name}`
  );

const approveAndActivate = async (
  api: APIRequestContext,
  reviewerPage: Page,
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
  await reviewerPage.goto(`/tasks/${task.id}`);
  const approved = reviewerPage.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/tasks/${task.id}/resolve` &&
      response.request().method() === 'POST'
  );
  await reviewerPage.getByTestId('task-approve').click();
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

/** Publishes one concept, then adds a second that only the working draft has. */
const publishWithDraftOnlyConcept = async (
  api: APIRequestContext,
  reviewerPage: Page,
  reviewer: UserClass
): Promise<QueryFixture> => {
  const tasks: string[] = [];
  const name = `pw_query_scope_${uuid().replaceAll('-', '')}`;
  const ontology = await okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: {
        name,
        iri: `https://example.org/${name}`,
        namespace: `https://example.org/${name}#`,
        reviewers: [{ id: reviewer.responseData.id, type: 'user' }],
      },
    }),
    'Create query-scope ontology'
  );
  await createConcept(api, ontology, PUBLISHED_CONCEPT);
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
  await createConcept(api, ontology, DRAFT_CONCEPT);
  const active = await okJson<OntologyRelease>(
    await api.get(`/api/v1/ontologyReleases/${release.id}`),
    'Read the active release'
  );

  return { ontology, releaseVersion: active.semanticVersion, tasks };
};

const cleanUp = async (api: APIRequestContext, fixture: QueryFixture) => {
  for (const id of fixture.tasks) {
    await deleteFixtureEntity(api, `/api/v1/tasks/${id}?hardDelete=true`);
  }
  await deleteFixtureEntity(
    api,
    `/api/v1/ontologies/${fixture.ontology.id}?recursive=true`
  );
};

const releaseScope = (fixture: QueryFixture) =>
  `${fixture.ontology.name} · ${
    fixture.releaseVersion ? `v${fixture.releaseVersion}` : 'published'
  }`;

const draftScope = (fixture: QueryFixture) =>
  `${fixture.ontology.name} · draft`;

const queryUrl = (ontology: Ontology, params = '') =>
  `/governance/ontology?ontology=${ontology.id}&mode=query${params}`;

const runQuery = async (page: Page, query: string) => {
  await fillCodeEditor(page, page.getByTestId('ontology-sparql-editor'), query);
  await page.getByTestId('ontology-sparql-run').click();
};

const openConsumerPage = async (browser: Browser, api: APIRequestContext) => {
  const consumer = new UserClass();
  await consumer.create(api);
  const context = await browser.newContext();
  const page = await context.newPage();
  await consumer.signIn(page);

  return {
    page,
    dispose: async () => {
      await context.close();
      await consumer.delete(api);
    },
  };
};

const tableText = async (page: Page) => {
  const rows = page.locator('[data-testid="ontology-sparql-result-table"] tr');
  const lines: string[][] = [];
  for (const row of await rows.all()) {
    lines.push(
      (await row.locator('th, td').allInnerTexts()).map((cell) => cell.trim())
    );
  }

  return lines;
};

test.describe(
  'Ontology Studio query scope and results',
  { tag: ['@Features', '@Governance'] },
  () => {
    let fixture: QueryFixture;
    let api: APIRequestContext;

    test.beforeAll(async ({ browser, isolatedUser }) => {
      test.setTimeout(180_000);
      api = await getWorkerAdminAPIContext();
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await isolatedUser.signIn(page);
        fixture = await publishWithDraftOnlyConcept(api, page, isolatedUser);
      } finally {
        await context.close();
      }
    });

    test.afterAll(async () => {
      if (fixture) {
        await cleanUp(api, fixture);
      }
    });

    for (const appMode of ['ai', 'classic'] as const) {
      test(`an editor queries the draft by default and the published release on request in ${appMode} mode`, async ({
        isolatedUserPage: page,
      }) => {
        await (appMode === 'ai'
          ? enableAiAppMode(page)
          : disableAiAppMode(page));
        await page.goto(queryUrl(fixture.ontology));
        await expect(page.getByTestId('ontology-query-scope')).toHaveText(
          draftScope(fixture)
        );

        await runQuery(page, labelQuery(DRAFT_CONCEPT));

        await expect(
          page.getByTestId('ontology-sparql-result-status')
        ).toContainText('1 row');
        await expect(
          page.getByTestId('ontology-sparql-result-scope')
        ).toHaveText(draftScope(fixture));
        await page.screenshot({
          path: `test-results/g16-scope-${appMode}.png`,
        });

        await page.getByTestId('ontology-version-published').click();
        await expect(page).toHaveURL(/version=published/);
        await expect(page.getByTestId('ontology-query-scope')).toHaveText(
          releaseScope(fixture)
        );

        await runQuery(page, labelQuery(DRAFT_CONCEPT));

        await expect(page.getByTestId('ontology-sparql-no-rows')).toBeVisible();
        await expect(
          page.getByTestId('ontology-sparql-result-scope')
        ).toHaveText(releaseScope(fixture));

        await runQuery(page, labelQuery(PUBLISHED_CONCEPT));

        await expect(
          page.getByTestId('ontology-sparql-result-status')
        ).toContainText('1 row');
        if (appMode === 'ai') {
          await page.screenshot({ path: 'test-results/g16-scope-release.png' });
        }
      });
    }

    test('a user without edit rights is offered only the published scope, and a SERVICE clause shows no configuration key', async ({
      browser,
      isolatedUserPage: adminPage,
    }) => {
      const reader = await openConsumerPage(browser, api);
      try {
        await reader.page.goto(queryUrl(fixture.ontology));
        await expect(
          reader.page.getByTestId('ontology-query-scope')
        ).toHaveText(releaseScope(fixture));
        await expect(
          reader.page.getByTestId('ontology-version-switch')
        ).toHaveCount(0);

        await runQuery(reader.page, labelQuery(DRAFT_CONCEPT));

        await expect(
          reader.page.getByTestId('ontology-sparql-no-rows')
        ).toBeVisible();
        await reader.page.screenshot({ path: 'test-results/g16-consumer.png' });

        const service =
          'SELECT * WHERE { SERVICE <http://localhost:9999/> { ?s ?p ?o } }';
        await runQuery(reader.page, service);

        await expect(
          reader.page.getByTestId('ontology-sparql-error-title')
        ).toHaveText("A query can't reach outside the ontology");
        await expect(
          reader.page.getByTestId('ontology-sparql-error')
        ).not.toContainText('rdf.federation');
        await reader.page.screenshot({ path: 'test-results/g16-service.png' });

        await adminPage.goto(queryUrl(fixture.ontology));
        await runQuery(adminPage, service);

        await expect(
          adminPage.getByTestId('ontology-sparql-error-hint')
        ).toContainText('rdf.federation');
      } finally {
        await reader.dispose();
      }
    });

    test('a query with a syntax error shows a title and a hint, and leaves no toast behind', async ({
      isolatedUserPage: page,
    }) => {
      await page.goto(queryUrl(fixture.ontology));

      await runQuery(page, 'SELECT ( 1');

      await expect(page.getByTestId('ontology-sparql-error-title')).toHaveText(
        "The query isn't valid SPARQL"
      );
      await expect(
        page.getByTestId('ontology-sparql-error-hint')
      ).toContainText(/line \d+/);
      await expect(page.getByTestId('ontology-sparql-error')).not.toContainText(
        '"code"'
      );
      await expect(page.getByTestId('alert-bar')).toHaveCount(0);
      await page.screenshot({ path: 'test-results/g16-error.png' });
    });

    test('ASK shows true or false and CONSTRUCT shows its graph as Turtle', async ({
      isolatedUserPage: page,
    }) => {
      await page.goto(queryUrl(fixture.ontology));

      await runQuery(page, 'ASK { ?s ?p ?o }');

      await expect(page.getByTestId('ontology-sparql-ask')).toHaveText('true');

      await runQuery(page, 'ASK { ?s <urn:g16:absent> ?o }');

      await expect(page.getByTestId('ontology-sparql-ask')).toHaveText('false');

      await runQuery(page, 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 5');

      await expect(
        page.getByTestId('ontology-sparql-graph-text')
      ).toContainText(/PREFIX\s+owl:/);
      await expect(page.getByTestId('ontology-sparql-csv')).toHaveCount(0);
      await page.screenshot({ path: 'test-results/g16-kinds.png' });
    });

    test('Copy and CSV hand over exactly the rows the table shows', async ({
      isolatedUserPage: page,
    }) => {
      await page
        .context()
        .grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto(queryUrl(fixture.ontology, '&version=published'));

      await runQuery(
        page,
        `SELECT ?c ?label WHERE { ?c <${RDFS_LABEL}> ?label } ORDER BY ?label`
      );
      await expect(
        page.getByTestId('ontology-sparql-result-table')
      ).toBeVisible();
      const shown = await tableText(page);

      expect(shown.length).toBeGreaterThan(1);
      const rowCount = shown.length - 1;
      await expect(
        page.getByTestId('ontology-sparql-result-status')
      ).toContainText(`${rowCount} row`);

      await page.getByTestId('ontology-sparql-copy').click();
      await expect(page.getByTestId('ontology-sparql-copy')).toHaveText(
        'Copied'
      );
      const copied = await page.evaluate(() => navigator.clipboard.readText());

      // The table adds a "#" column and shows variables as "?name"; exports carry neither.
      const exported = shown.map((cells, row) =>
        cells
          .slice(1)
          .map((cell) => (row === 0 ? cell.replace(/^\?/, '') : cell))
      );

      expect(copied).toBe(
        exported.map((cells) => cells.join('\t')).join('\n')
      );

      const download = page.waitForEvent('download');
      await page.getByTestId('ontology-sparql-csv').click();
      const file = await download;
      const csv = (
        await fs.readFile((await file.path()) ?? '', 'utf-8')
      ).replace(/^\ufeff/, '');

      expect(file.suggestedFilename()).toMatch(/\.csv$/);
      expect(csv).toBe(exported.map((cells) => cells.join(',')).join('\n'));
      await page.screenshot({ path: 'test-results/g16-csv.png' });
    });

    test('Query on All ontologies explains the choice and lists each ontology with its counts', async ({
      isolatedUserPage: page,
    }) => {
      await page.goto('/governance/ontology?scope=ontology:all&mode=query');

      await expect(page.getByTestId('ontology-query-picker-title')).toHaveText(
        'Choose an ontology to query'
      );
      await expect(
        page.getByTestId('ontology-query-picker-description')
      ).toContainText('one ontology at a time');
      const option = await findOntologyInQueryPicker(page, fixture.ontology);
      await expect(option).toContainText('2 concepts · 0 properties', {
        timeout: 30_000,
      });
      await page.screenshot({ path: 'test-results/g16-all.png' });

      await option.click();

      await expect(page.getByTestId('ontology-query-scope')).toHaveText(
        draftScope(fixture)
      );
    });

    test('a saved query can be found, duplicated and deleted, and each change survives a reload', async ({
      isolatedUserPage: page,
    }) => {
      const suffix = uuid().replaceAll('-', '').slice(0, 8);
      const name = `Scoped lookup ${suffix}`;
      await page.goto(queryUrl(fixture.ontology));

      await fillCodeEditor(
        page,
        page.getByTestId('ontology-sparql-editor'),
        labelQuery(PUBLISHED_CONCEPT)
      );
      await page.getByTestId('ontology-query-more').click();
      await page.getByTestId('ontology-query-save').click();
      await page.getByTestId('ontology-query-save-name').fill(name);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      const saved = page.getByTestId('ontology-query-saved-list');
      await expect(saved).toContainText(name);

      await page.reload();
      await page.getByTestId('ontology-query-find').fill(suffix);

      await expect(
        page.locator('[data-testid^="ontology-query-saved-duplicate-"]')
      ).toHaveCount(1, { timeout: 20_000 });
      await page.getByTestId('ontology-query-find').fill('no such query');
      await expect(saved).toHaveCount(0);
      await page.getByTestId('ontology-query-find').fill(suffix);

      await page
        .getByRole('button', { name: `Duplicate ${name}`, exact: true })
        .click();
      await expect(saved).toContainText(`${name} copy`);

      await page.reload();
      await page.getByTestId('ontology-query-find').fill(suffix);

      await expect(saved).toContainText(`${name} copy`);
      await page.screenshot({ path: 'test-results/g16-saved.png' });

      await page
        .getByRole('button', { name: `Delete ${name} copy`, exact: true })
        .click();
      await expect(saved).not.toContainText(`${name} copy`);

      await page.reload();
      await page.getByTestId('ontology-query-find').fill(suffix);

      await expect(saved).toContainText(name);
      await expect(saved).not.toContainText(`${name} copy`);

      await page
        .getByRole('button', { name: `Delete ${name}`, exact: true })
        .click();
      await expect(saved).toHaveCount(0);
    });

    for (const appMode of ['ai', 'classic'] as const) {
      test(`the builder generates SPARQL for a relation, shows exactly that text, and runs it to the expected rows in ${appMode} mode`, async ({
        isolatedUserPage: page,
      }) => {
        test.setTimeout(120_000);
        const builderApi = await getWorkerAdminAPIContext();
        const name = `pw_query_builder_${uuid().replaceAll('-', '')}`;
        const ontology = await okJson<Ontology>(
          await builderApi.post('/api/v1/ontologies', {
            data: {
              name,
              iri: `https://example.org/${name}`,
              namespace: `https://example.org/${name}#`,
            },
          }),
          'Create builder ontology'
        );
        try {
          const animal = await createConcept(
            builderApi,
            ontology,
            'Animalroot'
          );
          for (const child of ['Dogchild', 'Catchild']) {
            const concept = await createConcept(builderApi, ontology, child);
            await okJson(
              await builderApi.post('/api/v1/ontologyAxioms', {
                data: {
                  name: `${child}Is${animal.name}`,
                  displayName: `${child} is an animal`,
                  description: `${child} is an animal`,
                  ontology: ontology.fullyQualifiedName,
                  axiomType: 'SUBCLASS_OF',
                  subjectIri: concept.iri,
                  expressions: [{ kind: 'NAMED_CLASS', classIri: animal.iri }],
                  provenance: 'Manual',
                },
              }),
              `Relate ${child}`
            );
          }
          await (appMode === 'ai'
            ? enableAiAppMode(page)
            : disableAiAppMode(page));
          await page.goto(queryUrl(ontology, '&view=builder'));
          await expect(
            page.getByTestId('ontology-visual-query-builder')
          ).toBeVisible();
          const generated = page.getByTestId('ontology-generated-sparql');

          await expect(generated).toContainText(
            `VALUES ?target { <${animal.iri}> }`
          );
          await expect(generated).toContainText(
            '?concept rdfs:subClassOf ?target .'
          );
          const shownSparql = (await generated.innerText()).trim();

          const request = page.waitForRequest(
            (candidate) =>
              candidate
                .url()
                .includes(`/api/v1/ontologies/${ontology.id}/sparql`) &&
              candidate.method() === 'POST'
          );
          await page.getByTestId('ontology-builder-run').click();
          const sent = (await request).postDataJSON() as { query: string };

          expect(sent.query.trim()).toBe(shownSparql);
          await expect(
            page.getByTestId('ontology-sparql-result-status')
          ).toContainText('2 rows');
          const rows = (await tableText(page))
            .slice(1)
            .map((cells) => cells.join(' '));

          expect(rows).toHaveLength(2);
          expect(rows.join(' ')).toContain('Dogchild');
          expect(rows.join(' ')).toContain('Catchild');
          expect(rows.join(' ')).not.toContain('Animalroot');
          await page.screenshot({
            path: `test-results/g16-builder-${appMode}.png`,
          });
        } finally {
          await deleteFixtureEntity(
            builderApi,
            `/api/v1/ontologies/${ontology.id}?recursive=true&hardDelete=true`
          );
        }
      });
    }

    test('the builder shows its SPARQL beside the results, hides it on request and brings it back', async ({
      isolatedUserPage: page,
    }) => {
      await page.goto(queryUrl(fixture.ontology, '&view=builder'));
      await expect(
        page.getByTestId('ontology-visual-query-builder')
      ).toBeVisible();
      const toggle = page.getByTestId('ontology-builder-toggle-sparql');
      const generated = page.getByTestId('ontology-generated-sparql');

      await expect(generated).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-label', 'Hide SPARQL');
      await page.screenshot({ path: 'test-results/g16-builder.png' });

      await toggle.click();

      await expect(generated).toHaveCount(0);
      await expect(toggle).toHaveText('Show SPARQL');

      await toggle.click();

      await expect(generated).toBeVisible();
    });
  }
);
