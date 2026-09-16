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

import {
  Category,
  Characteristic,
  PaletteKey,
} from '../../generated/api/data/createRelationshipType';
import {
  Category as EntityCategory,
  Characteristic as EntityCharacteristic,
  PaletteKey as EntityPaletteKey,
} from '../../generated/entity/data/relationshipType';
import {
  createRelationshipTypeMock,
  createRelationshipTypeReferenceMock,
} from '../../mocks/Ontology.mock';
import {
  cardinalityForPreset,
  CardinalityPreset,
  deriveCardinalityPreset,
  toRelationshipTypeForm,
  toRelationshipTypeRequest,
} from './RelationshipTypeForm.utils';

describe('RelationshipTypeForm.utils', () => {
  it('maps a governed entity into editable values without losing advanced fields', () => {
    const entity = createRelationshipTypeMock({
      category: EntityCategory.OwlSkos,
      characteristics: [EntityCharacteristic.Transitive],
      disjointWith: [createRelationshipTypeReferenceMock('excludes')],
      inverse: createRelationshipTypeReferenceMock('narrower'),
      paletteKey: EntityPaletteKey.Green,
      propertyChain: [createRelationshipTypeReferenceMock('contains')],
    });

    const form = toRelationshipTypeForm(entity);
    const request = toRelationshipTypeRequest(form);

    expect(request).toMatchObject({
      category: Category.OwlSkos,
      characteristics: [Characteristic.Transitive],
      disjointWith: ['excludes'],
      inverse: 'narrower',
      paletteKey: PaletteKey.Green,
      propertyChain: ['contains'],
    });
  });

  it('uses traversal limits for one-to-many cardinality', () => {
    expect(deriveCardinalityPreset({ targetMax: 1 })).toBe(
      CardinalityPreset.OneToMany
    );
    expect(
      cardinalityForPreset({
        ...toRelationshipTypeForm(createRelationshipTypeMock()),
        cardinalityPreset: CardinalityPreset.OneToMany,
      })
    ).toEqual({ targetMax: 1 });
  });

  it('represents unconstrained many-to-many cardinality without a synthetic object', () => {
    expect(deriveCardinalityPreset(undefined)).toBe(
      CardinalityPreset.ManyToMany
    );
    expect(
      cardinalityForPreset({
        ...toRelationshipTypeForm(createRelationshipTypeMock()),
        cardinalityPreset: CardinalityPreset.ManyToMany,
      })
    ).toBeUndefined();
  });
});
