/*
 *  Copyright 2024 Collate.
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

import { RecentlySearchedData, RecentlyViewedData } from 'Models';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { detectBrowserLanguage } from '../../utils/i18next/LocalUtil';
import { SupportedLocales } from '../../utils/i18next/LocalUtil.interface';
import { useApplicationStore } from '../useApplicationStore';

export interface UserPreferences {
  isSidebarCollapsed: boolean;
  language: SupportedLocales;
  selectedEntityTableColumns: Record<string, string[]>;
  recentlyViewed: RecentlyViewedData[];
  recentlySearched: RecentlySearchedData[];
}

interface Store {
  preferences: Record<string, UserPreferences>;
  setUserPreference: (
    userName: string,
    preferences: Partial<UserPreferences>
  ) => void;
  getUserPreference: (userName: string) => UserPreferences;
  clearUserPreference: (userName: string) => void;
}

const defaultPreferences: UserPreferences = {
  isSidebarCollapsed: false,
  language: detectBrowserLanguage(),
  selectedEntityTableColumns: {},
  recentlyViewed: [],
  recentlySearched: [],
  // Add default values for other preferences
};

export const usePersistentStorage = create<Store>()(
  persist(
    (set, get) => ({
      preferences: {},

      setUserPreference: (
        userName: string,
        newPreferences: Partial<UserPreferences>
      ) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            [userName]: {
              ...defaultPreferences,
              ...state.preferences[userName],
              ...newPreferences,
            },
          },
        }));
      },

      getUserPreference: (userName: string) => {
        const state = get();

        return state.preferences[userName] || defaultPreferences;
      },

      clearUserPreference: (userName: string) => {
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [userName]: _, ...rest } = state.preferences;

          return { preferences: rest };
        });
      },
    }),
    {
      name: 'user-preferences-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Hook to easily access current user's preferences
export const useCurrentUserPreferences = () => {
  const currentUser = useApplicationStore((state) => state.currentUser);
  const { preferences, setUserPreference } = usePersistentStorage();

  if (!currentUser?.name) {
    return {
      preferences: defaultPreferences,
      setPreference: () => {
        // update the user name in the local storage
      },
    };
  }

  return {
    preferences: preferences[currentUser.name] || defaultPreferences,
    setPreference: (newPreferences: Partial<UserPreferences>) =>
      setUserPreference(currentUser.name, newPreferences),
  };
};
