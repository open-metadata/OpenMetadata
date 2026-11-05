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
import { useCallback, useState } from 'react';
import { isTourMockActive } from '../../../rest/product-tour/productTourMock';

/**
 * Each Home surface keeps its own list, because each prunes against what *it*
 * shows: the rail lists asset announcements, the critical banner system ones,
 * and a shared list would let one prune the other's dismissals away.
 */
export enum DismissedAnnouncementsScope {
  Rail = 'om-home-dismissed-announcements',
  CriticalBanner = 'om-home-dismissed-critical-announcements',
}

export const getDismissedAnnouncementsStorageKey = (
  userId: string,
  scope = DismissedAnnouncementsScope.Rail
) => `${scope}:${userId}`;

const readDismissed = (
  userId: string | undefined,
  scope: DismissedAnnouncementsScope
): Set<string> => {
  if (!userId) {
    return new Set();
  }
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(
        getDismissedAnnouncementsStorageKey(userId, scope)
      ) ?? '[]'
    );

    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string')
        : []
    );
  } catch {
    return new Set();
  }
};

const writeDismissed = (
  userId: string | undefined,
  scope: DismissedAnnouncementsScope,
  ids: Set<string>
) => {
  if (!userId) {
    return;
  }
  const key = getDismissedAnnouncementsStorageKey(userId, scope);
  try {
    if (ids.size === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify([...ids]));
    }
  } catch {
    // Storage can be full or disabled (private mode); the dismissal still
    // holds for this visit, it just will not outlive it.
  }
};

interface DismissedState {
  userId: string | undefined;
  ids: Set<string>;
}

/**
 * Announcements the user has dismissed from a Home surface, remembered per user
 * and per surface (`scope`) in `localStorage`.
 *
 * The announcements API has no per-user dismiss, so this is browser-local: a
 * dismissal holds across visits on this browser, not across devices. Keyed by
 * user id so a shared browser does not hand one user's dismissals to the next.
 *
 * `prune` drops ids the server no longer returns as live — expired or deleted
 * announcements can never reappear on the surface, so keeping their ids would
 * only grow the stored list for good.
 */
export const useDismissedAnnouncements = (
  userId: string | undefined,
  scope = DismissedAnnouncementsScope.Rail
) => {
  const [state, setState] = useState<DismissedState>(() => ({
    userId,
    ids: readDismissed(userId, scope),
  }));

  // Re-read when the signed-in user changes. Adjusted during render rather
  // than in an effect so the previous user's set is never painted.
  let current = state;
  if (state.userId !== userId) {
    current = { userId, ids: readDismissed(userId, scope) };
    setState(current);
  }

  const dismiss = useCallback(
    (id: string) => {
      setState((prev) => {
        const ids = new Set(prev.ids).add(id);
        writeDismissed(prev.userId, scope, ids);

        return { ...prev, ids };
      });
    },
    [scope]
  );

  const prune = useCallback(
    (liveIds: string[]) => {
      // A product tour shows recorded announcements, not the live ones, so
      // pruning against them would forget the user's real dismissals.
      if (isTourMockActive()) {
        return;
      }
      const live = new Set(liveIds);
      setState((prev) => {
        const ids = new Set([...prev.ids].filter((id) => live.has(id)));
        if (ids.size === prev.ids.size) {
          return prev;
        }
        writeDismissed(prev.userId, scope, ids);

        return { ...prev, ids };
      });
    },
    [scope]
  );

  return { dismissedIds: current.ids, dismiss, prune };
};
