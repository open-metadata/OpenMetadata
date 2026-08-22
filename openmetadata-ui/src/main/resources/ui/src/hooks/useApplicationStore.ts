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
import { DEFAULT_DOMAIN_VALUE } from '../constants/constants';
import { APP_ROUTER_ROUTES } from '../constants/router.constants';
import { AuthenticationConfiguration } from '../generated/configuration/authenticationConfiguration';
import { AuthorizerConfiguration } from '../generated/configuration/authorizerConfiguration';
import { UIThemePreference } from '../generated/configuration/uiThemePreference';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/entity/type';
import { ApplicationStore } from '../interface/store.interface';
import { authCoordinator } from '../utils/Auth/AuthCoordinator';
import {
  EXPIRY_THRESHOLD_MILLES,
  extractDetailsFromToken,
} from '../utils/AuthProvider.util';
import { isDomainRestrictedUser } from '../utils/DomainRestrictionUtils';
import { getOidcToken } from '../utils/SwTokenStorageUtils';
import { getThemeConfig } from '../utils/ThemeUtils';
import { useDomainStore } from './useDomainStore';

const syncDomainStoreForUser = (user?: User) => {
  const domainStore = useDomainStore.getState();
  const userDomains = user?.domains ?? [];
  const isRestricted = isDomainRestrictedUser(user);

  domainStore.setUserDomains(userDomains);
  domainStore.setDomainRestriction(isRestricted);

  const hasSingleDomain = isRestricted && userDomains.length === 1;
  const isDefaultDomainActive =
    domainStore.activeDomain === DEFAULT_DOMAIN_VALUE;

  if (hasSingleDomain && isDefaultDomainActive) {
    domainStore.updateActiveDomain(userDomains[0]);
  }
};

export const useApplicationStore = create<ApplicationStore>()((set, get) => ({
  isApplicationLoading: false,
  isAuthenticating: true, // Loading until auth state is determined
  theme: getThemeConfig(),
  applicationConfig: {
    customTheme: getThemeConfig(),
  } as UIThemePreference,
  currentUser: undefined,
  newUser: undefined,
  isAuthenticated: false,
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
  applicationsLoaded: false,
  appPreferences: {},
  appVersion: undefined,
  rdfEnabled: false,

  initializeAuthState: async () => {
    try {
      // OAuth-callback races: on a fresh redirect back into the app the
      // authenticator's own handler (OidcAuthenticator's <Callback>,
      // MsalAuthenticator's handleRedirectPromise, GenericAuthenticator's
      // SAML callback) hasn't stored the token yet when AppRoot fires
      // initializeAuthState. Flipping isAuthenticating=false here would
      // reveal /signin for a frame until handleSuccessfulLogin flips
      // isAuthenticated back true — the "sign-in blink". Bail early on
      // callback routes and let the authenticator drive the state.
      const path = window.location.pathname;
      if (
        path === APP_ROUTER_ROUTES.CALLBACK ||
        path === APP_ROUTER_ROUTES.AUTH_CALLBACK ||
        path === APP_ROUTER_ROUTES.SILENT_CALLBACK
      ) {
        return;
      }

      let token = '';

      if ('serviceWorker' in navigator && 'indexedDB' in window) {
        try {
          token = await getOidcToken();
        } catch {
          try {
            // Wait for the service worker to be ready before getting the token
            const { waitForServiceWorkerReady } = await import(
              '../utils/SwMessenger'
            );
            await waitForServiceWorkerReady();
            token = await getOidcToken();
          } catch {
            token = '';
          }
        }
      } else {
        token = '';
      }

      if (!token) {
        set({ isAuthenticated: false, isAuthenticating: false });

        return;
      }

      // A cold-load token can be present but already past (or within a
      // buffer of) its expiry — treating it as authenticated let the app
      // render with a dead token and fail the first API call with a 401
      // that never triggered silent refresh (Bug 1). Refresh it up front
      // via the coordinator so `isAuthenticated` only flips true once a
      // usable token is guaranteed.
      const { exp } = extractDetailsFromToken(token);
      const isExpired =
        !exp || exp * 1000 - Date.now() < EXPIRY_THRESHOLD_MILLES;

      if (!isExpired) {
        set({ isAuthenticated: true, isAuthenticating: false });

        return;
      }

      try {
        await authCoordinator.ensureFreshToken();
        set({ isAuthenticated: true, isAuthenticating: false });
      } catch {
        set({ isAuthenticated: false, isAuthenticating: false });
      }
    } catch {
      set({
        isAuthenticated: false,
        isAuthenticating: false,
      });
    }
  },

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
    const { defaultPersona } = user;

    // Update the current user
    set({
      currentUser: user,
      selectedPersona: defaultPersona,
    });

    syncDomainStoreForUser(user);
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
    if (defaultPersona) {
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

    syncDomainStoreForUser(user);
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
  setApplicationsLoaded: (loaded: boolean) => {
    set({ applicationsLoaded: loaded });
  },
  setAppVersion: (version: string) => {
    set({ appVersion: version });
  },
  setRdfEnabled: (enabled: boolean) => {
    set({ rdfEnabled: enabled });
  },
}));
