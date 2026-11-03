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

export const CONFLICT_COLOR = 'var(--tw-color-fg-error-primary)';
export const CONFLICT_COLOR_FALLBACK = '#D92D20';

export interface ConflictViolation {
  conceptIds?: string[];
}

export interface ConflictHighlight {
  nodeIds: ReadonlySet<string>;
  edgeKeys: ReadonlySet<string>;
}

export const conflictEdgeKey = ({ from, to }: { from: string; to: string }) =>
  from < to ? `${from}::${to}` : `${to}::${from}`;

/**
 * The clashing class is the first concept id; every edge from it to another
 * concept the clash names is the subclass link that makes the clash, so those
 * edges turn red. Linear in violations and edges, so it holds at 400 concepts.
 */
export const buildConflictHighlight = (
  violations: ConflictViolation[],
  edges: ReadonlyArray<{ from: string; to: string }>
): ConflictHighlight => {
  const nodeIds = new Set<string>();
  const pairs = new Set<string>();
  violations.forEach(({ conceptIds = [] }) => {
    const [clashing, ...others] = conceptIds;
    if (clashing) {
      nodeIds.add(clashing);
      others.forEach((other) =>
        pairs.add(conflictEdgeKey({ from: clashing, to: other }))
      );
    }
  });
  const edgeKeys = new Set(
    edges.map(conflictEdgeKey).filter((key) => pairs.has(key))
  );

  return { edgeKeys, nodeIds };
};
