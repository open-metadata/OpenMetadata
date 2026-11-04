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
  AxiomType,
  ExpressionKind,
  RestrictionKind,
} from '../../../../generated/api/data/createOntologyAxiom';
import {
  buildOntologyAxiomRequest,
  EMPTY_AXIOM_FORM,
  formatOntologyExpression,
} from './OntologyAxiomEditor.utils';

describe('Ontology axiom form utilities', () => {
  it('builds an ontology-owned axiom and omits empty optional values', () => {
    const request = buildOntologyAxiomRequest('governed', {
      ...EMPTY_AXIOM_FORM,
      axiomType: AxiomType.SubclassOf,
      description: ' Classification ',
      displayName: 'Customer class',
      name: 'customer-classification',
      subjectIri: 'https://example.org/Customer',
      targetIri: ' https://example.org/Party ',
    });

    expect(request).toEqual(
      expect.objectContaining({
        description: 'Classification',
        ontology: 'governed',
        subjectIri: 'https://example.org/Customer',
      })
    );
    expect(request.expressions).toBeUndefined();
    expect(request.literal).toBeUndefined();
    expect(request.propertyIri).toBeUndefined();
    expect(request.targetIri).toBeUndefined();
  });

  it('preserves an empty string as a data-property fact and excludes class expressions', () => {
    const request = buildOntologyAxiomRequest('governed', {
      ...EMPTY_AXIOM_FORM,
      axiomType: AxiomType.DataPropertyAssertion,
      propertyIri: 'urn:code',
      literalValue: '',
      expressions: [
        { kind: ExpressionKind.NamedClass, classIri: 'urn:Person' },
      ],
    });

    expect(request.literal).toEqual({ value: '', datatypeIri: undefined });
    expect(request.expressions).toBeUndefined();
  });
});

const referenceLabel = (iri: string) => iri.replace('urn:', '');
const translate = (key: string) => key;

it('previews nested alternatives and zero cardinality without losing their meaning', () => {
  expect(
    formatOntologyExpression(
      {
        kind: ExpressionKind.Intersection,
        operands: [
          { kind: ExpressionKind.NamedClass, classIri: 'urn:Person' },
          {
            kind: ExpressionKind.Union,
            operands: [
              {
                kind: ExpressionKind.OneOf,
                individualIris: ['urn:Alice', 'urn:Bob'],
              },
              {
                kind: ExpressionKind.Restriction,
                propertyIri: 'urn:children',
                restrictionKind: RestrictionKind.Max,
                cardinality: 0,
              },
            ],
          },
        ],
      },
      referenceLabel,
      translate
    )
  ).toBe(
    '(Person label.and-lowercase ({Alice, Bob} label.or-lowercase children ≤ 0))'
  );
});

it('previews a typed empty literal and a quantified filler', () => {
  expect(
    formatOntologyExpression(
      {
        kind: ExpressionKind.Restriction,
        propertyIri: 'urn:code',
        restrictionKind: RestrictionKind.Value,
        literal: { value: '', datatypeIri: 'urn:string' },
      },
      referenceLabel,
      translate
    )
  ).toBe('code = "" (string)');
  expect(
    formatOntologyExpression(
      {
        kind: ExpressionKind.Restriction,
        propertyIri: 'urn:knows',
        restrictionKind: RestrictionKind.Some,
        filler: { kind: ExpressionKind.NamedClass, classIri: 'urn:Person' },
      },
      referenceLabel,
      translate
    )
  ).toBe('knows label.ontology-some-values Person');
});
