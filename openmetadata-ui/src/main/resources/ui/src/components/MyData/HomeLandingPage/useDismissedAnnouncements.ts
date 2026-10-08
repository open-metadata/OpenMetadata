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

const STORAGE_KEY_PREFIX = 'om-home-dismissed-announcements';

export const getDismissedAnnouncementsStorageKey = (userId: string) =>
  `${STORAGE_KEY_PREFIX}:${userId}`;

const readDismissed = (userId: string | undefined): Set<string> => {
  if (!userId) {
    return new Set();
  }
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(getDismissedAnnouncementsStorageKey(userId)) ?? '[]'
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

const writeDismissed = (userId: string | undefined, ids: Set<string>) => {
  if (!userId) {
    return;
  }
  const key = getDismissedAnnouncementsStorageKey(userId);
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
 * Announcements the user has dismissed from the Home rail, remembered per user
 * in `localStorage`.
 *
 * The announcements API has no per-user dismiss, so this is browser-local: a
 * dismissal holds across visits on this browser, not across devices. Keyed by
 * user id so a shared browser does not hand one user's dismissals to the next.
 *
 * `prune` drops ids the server no longer returns as live — expired or deleted
 * announcements can never reappear in the rail, so keeping their ids would
 * only grow the stored list for good.
 */
export const useDismissedAnnouncements = (userId: string | undefined) => {
  const [state, setState] = useState<DismissedState>(() => ({
    userId,
    ids: readDismissed(userId),
  }));

  // Re-read when the signed-in user changes. Adjusted during render rather
  // than in an effect so the previous user's set is never painted.
  let current = state;
  if (state.userId !== userId) {
    current = { userId, ids: readDismissed(userId) };
    setState(current);
  }

  const dismiss = useCallback((id: string) => {
    setState((prev) => {
      const ids = new Set(prev.ids).add(id);
      writeDismissed(prev.userId, ids);

      return { ...prev, ids };
    });
  }, []);

  const prune = useCallback((liveIds: string[]) => {
    const live = new Set(liveIds);
    setState((prev) => {
      const ids = new Set([...prev.ids].filter((id) => live.has(id)));
      if (ids.size === prev.ids.size) {
        return prev;
      }
      writeDismissed(prev.userId, ids);

      return { ...prev, ids };
    });
  }, []);

  return { dismissedIds: current.ids, dismiss, prune };
};
