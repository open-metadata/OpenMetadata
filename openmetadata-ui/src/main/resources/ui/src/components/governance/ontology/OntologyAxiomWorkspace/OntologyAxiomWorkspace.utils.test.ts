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
  Code,
  OntologyProfileViolation,
  Severity,
} from '../../../../generated/api/data/ontologyProfileReport';
import {
  AxiomType,
  OntologyAxiom,
} from '../../../../generated/entity/data/ontologyAxiom';
import {
  axiomStatus,
  constraintCheckTime,
  findAxiomConflicts,
} from './OntologyAxiomWorkspace.utils';

const concepts = [
  { id: 'a', iri: 'urn:a' },
  { id: 'b', iri: 'urn:b' },
  { id: 'c', iri: 'urn:c' },
];

const axiom = (
  id: string,
  axiomType: AxiomType,
  subjectIri: string,
  targetIri: string
) =>
  ({
    id,
    axiomType,
    subjectIri,
    targetIri,
    expressions: [],
    updatedAt: 1,
  } as unknown as OntologyAxiom);

const axioms = [
  axiom('c-a', AxiomType.SubclassOf, 'urn:c', 'urn:a'),
  axiom('c-b', AxiomType.SubclassOf, 'urn:c', 'urn:b'),
  axiom('a-b', AxiomType.DisjointWith, 'urn:a', 'urn:b'),
];

const violation = (
  code: Code,
  conceptIds: string[]
): OntologyProfileViolation => ({
  code,
  conceptIds,
  message: code,
  path: '',
  severity: Severity.Error,
});

describe('constraint status', () => {
  it('marks the disjoint rule behind a clash, paired with a relationship', () => {
    const conflicts = findAxiomConflicts(axioms, concepts, [
      violation(Code.DisjointClash, ['c', 'a', 'b']),
    ]);

    expect([...conflicts.keys()].sort()).toEqual(['a-b', 'c-a', 'c-b']);
    expect(conflicts.get('a-b')?.partner?.axiomType).toBe(AxiomType.SubclassOf);
  });

  it('does not call a constraint valid when a violation names no constraint', () => {
    const violations = [violation(Code.InvalidAxiomShape, [])];
    const conflicts = findAxiomConflicts(axioms, concepts, violations);
    const checkedAt = constraintCheckTime(conflicts, violations, 10);

    expect(checkedAt).toBeUndefined();
    expect(axiomStatus(axioms[0], conflicts, checkedAt)).toBe('not-checked');
  });

  it('calls the other constraints valid when every violation is attributed', () => {
    const violations = [violation(Code.DisjointClash, ['c', 'a', 'b'])];
    const conflicts = findAxiomConflicts(axioms, concepts, violations);

    expect(constraintCheckTime(conflicts, violations, 10)).toBe(10);
  });
});
