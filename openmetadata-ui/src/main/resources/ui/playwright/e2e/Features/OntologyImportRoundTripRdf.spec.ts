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

import { APIRequestContext, expect, test } from '@playwright/test';
import { OntologyImportResult } from '../../../src/generated/api/data/ontologyImportResult';
import { OntologyRdfFixture } from '../../support/ontology/OntologyRdfFixture';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';

interface SparqlAskResult {
  boolean: boolean;
}

const suffix = uuid().replaceAll('-', '');
const namespace = `https://example.com/roundtrip/${suffix}/`;
const conceptIri = `${namespace}GovernedConcept`;
const unsupportedPredicate = `${namespace}unsupportedAnnotation`;
const externalIriProjection = `?term a <http://www.w3.org/2004/02/skos/core#Concept> ; <https://open-metadata.org/ontology/iri> "${conceptIri}" .`;
const fixture = new OntologyRdfFixture(`pw_roundtrip_${suffix}`);
const isolationFixture = new OntologyRdfFixture(`pw_isolation_${suffix}`);
const ontology = `
@prefix ex: <${namespace}> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ex:GovernedConcept a skos:Concept, owl:Class ;
  skos:prefLabel "Governed Concept" ;
  ex:unsupportedAnnotation [
    ex:source "original-playwright-corpus" ;
    ex:rank 7
  ] .

ex:RelatedConcept a skos:Concept ;
  skos:prefLabel "Related Concept" ;
  skos:broader ex:GovernedConcept .
`;

const isImportResult = (value: unknown): value is OntologyImportResult =>
  typeof value === 'object' &&
  value !== null &&
  'annexRevisions' in value &&
  Array.isArray(value.annexRevisions) &&
  'termsCreated' in value &&
  typeof value.termsCreated === 'number';

const isSparqlAskResult = (value: unknown): value is SparqlAskResult =>
  typeof value === 'object' &&
  value !== null &&
  'boolean' in value &&
  typeof value.boolean === 'boolean';

const importOntology = async (
  apiContext: APIRequestContext
): Promise<OntologyImportResult> => {
  const glossaryName = encodeURIComponent(fixture.glossary.responseData.name);
  const response = await apiContext.put(
    `/api/v1/glossaries/name/${glossaryName}/importRdf?format=turtle&dryRun=false`,
    {
      data: ontology,
      headers: { 'Content-Type': 'text/turtle' },
    }
  );
  const body: unknown = response.ok() ? await response.json() : undefined;

  expect(response.ok(), await response.text()).toBe(true);
  expect(isImportResult(body)).toBe(true);
  if (!isImportResult(body)) {
    throw new Error('Ontology import response is invalid');
  }

  return body;
};

const exportOntology = async (
  apiContext: APIRequestContext,
  format: 'jsonld' | 'rdfxml' | 'turtle'
): Promise<string> => {
  const response = await apiContext.get(
    `/api/v1/glossaries/${fixture.glossary.responseData.id}/exportOntology?format=${format}`
  );

  expect(response.ok(), await response.text()).toBe(true);

  return response.text();
};

test.describe(
  'Ontology import fidelity and isolation',
  { tag: ['@ontology-rdf'] },
  () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await fixture.create(apiContext);
        await isolationFixture.create(apiContext);
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await fixture.delete(apiContext);
        await isolationFixture.delete(apiContext);
      } finally {
        await afterAction();
      }
    });

    test('preserves unsupported annex statements across an idempotent re-import', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const firstImport = await importOntology(apiContext);
        const firstTurtle = await exportOntology(apiContext, 'turtle');
        const secondImport = await importOntology(apiContext);
        const secondTurtle = await exportOntology(apiContext, 'turtle');

        expect(firstImport.termsCreated).toBe(2);
        expect(firstImport.annexRevisions).toHaveLength(1);
        expect(firstImport.annexRevisions[0].canonicalNQuads).toContain(
          unsupportedPredicate
        );
        expect(secondImport.termsCreated).toBe(0);
        expect(secondImport.termsUpdated).toBeGreaterThanOrEqual(0);
        expect(firstTurtle).toContain(unsupportedPredicate);
        expect(secondTurtle).toContain(unsupportedPredicate);
        expect(secondTurtle.match(/original-playwright-corpus/g)).toHaveLength(
          1
        );
      } finally {
        await afterAction();
      }
    });

    test('exports the governed and annex union in all supported semantic formats', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const [turtle, jsonLd, rdfXml] = await Promise.all([
          exportOntology(apiContext, 'turtle'),
          exportOntology(apiContext, 'jsonld'),
          exportOntology(apiContext, 'rdfxml'),
        ]);

        expect(turtle).toContain(conceptIri);
        expect(turtle).toContain(unsupportedPredicate);
        expect(jsonLd).toContain(conceptIri);
        expect(jsonLd).toContain(unsupportedPredicate);
        expect(rdfXml).toContain('rdf:RDF');
        expect(rdfXml).toContain('unsupportedAnnotation');
      } finally {
        await afterAction();
      }
    });

    test('projects the import while keeping the database-scoped model isolated', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await expect
          .poll(
            async () => {
              const response = await apiContext.post('/api/v1/rdf/sparql', {
                data: {
                  query: `ASK { GRAPH ?graph { ${externalIriProjection} } }`,
                },
              });
              const body: unknown = response.ok()
                ? await response.json()
                : undefined;

              return isSparqlAskResult(body) && body.boolean;
            },
            { timeout: 45_000 }
          )
          .toBe(true);

        const scopedResponse = await apiContext.post(
          `/api/v1/glossaries/${isolationFixture.glossary.responseData.id}/sparql`,
          {
            data: {
              query: `ASK { ${externalIriProjection} }`,
            },
          }
        );
        const scopedBody: unknown = scopedResponse.ok()
          ? await scopedResponse.json()
          : undefined;

        expect(scopedResponse.ok()).toBe(true);
        expect(isSparqlAskResult(scopedBody) && scopedBody.boolean).toBe(false);
      } finally {
        await afterAction();
      }
    });
  }
);
