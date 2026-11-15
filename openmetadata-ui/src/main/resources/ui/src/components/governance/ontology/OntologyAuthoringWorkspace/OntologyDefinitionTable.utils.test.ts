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
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyAxiom } from '../../../../generated/entity/data/ontologyAxiom';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../../generated/entity/data/ontologyConcept';
import {
  Kind,
  OntologyProperty,
} from '../../../../generated/entity/data/ontologyProperty';
import {
  getModelRelations,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import {
  completenessColor,
  countPropertiesByKind,
  filterConcepts,
  formatParents,
  getConceptRowFacts,
  iriLabel,
  pageCount,
  pageOf,
  shortenIris,
} from './OntologyDefinitionTable.utils';

const concept = (
  id: string,
  extra: Partial<OntologyConcept> = {}
): OntologyConcept =>
  ({
    id,
    name: id,
    iri: `urn:x#${id}`,
    conceptType: OntologyConceptType.OwlClass,
    ...extra,
  } as OntologyConcept);

const person = concept('Person');
const patient = concept('Patient', {
  description: 'Someone in care',
  superClasses: ['urn:x#Person'],
  synonyms: ['Client'],
});
const model: OntologyStudioModel = {
  ontology: { id: 'o' } as Ontology,
  concepts: [person, patient],
  properties: [
    {
      id: 'p',
      name: 'age',
      iri: 'urn:x#age',
      kind: Kind.Data,
      domain: ['urn:x#Patient'],
      range: ['http://www.w3.org/2001/XMLSchema#integer'],
    } as OntologyProperty,
  ],
  axioms: [
    {
      id: 'a',
      name: 'PatientIsPerson',
      axiomType: 'SUBCLASS_OF',
      subjectIri: 'urn:x#Patient',
      expressions: [{ kind: 'NAMED_CLASS', classIri: 'urn:x#Person' }],
    } as unknown as OntologyAxiom,
  ],
};

describe('getConceptRowFacts', () => {
  it('counts relations, properties and rules and scores completeness in fifths', () => {
    const facts = getConceptRowFacts(model, getModelRelations(model));

    expect(facts.get('Patient')).toEqual({
      parents: ['Person'],
      relations: 1,
      properties: 1,
      rules: 1,
      completeness: 100,
    });
    expect(facts.get('Person')).toEqual({
      parents: [],
      relations: 1,
      properties: 0,
      rules: 0,
      completeness: 20,
    });
  });

  it('names a SKOS concept parent by its broader concept', () => {
    const animal = concept('Animal', {
      conceptType: OntologyConceptType.SkosConcept,
    });
    const dog = concept('Dog', {
      conceptType: OntologyConceptType.SkosConcept,
    });
    const facts = getConceptRowFacts(
      { ...model, concepts: [animal, dog], properties: [], axioms: [] },
      [
        {
          key: 'broader',
          kind: 'objectAssertion',
          from: dog,
          to: animal,
          propertyIri: 'http://www.w3.org/2004/02/skos/core#broader',
        },
      ]
    );

    expect(facts.get('Dog')?.parents).toEqual(['Animal']);
    expect(facts.get('Animal')?.parents).toEqual([]);
  });
});

describe('table helpers', () => {
  it('colours completeness amber, then blue, then green', () => {
    expect(completenessColor(0)).toContain('warning');
    expect(completenessColor(20)).toContain('warning');
    expect(completenessColor(40)).toContain('brand');
    expect(completenessColor(60)).toContain('success');
    expect(completenessColor(100)).toContain('success');
  });

  it('shows the first parent and how many more', () => {
    expect(formatParents([])).toBe('');
    expect(formatParents(['Person'])).toBe('Person');
    expect(formatParents(['Person', 'Agent', 'Thing'])).toBe('Person +2');
  });

  it('filters by name, type and level together', () => {
    const skos = concept('Term', {
      conceptType: OntologyConceptType.SkosConcept,
    });
    const all = [person, patient, skos];

    expect(
      filterConcepts(all, { search: 'pat', level: 'any' }).map((c) => c.id)
    ).toEqual(['Patient']);
    expect(
      filterConcepts(all, { search: '', level: 'top' }).map((c) => c.id)
    ).toEqual(['Person', 'Term']);
    expect(
      filterConcepts(all, {
        search: '',
        level: 'any',
        conceptType: OntologyConceptType.SkosConcept,
      }).map((c) => c.id)
    ).toEqual(['Term']);
  });

  it('labels an IRI by concept name, else by its local name', () => {
    const names = new Map([['urn:x#Person', 'Person']]);

    expect(iriLabel('urn:x#Person', names)).toBe('Person');
    expect(iriLabel('http://www.w3.org/2001/XMLSchema#integer', names)).toBe(
      'integer'
    );
  });

  it('counts properties per kind', () => {
    expect(countPropertiesByKind(model.properties)).toEqual({
      [Kind.Object]: 0,
      [Kind.Data]: 1,
      [Kind.Annotation]: 0,
    });
  });

  it('shortens every IRI left in a sentence to its local name', () => {
    expect(
      shortenIris(
        'https://x.org/fhir/PatientRecord fact http://www.w3.org/2004/02/skos/core#broader urn:x:Record'
      )
    ).toBe('PatientRecord fact broader Record');
  });

  it('pages 25 rows at a time', () => {
    const rows = Array.from({ length: 26 }, (_, index) => index);

    expect(pageOf(rows, 1)).toEqual([25]);
    expect(pageCount(0)).toBe(1);
    expect(pageCount(26)).toBe(2);
  });
});
