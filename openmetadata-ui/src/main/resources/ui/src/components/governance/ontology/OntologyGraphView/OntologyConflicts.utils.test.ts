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
import {
  Code,
  OntologyProfileViolation,
  Severity,
} from '../../../../generated/api/data/ontologyProfileReport';
import { OntologyAxiom } from '../../../../generated/entity/data/ontologyAxiom';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { OntologyModelRelation } from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import {
  buildOntologyConflicts,
  describeConflict,
  getConflictRule,
  splitConflictMessage,
} from './OntologyConflicts.utils';

const concept = (id: string) =>
  ({
    id,
    name: id,
    displayName: id[0].toUpperCase() + id.slice(1),
  } as OntologyConcept);

const relation = (
  from: string,
  kind: OntologyModelRelation['kind'],
  to: string
): OntologyModelRelation => ({
  axiom: { id: `${from}-${kind}-${to}` } as OntologyAxiom,
  from: concept(from),
  key: `${from}-${kind}-${to}`,
  kind,
  to: concept(to),
});

const t = ((key: string, values: Record<string, string>) =>
  `${key}:${JSON.stringify(values)}`) as unknown as TFunction;

const clash = (conceptIds: string[]): OntologyProfileViolation => ({
  code: Code.DisjointClash,
  conceptIds,
  message: 'server message',
  path: '',
  severity: Severity.Error,
});

describe('ontology conflicts', () => {
  it('offers the disjoint rule between two inherited classes for removal, and explains it', () => {
    const [conflict] = buildOntologyConflicts(
      [clash(['mushroom', 'fungus', 'stone'])],
      [
        relation('mushroom', 'subClassOf', 'fungus'),
        relation('mushroom', 'subClassOf', 'stone'),
        relation('fungus', 'disjointWith', 'stone'),
      ]
    );

    expect(getConflictRule(conflict)?.key).toBe('fungus-disjointWith-stone');
    expect(conflict.parts.map(({ key }) => key)).toEqual([
      'mushroom-subClassOf-fungus',
      'mushroom-subClassOf-stone',
      'fungus-disjointWith-stone',
    ]);
    expect(describeConflict(conflict, t)).toBe(
      'message.ontology-conflict-both-disjoint:{"first":"Fungus","name":"Mushroom","second":"Stone"}'
    );
  });

  it('says a class cannot be what it is never allowed to be when the rule is on the class itself', () => {
    const [conflict] = buildOntologyConflicts(
      [clash(['medication', 'clinical'])],
      [
        relation('medication', 'subClassOf', 'clinical'),
        relation('medication', 'disjointWith', 'clinical'),
      ]
    );

    expect(describeConflict(conflict, t)).toBe(
      'message.ontology-conflict-disjoint-why:{"ancestor":"Clinical","name":"Medication"}'
    );
  });

  it('falls back to the server message when no rule is drawn', () => {
    const [conflict] = buildOntologyConflicts(
      [clash(['dog', 'plant'])],
      [relation('dog', 'subClassOf', 'plant')]
    );

    expect(describeConflict(conflict, t)).toBe('server message');
  });

  it('sets only whole names in semibold', () => {
    expect(
      splitConflictMessage('VipCustomer extends Customer', ['Customer'])
    ).toEqual([
      { isName: false, offset: 0, text: 'VipCustomer extends ' },
      { isName: true, offset: 20, text: 'Customer' },
    ]);
  });
});
