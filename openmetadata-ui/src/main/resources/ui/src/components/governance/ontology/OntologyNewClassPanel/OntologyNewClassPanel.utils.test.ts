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
import { ConceptMappingType } from '../../../../generated/api/data/createOntologyChangeSet';
import { OntologyStudioModel } from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import {
  MODEL_NODE_MAX_WIDTH,
  NODE_HEIGHT,
} from '../../../OntologyExplorer/utils/graphConfig';
import {
  classIdentityIssues,
  classIri,
  classLocalName,
  distinctChipValues,
  isValidLocalName,
  isValidMapping,
  placeNewClass,
} from './OntologyNewClassPanel.utils';

it('derives a PascalCase local name from words and trims duplicate chips', () => {
  expect(classLocalName('  Funds Transfer ')).toBe('FundsTransfer');
  expect(classLocalName('funds-transfer')).toBe('FundsTransfer');
  expect(distinctChipValues([' A ', 'A', ' ', 'B'])).toEqual(['A', 'B']);
  expect(isValidLocalName('Bad name')).toBe(false);
});

it('preserves existing positions and places five creations clear of all renderer bounds', () => {
  let positions: Record<string, { x: number; y: number }> = {
    a: { x: 0, y: 0 },
    b: { x: 170, y: 0 },
  };
  const nodes = [{ id: 'a' }, { id: 'b' }];
  for (let i = 0; i < 5; i++) {
    const id = 'new' + i;
    const next = placeNewClass(positions, nodes, id);

    if (!next) {
      throw new Error('Expected complete placement');
    }

    expect(next.a).toEqual(positions.a);

    for (const old of nodes) {
      expect(
        Math.abs(next[id].x - next[old.id].x) > MODEL_NODE_MAX_WIDTH ||
          Math.abs(next[id].y - next[old.id].y) > NODE_HEIGHT
      ).toBe(true);
    }
    positions = next;
    nodes.push({ id });
  }
});

it('waits for layout rather than guessing missing positions', () => {
  expect(placeNewClass({}, [{ id: 'missing' }], 'new')).toBeUndefined();
  expect(placeNewClass({}, [], 'new')).toEqual({
    new: expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
    }),
  });
});

const model = {
  ontology: { namespace: 'urn:x:' },
  concepts: [
    { name: 'Payment', displayName: 'Payment', iri: 'urn:x:Payment' },
    { name: 'Txn', displayName: 'Wire transfer', iri: 'urn:x:Txn' },
  ],
  properties: [{ name: 'amount', iri: 'urn:x:amount' }],
} as unknown as OntologyStudioModel;
const input = { displayName: '', localName: 'Fresh', iri: '', source: '' };

it('reports each identity problem once, in the order the form shows them', () => {
  expect(classIdentityIssues(model, input)).toEqual([]);
  expect(classIdentityIssues(model, { ...input, localName: ' ' })).toEqual([
    'name-required',
  ]);
  expect(
    classIdentityIssues(model, { ...input, localName: 'Spaced Name!' })
  ).toEqual(['name-invalid']);
  expect(
    classIdentityIssues(model, { ...input, localName: 'Payment' })
  ).toEqual(['name-taken']);
  expect(classIdentityIssues(model, { ...input, localName: 'amount' })).toEqual(
    ['name-taken']
  );
  expect(
    classIdentityIssues(model, { ...input, displayName: 'wire TRANSFER' })
  ).toEqual(['label-taken']);
  expect(
    classIdentityIssues(model, {
      ...input,
      iri: 'relative',
      source: 'also relative',
    })
  ).toEqual(['iri-invalid', 'source-invalid']);
  expect(classIdentityIssues(model, { ...input, iri: 'urn:x:Txn' })).toEqual([
    'iri-taken',
  ]);
});

it('uses a typed IRI over the namespace and name', () => {
  expect(classIri('urn:x:', ' Fresh ', '')).toBe('urn:x:Fresh');
  expect(classIri('urn:x:', 'Fresh', ' urn:y:Other ')).toBe('urn:y:Other');
});

it('accepts an absolute mapping IRI once per type', () => {
  const row = {
    mappingType: ConceptMappingType.ExactMatch,
    conceptIri: 'https://schema.org/Payment',
  };

  expect(isValidMapping([], row)).toBe(true);
  expect(isValidMapping([row], row)).toBe(false);
  expect(isValidMapping([], { ...row, conceptIri: 'Payment' })).toBe(false);
  expect(
    isValidMapping([row], { ...row, mappingType: ConceptMappingType.SameAs })
  ).toBe(true);
});
