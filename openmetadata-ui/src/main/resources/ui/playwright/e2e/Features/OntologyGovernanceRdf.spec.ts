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

import { OntologyImportResult } from '../../../src/generated/api/data/ontologyImportResult';
import { expect, test } from '../../support/fixtures/base';
import { Glossary } from '../../support/glossary/Glossary';
import { performAdminLogin } from '../../utils/admin';

const bulkGlossary = new Glossary();

const INVALID_SHACL_ONTOLOGY = `
@prefix om: <https://open-metadata.org/ontology/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<https://example.com/ontology/BrokenTerm>
  a om:GlossaryTerm ;
  rdfs:label "Broken term" ;
  om:fullyQualifiedName "Broken.Term" .
`;

const isImportResult = (value: unknown): value is OntologyImportResult =>
  typeof value === 'object' &&
  value !== null &&
  'validationReport' in value &&
  typeof value.validationReport === 'object' &&
  value.validationReport !== null &&
  'termsCreated' in value &&
  typeof value.termsCreated === 'number';

test.describe('Ontology governance', { tag: ['@ontology-rdf'] }, () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await bulkGlossary.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await bulkGlossary.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('reports bounded SHACL violations during an RDF import dry run', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const glossaryName = encodeURIComponent(bulkGlossary.responseData.name);

    try {
      const response = await apiContext.put(
        `/api/v1/glossaries/name/${glossaryName}/importRdf?format=turtle&dryRun=true`,
        {
          data: INVALID_SHACL_ONTOLOGY,
          headers: { 'Content-Type': 'text/turtle' },
        }
      );
      const body: unknown = response.ok() ? await response.json() : undefined;

      expect(response.ok(), await response.text()).toBe(true);
      expect(isImportResult(body)).toBe(true);
      if (!isImportResult(body)) {
        throw new Error('Ontology SHACL dry-run response is invalid');
      }

      expect(body.dryRun).toBe(true);
      expect(body.validationReport.performed).toBe(true);
      expect(body.validationReport.conforms).toBe(false);
      expect(body.validationReport.violationCount).toBeGreaterThan(0);
      expect(body.validationReport.violations.length).toBeGreaterThan(0);
    } finally {
      await afterAction();
    }
  });

  test('rejects ontology configuration on a glossary', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      const response = await apiContext.patch(
        `/api/v1/glossaries/${bulkGlossary.responseData.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/ontologyConfiguration',
              value: { layer: 'L3' },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );
      expect(response.status(), await response.text()).toBe(400);
      const glossary = await apiContext.get(
        `/api/v1/glossaries/${bulkGlossary.responseData.id}`
      );
      expect(glossary.ok(), await glossary.text()).toBe(true);
      expect(await glossary.json()).not.toHaveProperty('ontologyConfiguration');
    } finally {
      await afterAction();
    }
  });
});
