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
import { GlobalSearchFilter } from './GlobalSearch.types';

interface GlobalSearchStore {
  isOpen: boolean;
  /** Where search was opened from; `chats` scopes the bar to chats only. */
  entry: GlobalSearchFilter;
  openSearch: (entry?: GlobalSearchFilter) => void;
  close: () => void;
}

/**
 * One switch for the AI-mode search modal so the sidebar, the keyboard
 * shortcuts and downstream plugins (e.g. a recent-chats header button) all
 * open the same instance.
 */
export const useGlobalSearchStore = create<GlobalSearchStore>()((set) => ({
  isOpen: false,
  entry: 'all',
  openSearch: (entry = 'all') => set({ isOpen: true, entry }),
  close: () => set({ isOpen: false }),
}));
