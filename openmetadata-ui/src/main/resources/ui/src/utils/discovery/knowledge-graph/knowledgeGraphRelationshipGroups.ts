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
  classifyRelation,
  getRelationStyle,
  RelationCategory,
  RELATION_CATEGORIES,
} from '../../../components/discovery/knowledge-graph/KnowledgeGraph.relations';
import { GraphFilterOption } from '../../../types/knowledgeGraph.types';

/**
 * One section of the Relationship Type dropdown — a RelationCategory with its
 * matching predicates. Groups with zero matches are dropped, so the dropdown
 * only shows families actually present in the current graph. The section
 * header renders {@link labelKey} + {@link count}.
 */
export interface KnowledgeGraphRelationshipGroupSection {
  key: RelationCategory;
  labelKey: string;
  count: number;
  choices: GraphFilterOption[];
}

/**
 * Bucket relationship-type choices by RelationCategory, preserving the
 * canonical order declared in {@link RELATION_CATEGORIES}. Predicates are
 * classified by their raw id/label alone — the dropdown doesn't carry
 * source/target endpoint types, so {@link classifyRelation} falls through to
 * its predicate map, with anything unrecognised landing in `other`.
 */
export const groupRelationshipTypeChoices = (
  choices: GraphFilterOption[]
): KnowledgeGraphRelationshipGroupSection[] => {
  const bucketed = new Map<RelationCategory, GraphFilterOption[]>();
  choices.forEach((choice) => {
    const category = classifyRelation(choice.id);
    const bucket = bucketed.get(category) ?? [];
    bucket.push(choice);
    bucketed.set(category, bucket);
  });

  const sections: KnowledgeGraphRelationshipGroupSection[] = [];
  RELATION_CATEGORIES.forEach((category) => {
    const items = bucketed.get(category);
    if (items && items.length > 0) {
      sections.push({
        key: category,
        labelKey: getRelationStyle(category).labelKey,
        count: items.reduce((sum, item) => sum + item.count, 0),
        choices: items,
      });
    }
  });

  return sections;
};
