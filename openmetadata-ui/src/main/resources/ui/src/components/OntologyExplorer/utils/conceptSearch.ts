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
import { OntologyNode } from '../OntologyExplorer.interface';

export const CONCEPT_SEARCH_RESULT_LIMIT = 8;

const normalize = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

/**
 * Orders the nodes a search matched so the likeliest concept is first: a label
 * that starts with the query, then one that contains it, then matches found
 * only in the description or identifier.
 */
export function rankConceptMatches(
  nodes: readonly OntologyNode[],
  matchedIds: ReadonlySet<string>,
  rawQuery: string,
  limit = CONCEPT_SEARCH_RESULT_LIMIT
): OntologyNode[] {
  const query = normalize(rawQuery.trim());
  const tier = (node: OntologyNode) => {
    const label = normalize(node.label);
    if (label.startsWith(query)) {
      return 0;
    }

    return label.includes(query) ? 1 : 2;
  };

  return nodes
    .filter((node) => matchedIds.has(node.id))
    .sort(
      (left, right) =>
        tier(left) - tier(right) ||
        left.label.localeCompare(right.label) ||
        left.id.localeCompare(right.id)
    )
    .slice(0, limit);
}
