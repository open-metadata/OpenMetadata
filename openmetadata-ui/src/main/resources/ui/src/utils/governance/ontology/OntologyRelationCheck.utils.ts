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
import { OntologyConcept } from '../../../generated/entity/data/ontologyConcept';
import { getEntityName } from '../../EntityNameUtils';
import { NativeRelationType } from './OntologyNativeRelation.utils';
import {
  getConceptAncestors,
  OntologyModelRelation,
} from './OntologyStudioModel.utils';

export type RelationIssue =
  | { readonly kind: 'self'; readonly concept: string }
  | {
      readonly kind: 'duplicate';
      readonly from: string;
      readonly relation: string;
      readonly to: string;
    }
  | {
      readonly kind: 'loop';
      readonly child: string;
      readonly parent: string;
    };

interface RelationCheckInput {
  readonly from: OntologyConcept;
  readonly to: OntologyConcept;
  readonly type: NativeRelationType;
  /** The relations the model asserts, without the one being replaced when a type is edited. */
  readonly relations: readonly OntologyModelRelation[];
}

/**
 * Names the first thing wrong with writing `from type to`, before any write. A hierarchy type
 * is read as "child is a kind of parent", so Narrower swaps the two ends.
 */
export const checkNativeRelation = ({
  from,
  relations,
  to,
  type,
}: RelationCheckInput): RelationIssue | undefined => {
  if (from.id === to.id) {
    return { concept: getEntityName(from), kind: 'self' };
  }
  const isHierarchy = type.kind !== 'objectProperty';
  const [child, parent] =
    type.kind === 'superClassOf' ? [to, from] : [from, to];
  const connects = (relation: OntologyModelRelation, a: string, b: string) =>
    relation.from.id === a && relation.to.id === b;
  const matches = (relation: OntologyModelRelation) =>
    isHierarchy
      ? relation.kind === 'subClassOf' &&
        connects(relation, child.id, parent.id)
      : relation.propertyIri === type.id && connects(relation, from.id, to.id);
  const exists = relations.some(matches);
  if (exists) {
    return {
      from: getEntityName(from),
      kind: 'duplicate',
      relation: type.label,
      to: getEntityName(to),
    };
  }
  if (
    isHierarchy &&
    getConceptAncestors([...relations], parent.id).some(
      (ancestor) => ancestor.id === child.id
    )
  ) {
    return {
      child: getEntityName(child),
      kind: 'loop',
      parent: getEntityName(parent),
    };
  }

  return undefined;
};

export const describeRelationIssue = (
  t: TFunction,
  issue: RelationIssue
): string => {
  switch (issue.kind) {
    case 'self':
      return t('message.ontology-relationship-self', { name: issue.concept });
    case 'duplicate':
      return t('message.ontology-relationship-exists', {
        from: issue.from,
        relation: issue.relation,
        to: issue.to,
      });
    case 'loop':
      return t('message.ontology-relationship-loop', {
        child: issue.child,
        parent: issue.parent,
      });
  }
};
