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

import { TFunction } from 'i18next';
import { Characteristic } from '../../generated/api/data/createRelationshipType';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import {
  CardinalityPreset,
  RelationshipTypeFormValues,
  toRelationshipTypeForm,
} from './RelationshipTypeForm.utils';
import { validateRelationshipTypeForm } from './RelationshipTypeForm.validation';

const t = ((key: string) => key) as TFunction;

const createValidForm = (): RelationshipTypeFormValues =>
  toRelationshipTypeForm(
    createRelationshipTypeMock({
      name: 'governedBy',
      rdfPredicate: 'https://example.org/governedBy',
    })
  );

describe('RelationshipTypeForm.validation', () => {
  it('reports invalid identity fields and a duplicate RDF predicate', () => {
    const existing = createRelationshipTypeMock({
      displayName: 'Existing predicate',
      rdfPredicate: 'https://example.org/duplicate',
    });
    const form = {
      ...createValidForm(),
      displayName: ' ',
      name: '1 invalid',
      rdfPredicate: existing.rdfPredicate,
    };

    expect(
      validateRelationshipTypeForm(form, undefined, [existing], t)
    ).toEqual({
      displayName: 'label.field-required',
      name: 'message.must-start-with-letter-alphanumeric',
      rdfPredicate: 'message.rdf-predicate-already-used',
    });
  });

  it('allows an unchanged RDF predicate while editing the same entity', () => {
    const existing = createRelationshipTypeMock();
    const form = toRelationshipTypeForm(existing);

    expect(validateRelationshipTypeForm(form, existing, [existing], t)).toEqual(
      {}
    );
  });

  it('rejects opposing symmetry characteristics', () => {
    const form = {
      ...createValidForm(),
      characteristics: [Characteristic.Asymmetric, Characteristic.Symmetric],
    };

    expect(validateRelationshipTypeForm(form, undefined, [], t)).toMatchObject({
      characteristics: 'message.incompatible-relationship-characteristics',
    });
  });

  it('requires a functional relation to limit targets per source', () => {
    const invalidForm = {
      ...createValidForm(),
      cardinalityPreset: CardinalityPreset.ManyToMany,
      characteristics: [Characteristic.Functional],
    };
    const validForm = {
      ...invalidForm,
      cardinalityPreset: CardinalityPreset.ManyToOne,
    };

    expect(
      validateRelationshipTypeForm(invalidForm, undefined, [], t)
    ).toMatchObject({
      characteristics: 'message.functional-relationship-cardinality',
    });
    expect(validateRelationshipTypeForm(validForm, undefined, [], t)).toEqual(
      {}
    );
  });

  it('requires an inverse-functional relation to limit sources per target', () => {
    const invalidForm = {
      ...createValidForm(),
      cardinalityPreset: CardinalityPreset.ManyToMany,
      characteristics: [Characteristic.InverseFunctional],
    };
    const validForm = {
      ...invalidForm,
      cardinalityPreset: CardinalityPreset.OneToMany,
    };

    expect(
      validateRelationshipTypeForm(invalidForm, undefined, [], t)
    ).toMatchObject({
      characteristics: 'message.inverse-functional-relationship-cardinality',
    });
    expect(validateRelationshipTypeForm(validForm, undefined, [], t)).toEqual(
      {}
    );
  });
});
