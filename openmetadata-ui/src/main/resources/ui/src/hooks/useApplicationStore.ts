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
import { create } from 'zustand';
import { AuthenticationConfigurationWithScope } from '../components/Auth/AuthProviders/AuthProvider.interface';
import { EntityUnion } from '../components/Explore/ExplorePage.interface';
import { TabSpecificField } from '../enums/entity.enum';
import { AuthenticationConfiguration } from '../generated/configuration/authenticationConfiguration';
import { AuthorizerConfiguration } from '../generated/configuration/authorizerConfiguration';
import { UIThemePreference } from '../generated/configuration/uiThemePreference';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/entity/type';
import { Include } from '../generated/type/include';
import { ApplicationStore } from '../interface/store.interface';
import { getUserById } from '../rest/userAPI';
import { getOidcToken } from '../utils/LocalStorageUtils';
import { getThemeConfig } from '../utils/ThemeUtils';

export const OM_SESSION_KEY = 'om-session';

export const useApplicationStore = create<ApplicationStore>()((set, get) => ({
  isApplicationLoading: false,
  theme: getThemeConfig(),
  applicationConfig: {
    customTheme: getThemeConfig(),
  } as UIThemePreference,
  currentUser: undefined,
  newUser: undefined,
  isAuthenticated: Boolean(getOidcToken()),
  authConfig: undefined,
  authorizerConfig: undefined,
  isSigningUp: false,
  jwtPrincipalClaims: [],
  jwtPrincipalClaimsMapping: [],
  userProfilePics: {},
  cachedEntityData: {},
  selectedPersona: undefined,
  searchCriteria: '',
  inlineAlertDetails: undefined,
  applications: [],
  appPreferences: {},
  appVersion: undefined,

  setInlineAlertDetails: (inlineAlertDetails) => {
    set({ inlineAlertDetails });
  },

  setSelectedPersona: (persona: EntityReference | undefined) => {
    set({ selectedPersona: persona });
  },

  setApplicationConfig: (config: UIThemePreference) => {
    set({ applicationConfig: config, theme: config.customTheme });
  },
  setCurrentUser: (user) => {
    const { personas, defaultPersona } = user;
    // Update selected Persona to fetch the customized pages
    if (defaultPersona && personas?.find((p) => p.id === defaultPersona.id)) {
      set({ selectedPersona: defaultPersona });
    }

    // Update the current user
    set({ currentUser: user });
  },
  setAuthConfig: (authConfig: AuthenticationConfigurationWithScope) => {
    set({ authConfig });
  },
  setAuthorizerConfig: (authorizerConfig: AuthorizerConfiguration) => {
    set({ authorizerConfig });
  },
  setJwtPrincipalClaims: (
    claims: AuthenticationConfiguration['jwtPrincipalClaims']
  ) => {
    set({ jwtPrincipalClaims: claims });
  },
  setJwtPrincipalClaimsMapping: (
    claimMapping: AuthenticationConfiguration['jwtPrincipalClaimsMapping']
  ) => {
    set({ jwtPrincipalClaimsMapping: claimMapping });
  },
  setIsAuthenticated: (authenticated: boolean) => {
    set({ isAuthenticated: authenticated });
  },
  setIsSigningUp: (signingUp: boolean) => {
    set({ isSigningUp: signingUp });
  },

  setApplicationLoading: (loading: boolean) => {
    set({ isApplicationLoading: loading });
  },

  updateCurrentUser: (user) => {
    const { personas, defaultPersona } = user;
    const { selectedPersona } = get();
    // Update selected Persona to fetch the customized pages
    if (defaultPersona && personas?.find((p) => p.id === defaultPersona.id)) {
      set({ selectedPersona: defaultPersona });
    }
    // Update selected Persona if Persona is not in the list of personas
    if (
      selectedPersona &&
      !personas?.find((p) => p.id === selectedPersona.id)
    ) {
      set({ selectedPersona: undefined });
    }

    set({ currentUser: user });
  },
  updateUserProfilePics: ({ id, user }: { id: string; user: User }) => {
    set({
      userProfilePics: { ...get()?.userProfilePics, [id]: user },
    });
  },
  updateCachedEntityData: ({
    id,
    entityDetails,
  }: {
    id: string;
    entityDetails: EntityUnion;
  }) => {
    set({
      cachedEntityData: {
        ...get()?.cachedEntityData,
        [id]: entityDetails,
      },
    });
  },
  updateNewUser: (user) => {
    set({ newUser: user });
  },
  setAppPreferences: (
    preferences: Partial<ApplicationStore['appPreferences']>
  ) => {
    set((state) => ({
      appPreferences: {
        ...state.appPreferences,
        ...preferences,
      },
    }));
  },
  updateSearchCriteria: (criteria) => {
    set({ searchCriteria: criteria });
  },
  setApplicationsName: (applications: string[]) => {
    set({ applications: applications });
  },
  setAppVersion: (version: string) => {
    set({ appVersion: version });
  },
  refetchCurrentUser: async (params?: {
    fields?: TabSpecificField[];
    include?: Include;
  }) => {
    try {
      const { currentUser, selectedPersona } = get();
      if (currentUser) {
        const user = await getUserById(currentUser.id, {
          fields: params?.fields ?? [
            TabSpecificField.PROFILE,
            TabSpecificField.ROLES,
            TabSpecificField.TEAMS,
            TabSpecificField.PERSONAS,
            TabSpecificField.LAST_ACTIVITY_TIME,
            TabSpecificField.LAST_LOGIN_TIME,
            TabSpecificField.DEFAULT_PERSONA,
            TabSpecificField.DOMAINS,
          ],
          include: params?.include ?? Include.All,
        });

        const updateSelectedPersona = user.personas?.find(
          (p) => p.id === selectedPersona?.id
        );

        set({
          currentUser: { ...currentUser, ...user },
          selectedPersona: updateSelectedPersona,
        });
      }
    } catch {
      return;
    }
  },
}));
