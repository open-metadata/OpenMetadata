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

import { APIRequestContext } from '@playwright/test';
import { expect, test } from '../../support/fixtures/base';
import { Glossary } from '../../support/glossary/Glossary';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';

const suffix = uuid().replaceAll('-', '');
const NS = `http://example.com/ontology/fidelity/${suffix}#`;

/**
 * AlphaParent wins the structural parent slot because it sorts first, so ZuluParent is demoted to a
 * typed relation. The demotion must keep the predicate the source asserted: rdfs:subClassOf carries
 * subsumption, skos:broader does not, and collapsing the two loses an OWL axiom.
 */
const POLYHIERARCHY_ONTOLOGY = `@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix ex:   <${NS}> .

ex:AlphaParent a owl:Class ;
    skos:prefLabel "Alpha Parent" .

ex:ZuluParent a owl:Class ;
    skos:prefLabel "Zulu Parent" .

ex:Child a owl:Class ;
    skos:prefLabel "Child" ;
    rdfs:subClassOf ex:AlphaParent, ex:ZuluParent .
`;

/**
 * A pure SKOS thesaurus must not gain owl:Class typing on the way back out, and a pure OWL ontology
 * must not gain skos:Concept typing.
 */
/**
 * Three asserted parents, two via rdfs:subClassOf and one via skos:broader. AlphaP wins the
 * structural slot; the other two must each keep the predicate they were asserted with.
 */
const MIXED_ONTOLOGY = `@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix ex:   <${NS}> .

ex:AlphaP a owl:Class ; skos:prefLabel "Alpha P" .
ex:MidP a owl:Class ; skos:prefLabel "Mid P" .
ex:ZuluP a owl:Class ; skos:prefLabel "Zulu P" .
ex:Triple a owl:Class ;
    skos:prefLabel "Triple" ;
    rdfs:subClassOf ex:AlphaP, ex:MidP ;
    skos:broader ex:ZuluP .
`;

const VOCABULARY_ONTOLOGY = `@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix ex:   <${NS}> .

ex:PureConcept a skos:Concept ;
    skos:prefLabel "Pure Concept" .

ex:PureClass a owl:Class ;
    skos:prefLabel "Pure Class" .
`;

const importOntology = async (
  apiContext: APIRequestContext,
  glossary: Glossary,
  turtle: string
) => {
  // The endpoint dry-runs by default, which validates without persisting anything.
  const response = await apiContext.put(
    `/api/v1/glossaries/name/${encodeURIComponent(
      glossary.responseData.name
    )}/importRdf?format=turtle&dryRun=false`,
    {
      data: turtle,
      headers: { 'Content-Type': 'text/turtle' },
    }
  );

  expect(response.ok(), await response.text()).toBe(true);

  return response.json();
};

const findTermByIri = async (
  apiContext: APIRequestContext,
  glossary: Glossary,
  localName: string,
  fields: string
) => {
  const listResponse = await apiContext.get(
    `/api/v1/glossaryTerms?glossary=${glossary.responseData.id}&fields=${fields}&limit=100`
  );

  expect(listResponse.ok(), await listResponse.text()).toBe(true);

  const body = await listResponse.json();
  const term = (body.data ?? []).find(
    (candidate: { iri?: string }) => candidate.iri === `${NS}${localName}`
  );

  expect(term, `no imported term found for ${NS}${localName}`).toBeDefined();

  return term;
};

test.describe.configure({ mode: 'serial' });

