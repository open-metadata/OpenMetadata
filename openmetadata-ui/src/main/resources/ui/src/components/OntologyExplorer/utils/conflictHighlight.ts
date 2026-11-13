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

const CHILD_TO_PARENT = new Set(['subclassof', 'isa', 'broader']);
const PARENT_TO_CHILD = new Set(['superclassof', 'narrower']);

const normalize = (relationType?: string) =>
  (relationType ?? '').replaceAll(/[^a-z]/gi, '').toLowerCase();

const reach = (start: string, next: ReadonlyMap<string, string[]>) => {
  const seen = new Set([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    (next.get(queue[head]) ?? []).forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        queue.push(id);
      }
    });
  }

  return seen;
};

const push = (map: Map<string, string[]>, key: string, value: string) =>
  map.set(key, [...(map.get(key) ?? []), value]);

/**
 * The server reports the clashing class first, then the disjoint ancestors it
 * inherits from, which need not be its direct parents. Every subclass edge on a
 * path from the class up to a reported ancestor is part of the clash, so those
 * edges turn red. An edge that names no relation type counts only when it
 * joins the class to a reported concept directly. Linear in edges per reported
 * ancestor.
 */
export const buildConflictHighlight = (
  violations: ConflictViolation[],
  edges: ReadonlyArray<{ from: string; to: string; relationType?: string }>
): ConflictHighlight => {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const subclassLinks: Array<[child: string, parent: string]> = [];
  edges.forEach(({ from, to, relationType }) => {
    const kind = normalize(relationType);
    let link: [string, string] | undefined;
    if (CHILD_TO_PARENT.has(kind)) {
      link = [from, to];
    } else if (PARENT_TO_CHILD.has(kind)) {
      link = [to, from];
    }
    if (link) {
      subclassLinks.push(link);
      push(parents, link[0], link[1]);
      push(children, link[1], link[0]);
    }
  });

  const nodeIds = new Set<string>();
  const pairs = new Set<string>();
  violations.forEach(({ conceptIds = [] }) => {
    const [clashing, ...others] = conceptIds;
    if (!clashing) {
      return;
    }
    nodeIds.add(clashing);
    const above = reach(clashing, parents);
    others.forEach((other) => {
      pairs.add(conflictEdgeKey({ from: clashing, to: other }));
      const below = reach(other, children);
      subclassLinks.forEach(([child, parent]) => {
        if (
          above.has(child) &&
          below.has(child) &&
          above.has(parent) &&
          below.has(parent)
        ) {
          pairs.add(conflictEdgeKey({ from: child, to: parent }));
        }
      });
    });
  });
  const edgeKeys = new Set(
    edges.map(conflictEdgeKey).filter((key) => pairs.has(key))
  );

  return { edgeKeys, nodeIds };
};
