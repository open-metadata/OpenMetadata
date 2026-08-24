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

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { InboxDateRange } from '../components/discovery/personal-space/InboxPage/inbox.utils';

/**
 * The Profile modal overlays the current AI page. This store tracks whether it's
 * open (opened from the user-name entry in the menu). No route change. (Triage /
 * My Data live on the routed /inbox page, not here.)
 */
export type PersonalSpacePanel = 'profile';

interface PersonalSpaceState {
  activePanel: PersonalSpacePanel | null;
  open: (panel: PersonalSpacePanel) => void;
  close: () => void;
  inboxDateRange: InboxDateRange | null;
  setInboxDateRange: (range: InboxDateRange) => void;
  // When the user last looked at the Inbox activity list. Feeds have no
  // server-side read state, so "unread" is derived from this mark.
  inboxActivitySeenTs: number | null;
  markInboxActivitySeen: () => void;
}

export const usePersonalSpaceStore = create<PersonalSpaceState>()(
  persist(
    (set) => ({
      activePanel: null,
      open: (panel) => set({ activePanel: panel }),
      close: () => set({ activePanel: null }),
      inboxDateRange: null,
      setInboxDateRange: (range) => set({ inboxDateRange: range }),
      inboxActivitySeenTs: null,
      markInboxActivitySeen: () => set({ inboxActivitySeenTs: Date.now() }),
    }),
    {
      name: 'ai-personal-space-store',
      storage: createJSONStorage(() => localStorage),
      // Only the seen-mark survives a reload. Persisting activePanel would
      // re-open the profile modal on load, and the date range is a per-session
      // filter choice.
      partialize: (state) => ({
        inboxActivitySeenTs: state.inboxActivitySeenTs,
      }),
    }
  )
);
