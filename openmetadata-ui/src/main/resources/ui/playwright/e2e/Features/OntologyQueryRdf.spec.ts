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

import { APIRequestContext, expect, Page, test } from '@playwright/test';
import {
  SavedSparqlQueries,
  SavedSparqlQuery,
} from '../../../src/generated/api/rdf/savedSparqlQueries';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { OntologyRdfFixture } from '../../support/ontology/OntologyRdfFixture';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import {
  navigateToOntologyExplorer,
  readGraphEdges,
} from '../../utils/ontologyExplorer';

interface SparqlAskResult {
  boolean: boolean;
}

interface CodeMirrorElement extends HTMLElement {
  CodeMirror?: {
    setValue: (value: string) => void;
  };
}

const suffix = uuid().replaceAll('-', '');
const fixture = new OntologyRdfFixture(`pw_query_${suffix}`);
const foreignFixture = new OntologyRdfFixture(`pw_query_foreign_${suffix}`);
const savedQueryName = `Scoped ontology query ${suffix}`;
let source: GlossaryTerm;
let target: GlossaryTerm;
let foreignTerm: GlossaryTerm;

const isSparqlAskResult = (value: unknown): value is SparqlAskResult =>
  typeof value === 'object' &&
  value !== null &&
  'boolean' in value &&
  typeof value.boolean === 'boolean';

const isSavedSparqlQuery = (value: unknown): value is SavedSparqlQuery =>
  typeof value === 'object' &&
  value !== null &&
  'format' in value &&
  typeof value.format === 'string' &&
  'id' in value &&
  typeof value.id === 'string' &&
  'inference' in value &&
  typeof value.inference === 'string' &&
  'name' in value &&
  typeof value.name === 'string' &&
  'query' in value &&
  typeof value.query === 'string' &&
  'savedAt' in value &&
  typeof value.savedAt === 'number';

const isSavedSparqlQueries = (value: unknown): value is SavedSparqlQueries =>
  typeof value === 'object' &&
  value !== null &&
  'queries' in value &&
  Array.isArray(value.queries) &&
  value.queries.every(isSavedSparqlQuery);

async function removeSavedQuery(apiContext: APIRequestContext): Promise<void> {
  const libraryResponse = await apiContext.get('/api/v1/rdf/queries/saved');
  const library: unknown = libraryResponse.ok()
    ? await libraryResponse.json()
    : undefined;

  expect(libraryResponse.ok(), await libraryResponse.text()).toBe(true);
  expect(isSavedSparqlQueries(library)).toBe(true);
  if (!isSavedSparqlQueries(library)) {
    throw new Error('Saved SPARQL query library response is invalid');
  }

  const replaceResponse = await apiContext.put('/api/v1/rdf/queries/saved', {
    data: {
      queries: library.queries.filter((query) => query.name !== savedQueryName),
    },
  });
  expect(replaceResponse.ok(), await replaceResponse.text()).toBe(true);
}

async function setSparqlEditorValue(page: Page, query: string): Promise<void> {
  await page
    .getByTestId('ontology-sparql-editor')
    .locator('.CodeMirror')
    .evaluate((element, value) => {
      const codeMirrorElement = element as CodeMirrorElement;
      if (!codeMirrorElement.CodeMirror) {
        throw new Error('SPARQL CodeMirror instance is unavailable');
      }
      codeMirrorElement.CodeMirror.setValue(value);
    }, query);
}

