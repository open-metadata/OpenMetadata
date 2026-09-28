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

// Explicit precedence for the tab title, replacing helmet-async's mount-order rule.
export enum DocumentTitlePriority {
  SHELL = 0,
  PAGE = 1,
}

export interface DocumentTitleClaim {
  title: string;
  tabLabel?: string;
  priority: DocumentTitlePriority;
  // False while the claimant sits in a hidden kept-alive route.
  visible: boolean;
}

interface StoredClaim extends DocumentTitleClaim {
  // Registration order, fixed across updates; ties go to the deepest claim.
  seq: number;
}

export interface DocumentTitleStore {
  subscribe: (listener: () => void) => () => void;
  // The winning claim's title and tab label, or empty while nothing claims one.
  getSegments: () => readonly string[];
  set: (id: symbol, claim: DocumentTitleClaim) => void;
  remove: (id: symbol) => void;
}

const EMPTY_SEGMENTS: readonly string[] = [];

const isBetterClaim = (candidate: StoredClaim, current?: StoredClaim) => {
  if (!current) {
    return true;
  }

  return candidate.priority === current.priority
    ? candidate.seq > current.seq
    : candidate.priority > current.priority;
};

export const createDocumentTitleStore = (): DocumentTitleStore => {
  const claims = new Map<symbol, StoredClaim>();
  const listeners = new Set<() => void>();
  let nextSeq = 0;
  // Cached so useSyncExternalStore's identity comparison stays stable.
  let segments: readonly string[] = EMPTY_SEGMENTS;

  const resolve = () => {
    let winner: StoredClaim | undefined;
    claims.forEach((claim) => {
      if (claim.visible && isBetterClaim(claim, winner)) {
        winner = claim;
      }
    });

    return winner
      ? [winner.title, ...(winner.tabLabel ? [winner.tabLabel] : [])]
      : EMPTY_SEGMENTS;
  };

  const recompute = () => {
    const next = resolve();
    const hasChanged =
      next.length !== segments.length ||
      next.some((segment, index) => segment !== segments[index]);

    if (hasChanged) {
      segments = next;
      listeners.forEach((listener) => listener());
    }
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    getSegments: () => segments,
    set: (id, claim) => {
      if (!claim.title) {
        claims.delete(id);
      } else {
        claims.set(id, { ...claim, seq: claims.get(id)?.seq ?? nextSeq++ });
      }
      recompute();
    },
    remove: (id) => {
      if (claims.delete(id)) {
        recompute();
      }
    },
  };
};
