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
import { OntologyProfileViolation } from '../../../../generated/api/data/ontologyProfileReport';
import {
  AxiomType,
  OntologyAxiom,
} from '../../../../generated/entity/data/ontologyAxiom';
import {
  buildConflictHighlight,
  conflictEdgeKey,
} from '../../../OntologyExplorer/utils/conflictHighlight';
import { shortenIris } from '../OntologyAuthoringWorkspace/OntologyDefinitionTable.utils';

export type AxiomStatus = 'valid' | 'not-checked' | 'conflict';

export const AXIOM_STATUSES: AxiomStatus[] = [
  'valid',
  'not-checked',
  'conflict',
];

export const AXIOM_STATUS_LABELS: Record<AxiomStatus, string> = {
  valid: 'label.valid',
  'not-checked': 'label.not-checked',
  conflict: 'label.conflict',
};

export interface AxiomConflict {
  violation: OntologyProfileViolation;
  /** The other half of the clash: a rule for a relationship, a relationship for a rule. */
  partner?: OntologyAxiom;
}

const isRule = (axiom: OntologyAxiom) =>
  axiom.axiomType === AxiomType.DisjointWith;

const otherIris = (axiom: OntologyAxiom) => [
  axiom.targetIri,
  ...axiom.expressions.map((expression) => expression.classIri),
];

// A fact names its relation by property IRI (skos:broader); the highlighter matches on the local name.
const relationTypeOf = (axiom: OntologyAxiom) =>
  axiom.axiomType === AxiomType.ObjectPropertyAssertion
    ? shortenIris(axiom.propertyIri ?? '')
    : axiom.axiomType;

const axiomEdges = (
  axiom: OntologyAxiom,
  conceptIdByIri: ReadonlyMap<string, string>
) => {
  const from = conceptIdByIri.get(axiom.subjectIri);

  return otherIris(axiom).flatMap((iri) => {
    const to = iri ? conceptIdByIri.get(iri) : undefined;

    return from && to
      ? [{ from, to, relationType: relationTypeOf(axiom), axiom }]
      : [];
  });
};

/**
 * Which constraints take part in each server-reported clash. The server names concepts, not
 * constraints, so a constraint is in conflict when it joins two concepts on the clash path — the
 * same rule the graph uses to turn its edges red.
 */
export const findAxiomConflicts = (
  axioms: readonly OntologyAxiom[],
  concepts: ReadonlyArray<{ id: string; iri: string }>,
  violations: readonly OntologyProfileViolation[]
): Map<string, AxiomConflict> => {
  const conceptIdByIri = new Map(concepts.map(({ iri, id }) => [iri, id]));
  const edges = axioms.flatMap((axiom) => axiomEdges(axiom, conceptIdByIri));
  const conflicts = new Map<string, AxiomConflict>();
  violations.forEach((violation) => {
    const { edgeKeys } = buildConflictHighlight([violation], edges);
    const involved = [
      ...new Set(
        edges
          .filter((edge) => edgeKeys.has(conflictEdgeKey(edge)))
          .map(({ axiom }) => axiom)
      ),
    ];
    involved.forEach((axiom) => {
      if (!conflicts.has(axiom.id)) {
        conflicts.set(axiom.id, {
          violation,
          partner: involved.find((other) => isRule(other) !== isRule(axiom)),
        });
      }
    });
  });

  return conflicts;
};

/**
 * When the last check finished, as far as it vouches for every constraint. A violation that names
 * no constraint (an invalid shape, an undeclared class…) could be about any of them, so none can be
 * called valid: the time is withheld and the rest read as not checked.
 */
export const constraintCheckTime = (
  conflicts: ReadonlyMap<string, AxiomConflict>,
  violations: readonly OntologyProfileViolation[],
  checkedAt?: number
) => {
  const attributed = new Set(
    [...conflicts.values()].map(({ violation }) => violation)
  );

  return violations.every((violation) => attributed.has(violation))
    ? checkedAt
    : undefined;
};

/**
 * Conflict when a clash involves it; not checked when no validation run has answered or the
 * constraint changed after the last run; valid otherwise.
 */
export const axiomStatus = (
  axiom: OntologyAxiom,
  conflicts: ReadonlyMap<string, AxiomConflict>,
  checkedAt?: number
): AxiomStatus => {
  if (conflicts.has(axiom.id)) {
    return 'conflict';
  }
  // ponytail: compares server updatedAt with the client's fetch time; clock skew can misplace a row.
  if (!checkedAt || (axiom.updatedAt ?? 0) > checkedAt) {
    return 'not-checked';
  }

  return 'valid';
};

export const countAxiomStatuses = (
  axioms: readonly OntologyAxiom[],
  conflicts: ReadonlyMap<string, AxiomConflict>,
  checkedAt?: number
) =>
  axioms.reduce<Record<AxiomStatus, number>>(
    (counts, axiom) => {
      counts[axiomStatus(axiom, conflicts, checkedAt)] += 1;

      return counts;
    },
    { valid: 0, 'not-checked': 0, conflict: 0 }
  );