test.describe('Ontology scoped query mode', { tag: ['@ontology-rdf'] }, () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await fixture.create(apiContext);
      source = await fixture.createTerm(apiContext, `QuerySource${suffix}`);
      target = await fixture.createTerm(apiContext, `QueryTarget${suffix}`);
      await fixture.addRelation(apiContext, {
        relationType: 'relatedTo',
        source,
        target,
      });
      await fixture.expectRelationProjected(
        apiContext,
        source,
        'https://open-metadata.org/ontology/relatedTo',
        target
      );
      await foreignFixture.create(apiContext);
      foreignTerm = await foreignFixture.createTerm(
        apiContext,
        `ForeignTerm${suffix}`
      );
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await removeSavedQuery(apiContext);
      await fixture.delete(apiContext);
      await foreignFixture.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('runs and persists a glossary-scoped query from the Studio rail', async ({
    browser,
  }) => {
    const { page, afterAction } = await performAdminLogin(browser);

    try {
      await navigateToOntologyExplorer(page);
      await fixture.selectInStudio(page);
      await page.getByTestId('mode-tab-query').click();
      await expect(
        page.getByTestId('ontology-studio-query-console')
      ).toBeVisible();

      const queryResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/v1/glossaries/${fixture.glossary.responseData.id}/sparql`
            ) && response.request().method() === 'POST'
      );
      await page
        .locator('[data-testid^="ontology-query-suggestion-"]')
        .first()
        .click();
      const queryResponse = await queryResponsePromise;

      expect(queryResponse.ok(), await queryResponse.text()).toBe(true);
      await expect(page.getByTestId('ontology-sparql-result')).toContainText(
        source.responseData.fullyQualifiedName
      );

      await page.getByTestId('ontology-query-save').click();
      await page.getByTestId('ontology-query-save-name').fill(savedQueryName);
      const saveResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/rdf/queries/saved') &&
          response.request().method() === 'PUT'
      );
      await page
        .getByTestId('ontology-query-save-modal')
        .getByRole('button', { name: 'Save', exact: true })
        .click();

      expect((await saveResponsePromise).ok()).toBe(true);
      await expect(page.getByTestId('ontology-query-saved-list')).toContainText(
        savedQueryName
      );
    } finally {
      await afterAction();
    }
  });

  test('keeps the visual builder equivalent to the scoped SPARQL endpoint', async ({
    browser,
  }) => {
    const { page, afterAction } = await performAdminLogin(browser);

    try {
      await navigateToOntologyExplorer(page);
      await fixture.selectInStudio(page);
      await page.getByTestId('mode-tab-query').click();
      await page.getByTestId('submode-tab-builder').click();
      await expect(
        page.getByTestId('ontology-visual-query-builder')
      ).toBeVisible();

      await page.getByTestId('ontology-builder-relation').click();
      await page.getByRole('option', { name: 'Related To' }).click();
      await page.getByTestId('ontology-builder-target').click();
      await page
        .getByRole('option', { name: target.responseData.displayName })
        .click();
      await expect(page.getByTestId('ontology-generated-sparql')).toContainText(
        target.responseData.fullyQualifiedName
      );

      const queryResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/v1/glossaries/${fixture.glossary.responseData.id}/sparql`
            ) && response.request().method() === 'POST'
      );
      await page.getByTestId('ontology-builder-run').click();
      const queryResponse = await queryResponsePromise;

      expect(queryResponse.ok(), await queryResponse.text()).toBe(true);
      await expect(page.getByTestId('ontology-builder-result')).toContainText(
        '1'
      );
    } finally {
      await afterAction();
    }
  });

  test('renders triple-shaped scoped results as a read-only subgraph', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await fixture.expectRelationProjected(
        apiContext,
        source,
        'https://open-metadata.org/ontology/relatedTo',
        target
      );
      const sourceIri = await fixture.termIri(apiContext, source);
      const targetIri = await fixture.termIri(apiContext, target);
      const predicateIri = 'https://open-metadata.org/ontology/relatedTo';
      const query = `SELECT ?source ?predicate ?target WHERE {
  ?source <${predicateIri}> ?target .
  BIND(<${predicateIri}> AS ?predicate)
}`;

      await navigateToOntologyExplorer(page);
      await fixture.selectInStudio(page);
      await page.getByTestId('mode-tab-query').click();
      await page.getByTestId('ontology-query-new').click();
      await setSparqlEditorValue(page, query);

      const responsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/v1/glossaries/${fixture.glossary.responseData.id}/sparql`
            ) && response.request().method() === 'POST'
      );
      await page.getByTestId('ontology-sparql-run').click();
      expect((await responsePromise).ok()).toBe(true);
      await page.getByRole('tab', { name: 'Graph' }).click();
      await expect(
        page.getByTestId('ontology-sparql-result-graph')
      ).toBeVisible();

      const edges = await readGraphEdges(page);
      expect(edges).toContainEqual(
        expect.objectContaining({
          from: sourceIri,
          relationType: predicateIri,
          to: targetIri,
        })
      );
    } finally {
      await afterAction();
    }
  });

  test('rejects caller-selected datasets and never leaks a second glossary', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      const scopedResponse = await apiContext.post(
        `/api/v1/glossaries/${fixture.glossary.responseData.id}/sparql`,
        {
          data: {
            query: 'SELECT ?subject WHERE { ?subject ?predicate ?object }',
          },
        }
      );
      const scopedBody = await scopedResponse.text();

      expect(scopedResponse.ok()).toBe(true);
      expect(scopedBody).toContain(source.responseData.id);
      expect(scopedBody).not.toContain(foreignTerm.responseData.id);

      const forbiddenDatasetResponse = await apiContext.post(
        `/api/v1/glossaries/${fixture.glossary.responseData.id}/sparql`,
        {
          data: {
            query:
              'SELECT ?subject FROM <https://example.com/foreign> WHERE { ?subject ?predicate ?object }',
          },
        }
      );
      expect(forbiddenDatasetResponse.status()).toBe(400);
    } finally {
      await afterAction();
    }
  });

  test('reserves the full knowledge graph endpoint for administrators', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await foreignFixture.expectProjected(apiContext, foreignTerm);
      const foreignIri = await foreignFixture.termIri(apiContext, foreignTerm);
      const response = await apiContext.post('/api/v1/rdf/sparql', {
        data: {
          query: `ASK { GRAPH ?graph { <${foreignIri}> ?predicate ?object } }`,
        },
      });
      const body: unknown = response.ok() ? await response.json() : undefined;

      expect(response.ok()).toBe(true);
      expect(isSparqlAskResult(body) && body.boolean).toBe(true);
    } finally {
      await afterAction();
    }
  });
});