test.describe('Ontology import fidelity', { tag: ['@ontology-rdf'] }, () => {
  const polyhierarchyGlossary = new Glossary(`pw_poly_${suffix}`);
  const vocabularyGlossary = new Glossary(`pw_vocab_${suffix}`);

  test.beforeAll('Seed glossaries', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await polyhierarchyGlossary.create(apiContext);
    await vocabularyGlossary.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup glossaries', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await polyhierarchyGlossary.delete(apiContext);
    await vocabularyGlossary.delete(apiContext);
    await afterAction();
  });

  test('a demoted second parent keeps its rdfs:subClassOf predicate', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await importOntology(
        apiContext,
        polyhierarchyGlossary,
        POLYHIERARCHY_ONTOLOGY
      );

      const child = await findTermByIri(
        apiContext,
        polyhierarchyGlossary,
        'Child',
        'parent,relatedTerms'
      );

      expect(child.parent.name).toContain('AlphaParent');

      const relationTypes = (child.relatedTerms ?? []).map(
        (relation: { relationType: string }) => relation.relationType
      );

      expect(
        relationTypes,
        'the extra OWL parent stays a subsumption edge instead of being weakened to broader'
      ).toContain('subClassOf');
    } finally {
      await afterAction();
    }
  });

  test('the export re-emits the demoted parent as an rdfs:subClassOf axiom', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      const response = await apiContext.get(
        `/api/v1/rdf/glossary/${polyhierarchyGlossary.responseData.id}/export?format=turtle`
      );

      expect(response.ok(), await response.text()).toBe(true);

      const turtle = await response.text();

      expect(turtle).toContain(`${NS}ZuluParent`);
      expect(turtle).toContain('subClassOf');
    } finally {
      await afterAction();
    }
  });

  test('every asserted parent beyond the structural one keeps its own predicate', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const mixedGlossary = new Glossary(`pw_mixed_${suffix}`);

    try {
      await mixedGlossary.create(apiContext);
      await importOntology(apiContext, mixedGlossary, MIXED_ONTOLOGY);

      const child = await findTermByIri(
        apiContext,
        mixedGlossary,
        'Triple',
        'parent,relatedTerms'
      );

      expect(child.parent.name).toContain('AlphaP');

      const byTarget = Object.fromEntries(
        (child.relatedTerms ?? []).map(
          (relation: { relationType: string; term: { name: string } }) => [
            relation.term.name,
            relation.relationType,
          ]
        )
      );

      expect(
        byTarget[`MidP`],
        'the demoted rdfs:subClassOf parent stays a subsumption edge'
      ).toBe('subClassOf');
      expect(
        byTarget[`ZuluP`],
        'the skos:broader parent stays associative'
      ).toBe('broader');
    } finally {
      await mixedGlossary.delete(apiContext).catch(() => undefined);
      await afterAction();
    }
  });

  /**
   * A concept authored in OpenMetadata expresses no source vocabulary, so it must stay usable from
   * either one. The stored `conceptType` is left unset in that case and the exporter treats the
   * absence as BOTH, which is what this asserts rather than the stored value.
   */
  test('a concept created in OpenMetadata is exported for both vocabularies', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      const created = await apiContext.post('/api/v1/glossaryTerms', {
        data: {
          name: `Native${suffix}`,
          description: 'Authored in OpenMetadata, not imported',
          glossary: vocabularyGlossary.responseData.name,
        },
      });

      expect(created.ok(), await created.text()).toBe(true);

      const response = await apiContext.get(
        `/api/v1/rdf/glossary/${vocabularyGlossary.responseData.id}/export?format=turtle`
      );

      expect(response.ok(), await response.text()).toBe(true);

      const turtle = await response.text();
      const block = turtle
        .split(/\n\s*\n/)
        .find((section) => section.includes(`Native${suffix}`));

      expect(block, 'the natively authored concept is exported').toBeDefined();
      expect(block).toContain('owl:Class');
      expect(block).toContain('skos:Concept');

      const stored = await created.json();

      expect(
        stored.conceptType,
        'the stored value matches the vocabulary it is exported with'
      ).toBe('BOTH');
    } finally {
      await afterAction();
    }
  });

  test('the vocabulary a concept was authored with survives the round trip', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await importOntology(apiContext, vocabularyGlossary, VOCABULARY_ONTOLOGY);

      const pureConcept = await findTermByIri(
        apiContext,
        vocabularyGlossary,
        'PureConcept',
        'conceptType'
      );
      const pureClass = await findTermByIri(
        apiContext,
        vocabularyGlossary,
        'PureClass',
        'conceptType'
      );

      expect(pureConcept.conceptType).toBe('SKOS_CONCEPT');
      expect(pureClass.conceptType).toBe('OWL_CLASS');
    } finally {
      await afterAction();
    }
  });

  test('a SKOS-only concept is not exported as an owl:Class', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      const response = await apiContext.get(
        `/api/v1/rdf/glossary/${vocabularyGlossary.responseData.id}/export?format=turtle`
      );

      expect(response.ok(), await response.text()).toBe(true);

      const turtle = await response.text();
      const conceptTypes = turtle
        .split(/\n\s*\n/)
        .find((block) => block.includes(`<${NS}PureConcept>`));

      expect(conceptTypes).toBeDefined();
      expect(conceptTypes).toContain('skos:Concept');
      expect(
        conceptTypes,
        'a SKOS-authored concept must not acquire OWL class typing'
      ).not.toContain('owl:Class');
    } finally {
      await afterAction();
    }
  });
});
