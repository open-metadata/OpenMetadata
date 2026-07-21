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

import { expect, test } from '@playwright/test';
import {
  ProjectionState,
  RDFStatus,
} from '../../../src/generated/api/rdf/rdfStatus';
import { Glossary } from '../../support/glossary/Glossary';
import { performAdminLogin } from '../../utils/admin';
import { navigateToOntologyExplorer } from '../../utils/ontologyExplorer';

const AI_API_PATH = '/api/v1/ontology/ai/';
const RDF_SPARQL_PATH = '/api/v1/rdf/sparql';
const GENERATED_QUERY =
  'SELECT ?concept WHERE { ?concept a <http://www.w3.org/2004/02/skos/core#Concept> }';
const aiGlossary = new Glossary();

const enabledStatus: RDFStatus = {
  askCollateEnabled: true,
  baseUri: 'https://open-metadata.org/',
  enabled: true,
  inference: {
    availableLevels: ['none', 'rdfs', 'owl'],
    defaultLevel: 'none',
    enabled: true,
  },
  projectionState: ProjectionState.Ready,
  storageType: 'fuseki',
};

const isRdfStatus = (value: unknown): value is RDFStatus =>
  typeof value === 'object' &&
  value !== null &&
  'askCollateEnabled' in value &&
  typeof value.askCollateEnabled === 'boolean' &&
  'baseUri' in value &&
  typeof value.baseUri === 'string' &&
  'enabled' in value &&
  typeof value.enabled === 'boolean';

test.describe('Ontology AI effective flag', { tag: ['@ontology-rdf'] }, () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await aiGlossary.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await aiGlossary.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('renders no AI affordance and sends no AI request when disabled', async ({
    browser,
  }) => {
    const { page, afterAction } = await performAdminLogin(browser);
    let aiRequestCount = 0;

    page.on('request', (request) => {
      if (request.url().includes(AI_API_PATH)) {
        aiRequestCount += 1;
      }
    });

    try {
      const statusResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/rdf/status') &&
          response.request().method() === 'GET'
      );
      await navigateToOntologyExplorer(page);
      const statusResponse = await statusResponsePromise;
      const statusBody: unknown = await statusResponse.json();

      expect(isRdfStatus(statusBody)).toBe(true);
      if (!isRdfStatus(statusBody)) {
        throw new Error('RDF status response is not valid');
      }

      expect(statusBody.askCollateEnabled).toBe(false);
      await expect(page.getByTestId('mode-tab-ai')).toBeHidden();
      await expect(page.getByTestId('ontology-explorer')).toBeVisible();
      expect(aiRequestCount).toBe(0);
    } finally {
      await afterAction();
    }
  });

  test('shows generated SPARQL before execution when enabled', async ({
    browser,
  }) => {
    const { page, afterAction } = await performAdminLogin(browser);
    let aiRequestCount = 0;
    let sparqlExecutionCount = 0;

    page.on('request', (request) => {
      if (request.url().includes(AI_API_PATH)) {
        aiRequestCount += 1;
      }
      if (request.url().includes(RDF_SPARQL_PATH)) {
        sparqlExecutionCount += 1;
      }
    });
    await page.route('**/api/v1/rdf/status**', (route) =>
      route.fulfill({ json: enabledStatus })
    );
    await page.route('**/api/v1/ontology/ai/sparql', (route) =>
      route.fulfill({
        json: {
          explanation: 'Lists concepts in the selected ontology.',
          generatedAt: Date.now(),
          modelId: 'playwright-deterministic-provider',
          query: GENERATED_QUERY,
        },
      })
    );

    try {
      await navigateToOntologyExplorer(page);
      await expect(page.getByTestId('mode-tab-ai')).toBeVisible();
      expect(aiRequestCount).toBe(0);

      await page.getByTestId('ontology-glossary-menu-trigger').click();
      await page
        .getByRole('menuitemradio')
        .filter({ hasText: aiGlossary.responseData.displayName })
        .click();
      await page.getByTestId('mode-tab-ai').click();
      await page.getByRole('tab', { name: 'Query' }).click();
      await page
        .getByRole('textbox', { name: /Question/ })
        .fill('Show every concept');
      await page.getByTestId('generate-ontology-sparql').click();

      await expect(page.getByTestId('ontology-ai-query-text')).toHaveText(
        GENERATED_QUERY
      );
      expect(aiRequestCount).toBe(1);
      expect(sparqlExecutionCount).toBe(0);

      await page.getByRole('button', { name: 'Open in Query Console' }).click();
      await expect(
        page.getByTestId('ontology-studio-query-console')
      ).toBeVisible();
      expect(sparqlExecutionCount).toBe(0);
    } finally {
      await afterAction();
    }
  });
});
