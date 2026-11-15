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

import { Ontology } from '../../../generated/entity/data/ontology';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../generated/entity/data/ontologyConcept';
import { PaletteKey } from '../../../generated/entity/data/relationshipType';
import {
  NativeRelationType,
  SUBCLASS_OF_PREDICATE,
  SUPERCLASS_OF_PREDICATE,
} from './OntologyNativeRelation.utils';
import { checkNativeRelation } from './OntologyRelationCheck.utils';
import { OntologyModelRelation } from './OntologyStudioModel.utils';

const NS = 'urn:zoo:';
const ontology = { id: 'o', name: 'Zoo' } as Ontology;
const concept = (name: string): OntologyConcept => ({
  conceptType: OntologyConceptType.OwlClass,
  fullyQualifiedName: `Zoo.${name}`,
  id: `c-${name}`,
  iri: `${NS}${name}`,
  name,
  ontology: { id: ontology.id, type: 'ontology' },
});
const animal = concept('Animal');
const dog = concept('Dog');
const puppy = concept('Puppy');
const isA: NativeRelationType = {
  group: 'core',
  id: SUBCLASS_OF_PREDICATE,
  kind: 'subClassOf',
  label: 'is a',
  name: 'subClassOf',
  paletteKey: PaletteKey.Purple,
};
const narrower: NativeRelationType = {
  ...isA,
  id: SUPERCLASS_OF_PREDICATE,
  kind: 'superClassOf',
  label: 'Narrower',
  name: 'superClassOf',
};
const feeds: NativeRelationType = {
  ...isA,
  id: `${NS}feeds`,
  kind: 'objectProperty',
  label: 'feeds',
  name: 'feeds',
};
const edge = (
  from: OntologyConcept,
  to: OntologyConcept,
  kind: OntologyModelRelation['kind'],
  propertyIri?: string
): OntologyModelRelation => ({
  from,
  key: `${kind}:${from.id}:${to.id}`,
  kind,
  propertyIri,
  to,
});
const relations = [
  edge(dog, animal, 'subClassOf'),
  edge(puppy, dog, 'subClassOf'),
  edge(dog, animal, 'restriction', feeds.id),
];

describe('checkNativeRelation', () => {
  it('refuses a concept related to itself', () => {
    expect(
      checkNativeRelation({
        from: dog,
        relations,
        to: dog,
        type: feeds,
      })
    ).toEqual({ concept: 'Dog', kind: 'self' });
  });

  it('names a hierarchy link that already exists', () => {
    expect(
      checkNativeRelation({ from: dog, relations, to: animal, type: isA })
    ).toEqual({
      from: 'Dog',
      kind: 'duplicate',
      relation: 'is a',
      to: 'Animal',
    });
  });

  it('reads Narrower with the ends swapped when it looks for a duplicate', () => {
    expect(
      checkNativeRelation({ from: animal, relations, to: dog, type: narrower })
    ).toEqual({
      from: 'Animal',
      kind: 'duplicate',
      relation: 'Narrower',
      to: 'Dog',
    });
  });

  it('names a link property that already joins the two concepts', () => {
    expect(
      checkNativeRelation({ from: dog, relations, to: animal, type: feeds })
    ).toEqual({
      from: 'Dog',
      kind: 'duplicate',
      relation: 'feeds',
      to: 'Animal',
    });
  });

  it('lets a different link property join the same pair', () => {
    expect(
      checkNativeRelation({
        from: dog,
        relations,
        to: animal,
        type: { ...feeds, id: `${NS}chases`, label: 'chases' },
      })
    ).toBeUndefined();
  });

  it('refuses a subclass loop through a longer chain', () => {
    expect(
      checkNativeRelation({ from: animal, relations, to: puppy, type: isA })
    ).toEqual({ child: 'Animal', kind: 'loop', parent: 'Puppy' });
  });

  it('refuses the same loop written as Narrower', () => {
    expect(
      checkNativeRelation({
        from: puppy,
        relations,
        to: animal,
        type: narrower,
      })
    ).toEqual({ child: 'Animal', kind: 'loop', parent: 'Puppy' });
  });

  it('accepts a new parent that closes no loop', () => {
    expect(
      checkNativeRelation({
        from: puppy,
        relations: relations.slice(0, 1),
        to: animal,
        type: isA,
      })
    ).toBeUndefined();
  });

  it('ignores a relation the caller removed from the list when editing its type', () => {
    expect(
      checkNativeRelation({
        from: dog,
        relations: relations.slice(1),
        to: animal,
        type: isA,
      })
    ).toBeUndefined();
  });
});
