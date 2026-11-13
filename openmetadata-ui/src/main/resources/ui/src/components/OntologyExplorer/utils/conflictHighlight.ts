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

import { escapeRegExp } from 'lodash';

export const CONFLICT_COLOR = 'var(--tw-color-fg-error-primary)';
export const CONFLICT_COLOR_FALLBACK = '#D92D20';
export const CONFLICT_DOT_COLOR = 'var(--tw-color-fg-error-secondary)';
export const CONFLICT_DOT_COLOR_FALLBACK = '#F04438';

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
const DISJOINT = 'disjointwith';

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
  const disjointLinks: Array<[string, string]> = [];
  edges.forEach(({ from, to, relationType }) => {
    const kind = normalize(relationType);
    if (kind === DISJOINT) {
      disjointLinks.push([from, to]);

      return;
    }
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
    const reported = new Set(conceptIds);
    // The rule itself is part of the clash: a disjoint link between two classes the clashing one
    // is (or inherits from), at least one of them a class the server reported.
    disjointLinks.forEach(([left, right]) => {
      if (
        above.has(left) &&
        above.has(right) &&
        (reported.has(left) || reported.has(right))
      ) {
        pairs.add(conflictEdgeKey({ from: left, to: right }));
      }
    });
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

// A name only counts as a whole word: "Customer" must not match inside "VipCustomer".
const NAME_EDGE = String.raw`[\p{L}\p{N}_-]`;

/** Matches any of the names as a whole word, longest first so a name that contains another wins. */
export const wholeNamePattern = (names: readonly string[]) => {
  const tokens = [...new Set(names.filter(Boolean))].sort(
    (left, right) => right.length - left.length
  );

  return tokens.length
    ? new RegExp(
        `(?<!${NAME_EDGE})(${tokens
          .map(escapeRegExp)
          .join('|')})(?!${NAME_EDGE})`,
        'gu'
      )
    : undefined;
};

/**
 * The server names concepts by their internal name (e.g. imported-Record-83334c7d…); people know
 * them by display name, so each name or IRI in a message is replaced with the concept's label.
 * One pass over whole names, so an inserted label is never rewritten again.
 */
export const toReadableViolationMessage = (
  message: string,
  concepts: ReadonlyArray<{ name: string; iri?: string; label: string }>
): string => {
  const labels = new Map<string, string>();
  concepts.forEach(({ name, iri, label }) =>
    [iri, name].forEach((token) => {
      if (token && token !== label && !labels.has(token)) {
        labels.set(token, label);
      }
    })
  );
  const pattern = wholeNamePattern([...labels.keys()]);

  return pattern
    ? message.replace(pattern, (token) => labels.get(token) ?? token)
    : message;
};
