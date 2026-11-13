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
import { OntologyProfileViolation } from '../../../../generated/api/data/ontologyProfileReport';
import {
  OntologyAxiom,
  Provenance,
} from '../../../../generated/entity/data/ontologyAxiom';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getModelRelationLabel,
  OntologyModelRelation,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import {
  buildConflictHighlight,
  conflictEdgeKey,
  wholeNamePattern,
} from '../../../OntologyExplorer/utils/conflictHighlight';

export interface OntologyConflict {
  readonly violation: OntologyProfileViolation;
  /** What can be removed to resolve the clash: the hierarchy links first, then the disjoint rule. */
  readonly parts: OntologyModelRelation[];
}

const HIERARCHY_LABELS = new Set(['isa', 'broader', 'narrower']);

const isConflictPart = (relation: OntologyModelRelation) =>
  relation.kind === 'disjointWith' ||
  HIERARCHY_LABELS.has(
    getModelRelationLabel(relation)
      .replaceAll(/[^a-z]/gi, '')
      .toLowerCase()
  );

const toEdge = (relation: OntologyModelRelation) => ({
  from: relation.from.id,
  relationType: getModelRelationLabel(relation),
  to: relation.to.id,
});

/** Pairs each violation with the relationships and rule that make it, so each can be removed. */
export const buildOntologyConflicts = (
  violations: OntologyProfileViolation[],
  relations: OntologyModelRelation[]
): OntologyConflict[] => {
  const edges = relations.map(toEdge);

  return violations.map((violation) => {
    const { edgeKeys } = buildConflictHighlight([violation], edges);
    const parts = relations.filter(
      (relation) =>
        isConflictPart(relation) &&
        edgeKeys.has(
          conflictEdgeKey({ from: relation.from.id, to: relation.to.id })
        )
    );

    return {
      parts: [
        ...parts.filter(({ kind }) => kind !== 'disjointWith'),
        ...parts.filter(({ kind }) => kind === 'disjointWith'),
      ],
      violation,
    };
  });
};

export const getConflictRule = ({ parts }: OntologyConflict) =>
  parts.find(({ kind }) => kind === 'disjointWith');

/**
 * Why a concept clashes, in plain words, from the disjoint rule behind it: a rule on the concept
 * itself reads "X can't be a Y and also never be a Y"; a rule between two classes it sits under
 * reads "X can't be both a Y and a Z". Without a rule, the server's own message.
 */
export const describeConflict = (
  conflict: OntologyConflict,
  t: TFunction
): string => {
  const rule = getConflictRule(conflict);
  const [clashingId] = conflict.violation.conceptIds ?? [];
  const clashing = conflict.parts
    .flatMap(({ from, to }) => [from, to])
    .find(({ id }) => id === clashingId);
  if (!rule || !clashing) {
    return conflict.violation.message;
  }
  const name = getEntityName(clashing);
  if (rule.from.id === clashingId || rule.to.id === clashingId) {
    const other = rule.from.id === clashingId ? rule.to : rule.from;

    return t('message.ontology-conflict-disjoint-why', {
      ancestor: getEntityName(other),
      name,
    });
  }

  return t('message.ontology-conflict-both-disjoint', {
    first: getEntityName(rule.from),
    name,
    second: getEntityName(rule.to),
  });
};

/** Who saved the definition and when, as the design's grey caption; nothing when the server sent neither. */
export const getAxiomProvenance = (
  axiom: OntologyAxiom | undefined,
  t: TFunction
) => {
  if (!axiom?.updatedBy || !axiom.updatedAt) {
    return undefined;
  }
  const key =
    axiom.provenance === Provenance.Imported
      ? 'message.ontology-imported-by-on'
      : 'message.ontology-saved-by-on';

  return t(key, { date: formatDate(axiom.updatedAt), user: axiom.updatedBy });
};

/** Splits a conflict message so the concept names it mentions can be set in semibold. */
export const splitConflictMessage = (
  message: string,
  names: string[]
): Array<{ text: string; isName: boolean; offset: number }> => {
  const pattern = wholeNamePattern(names);
  if (!pattern) {
    return [{ isName: false, offset: 0, text: message }];
  }
  // split() with a capturing group puts each matched name at an odd index.
  let offset = 0;

  return message
    .split(pattern)
    .map((text, index) => ({ text, isName: index % 2 === 1 }))
    .filter(({ text }) => text)
    .map(({ text, isName }) => {
      const segment = { isName, offset, text };
      offset += text.length;

      return segment;
    });
};
