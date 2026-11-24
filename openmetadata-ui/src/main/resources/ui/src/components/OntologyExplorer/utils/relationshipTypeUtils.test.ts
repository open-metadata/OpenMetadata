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

import { Characteristic } from '../../../generated/entity/data/relationshipType';
import {
  createRelationshipTypeMock,
  createRelationshipTypeReferenceMock,
} from '../../../mocks/Ontology.mock';
import {
  getInverseRelationshipName,
  getRelationshipCardinalityLabels,
  isHierarchicalRelationship,
  isSymmetricRelationship,
} from './relationshipTypeUtils';

describe('relationshipTypeUtils', () => {
  it('reads inverse and OWL characteristics from the governed contract', () => {
    const relationshipType = createRelationshipTypeMock({
      characteristics: [Characteristic.Symmetric],
      inverse: createRelationshipTypeReferenceMock('siblingOf'),
      name: 'siblingOf',
    });

    expect(getInverseRelationshipName(relationshipType)).toBe('siblingOf');
    expect(isSymmetricRelationship(relationshipType)).toBe(true);
  });

  it('recognizes hierarchy semantics by predicate instead of legacy UI category', () => {
    const relationshipType = createRelationshipTypeMock({
      name: 'ancestorLink',
      rdfPredicate: 'http://www.w3.org/2004/02/skos/core#broader',
    });

    expect(isHierarchicalRelationship(relationshipType)).toBe(true);
  });

  it('renders directional one-to-many limits at the correct edge ends', () => {
    const relationshipType = createRelationshipTypeMock({
      cardinality: { targetMax: 1 },
      name: 'contains',
    });

    expect(getRelationshipCardinalityLabels(relationshipType)).toEqual({
      startLabelText: '1',
      endLabelText: 'M',
    });
  });

  it('omits cardinality labels when the relationship has no constraint', () => {
    expect(
      getRelationshipCardinalityLabels(createRelationshipTypeMock())
    ).toBeNull();
  });
});
