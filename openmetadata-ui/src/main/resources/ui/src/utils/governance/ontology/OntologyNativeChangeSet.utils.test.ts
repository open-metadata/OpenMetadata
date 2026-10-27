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
import { Layer, Ontology } from '../../../generated/entity/data/ontology';
import {
  buildNewClassChangeSet,
  NewClassDraft,
} from './OntologyNativeChangeSet.utils';
const ontology: Ontology = {
  id: 'o',
  name: 'Finance',
  fullyQualifiedName: 'Finance',
  iri: 'urn:fin',
  namespace: 'https://example.org/fin#',
  layer: Layer.L2,
};
const draft: NewClassDraft = {
  label: 'Funds Transfer',
  localName: 'FundsTransfer',
  synonyms: ['Transfer'],
  description: 'A payment',
  definitionSource: 'https://example.org/source',
  parentIris: ['urn:Payment', 'urn:Transaction', 'urn:Payment'],
  equivalentIris: [],
  disjointIris: ['urn:Person'],
  abstract: true,
  owners: [{ id: 'u', type: 'user' }],
  ownProperties: [
    { name: 'reference', kind: 'data', datatype: 'string', isIdentifier: true },
    {
      name: 'status',
      kind: 'enum',
      values: ['Pending', 'Settled'],
      isIdentifier: false,
    },
    {
      name: 'customer',
      kind: 'object',
      rangeIri: 'urn:Person',
      isIdentifier: false,
    },
  ],
};

it('builds one atomic class, own-property and named-axiom plan at the captured revision', () => {
  const plan = buildNewClassChangeSet(ontology, draft, 'attempt', 7);

  expect(plan).toMatchObject({
    name: 'attempt',
    ontology: 'Finance',
    baseWorkingRevision: 7,
    undoCursor: 7,
  });
  expect(plan.operations?.map((o) => o.operationType)).toEqual([
    'UPSERT_CONCEPT',
    'UPSERT_PROPERTY',
    'UPSERT_PROPERTY',
    'UPSERT_PROPERTY',
    'UPSERT_AXIOM',
    'UPSERT_AXIOM',
    'UPSERT_AXIOM',
  ]);
  expect(plan.operations?.[0].concept).toMatchObject({
    name: 'FundsTransfer',
    iri: ontology.namespace + 'FundsTransfer',
    displayName: 'Funds Transfer',
    abstract: true,
    synonyms: ['Transfer'],
    definitionSource: draft.definitionSource,
    owners: draft.owners,
  });
  expect(plan.operations?.slice(1, 4).map((o) => o.property)).toEqual([
    expect.objectContaining({
      kind: 'DATA',
      domain: [ontology.namespace + 'FundsTransfer'],
      range: ['http://www.w3.org/2001/XMLSchema#string'],
      isIdentifier: true,
    }),
    expect.objectContaining({
      kind: 'DATA',
      enumValues: [
        {
          value: 'Pending',
          datatypeIri: 'http://www.w3.org/2001/XMLSchema#string',
        },
        {
          value: 'Settled',
          datatypeIri: 'http://www.w3.org/2001/XMLSchema#string',
        },
      ],
    }),
    expect.objectContaining({ kind: 'OBJECT', range: ['urn:Person'] }),
  ]);
  expect(
    plan.operations
      ?.slice(4)
      .map((o) => [o.axiom?.axiomType, o.axiom?.targetIri])
  ).toEqual([
    ['SUBCLASS_OF', 'urn:Payment'],
    ['SUBCLASS_OF', 'urn:Transaction'],
    ['DISJOINT_WITH', 'urn:Person'],
  ]);
  expect(plan.operations?.every((o) => o.state === 'ACTIVE')).toBe(true);
});

it('does not create a stored parent for an implicit top-level class', () => {
  const plan = buildNewClassChangeSet(
    ontology,
    { ...draft, parentIris: [], disjointIris: [], ownProperties: [] },
    'top',
    8
  );

  expect(plan.operations).toHaveLength(1);
});
