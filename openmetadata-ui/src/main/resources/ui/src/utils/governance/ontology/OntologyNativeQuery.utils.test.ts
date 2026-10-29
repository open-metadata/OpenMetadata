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
import fixtures from '../../../../../../../../../openmetadata-service/src/test/resources/ontology/native-visual-queries.json';
import { RestrictionKind } from '../../../generated/entity/data/ontologyAxiom';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../generated/entity/data/ontologyConcept';
import { buildNativeVisualSparqlQuery } from './OntologyNativeQuery.utils';
import {
  OntologyModelRelation,
  OntologyRelationKind,
} from './OntologyStudioModel.utils';

const target: OntologyConcept = {
  id: 'target',
  name: 'Target',
  fullyQualifiedName: 'Owner.Target',
  iri: 'urn:visual:target',
  conceptType: OntologyConceptType.OwlClass,
  ontology: { id: 'owner', type: 'ontology' },
};
const source = {
  ...target,
  id: 'source',
  name: 'Source',
  iri: 'urn:visual:source',
};
const namedKinds: OntologyRelationKind[] = [
  'subClassOf',
  'equivalentClass',
  'disjointWith',
  'objectAssertion',
  'objectProperty',
];
const relations: OntologyModelRelation[] = [
  ...namedKinds.map((kind) => ({
    key: kind,
    kind,
    from: source,
    to: target,
    propertyIri: 'urn:visual:property',
  })),
  ...[
    RestrictionKind.Some,
    RestrictionKind.Only,
    RestrictionKind.Min,
    RestrictionKind.Max,
    RestrictionKind.Exact,
  ].map(
    (kind): OntologyModelRelation => ({
      key: kind,
      kind: 'restriction',
      from: source,
      to: target,
      propertyIri: 'urn:visual:property',
      restriction: {
        kind,
        cardinality: [
          RestrictionKind.Min,
          RestrictionKind.Max,
          RestrictionKind.Exact,
        ].includes(kind)
          ? 2
          : undefined,
      },
    })
  ),
];

it.each(relations)(
  'compiles $key into the query executed against canonical RDF by the Java contract test',
  (relation) => {
    const fixture = fixtures.find((item) => item.name === relation.key);

    expect(fixture).toBeDefined();
    expect(buildNativeVisualSparqlQuery(relation, target)).toBe(fixture?.query);
    expect(fixture?.query).not.toContain('GlossaryTerm');
    expect(fixture?.query).not.toContain('fullyQualifiedName');
  }
);

it('rejects an IRI that could escape the target value', () => {
  expect(() =>
    buildNativeVisualSparqlQuery(relations[0], {
      ...target,
      iri: 'urn:target> } UNION { ?x ?y ?z',
    })
  ).toThrow('Invalid semantic IRI');
});
