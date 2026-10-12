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
import { DEFAULT_DOMAIN_VALUE } from '../constants/constants';
import { APP_ROUTER_ROUTES } from '../constants/router.constants';
import { AuthenticationConfiguration } from '../generated/configuration/authenticationConfiguration';
import { AuthorizerConfiguration } from '../generated/configuration/authorizerConfiguration';
import { UIThemePreference } from '../generated/configuration/uiThemePreference';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/entity/type';
import { AuthenticationConfigurationWithScope } from '../interface/auth.interface';
import { EntityUnion } from '../interface/entity-union.interface';
import { ApplicationStore } from '../interface/store.interface';
import { authCoordinator } from '../utils/Auth/AuthCoordinator/AuthCoordinator';
import { isReauthRequiredError } from '../utils/Auth/AuthCoordinator/ReauthRequiredError';
import {
  EXPIRY_THRESHOLD_MILLES,
  extractDetailsFromToken,
} from '../utils/AuthProvider.util';
import { isDomainRestrictedUser } from '../utils/DomainRestrictionUtils';
import { getBasePath } from '../utils/HistoryUtils';
import {
  clearPersonaSession,
  readPersonaSession,
  writePersonaSession,
} from '../utils/PersonaSessionUtils';
import { getOidcToken } from '../utils/SwTokenStorageUtils';
import { getThemeConfig } from '../utils/ThemeUtils';
import { useDomainStore } from './useDomainStore';

// Routes where an identity-provider round trip finishes and the callback
// stores a fresh token of its own.
const LOGIN_CALLBACK_ROUTES: ReadonlySet<string> = new Set([
  APP_ROUTER_ROUTES.CALLBACK,
  APP_ROUTER_ROUTES.AUTH_CALLBACK,
]);

const isLoginCallbackRoute = (): boolean =>
  LOGIN_CALLBACK_ROUTES.has(
    globalThis.location.pathname.replace(getBasePath(), '')
  );

type AuthState = Pick<ApplicationStore, 'isAuthenticated' | 'isAuthenticating'>;

// Cold load with a stored token that is expired or inside the pre-expiry
// buffer: refresh it before the app renders as authenticated.
const resolveExpiredTokenState = async (): Promise<Partial<AuthState>> => {
  try {
    await authCoordinator.ensureFreshToken();

    return { isAuthenticated: true, isAuthenticating: false };
  } catch (error) {
    // After a ReauthRequiredError, AuthProvider's refresh-failed handler
    // either redirects to the identity provider (the loader must stay up
    // meanwhile, or /signin flashes before the page leaves) or signs the user
    // out, which settles isAuthenticating itself.
    return isReauthRequiredError(error)
      ? { isAuthenticated: false }
      : { isAuthenticated: false, isAuthenticating: false };
  }
};

const resolvePersonaFromSession = (user: User): EntityReference | undefined => {
  const storedId = readPersonaSession();
  if (!storedId) {
    return undefined;
  }

  const { defaultPersona, personas, inheritedPersonas } = user;

  // Partial API responses (e.g. a team-join PATCH) omit all persona fields.
  // Skip validation — and the stale-key clear — when none were returned so
  // we don't discard a still-valid selection.
  if (
    defaultPersona === undefined &&
    personas === undefined &&
    inheritedPersonas === undefined
  ) {
    return undefined;
  }

  const allPersonas = [
    ...(personas ?? []),
    ...(inheritedPersonas ?? []),
    ...(defaultPersona ? [defaultPersona] : []),
  ];

  const match = allPersonas.find((p) => p.id === storedId);
  if (!match) {
    clearPersonaSession();
  }

  return match;
};

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
      // MsalAuthenticator's handleRedirectPromise, SamlCallback) hasn't
      // stored the token yet. Every branch below must settle
      // `isAuthenticating`: nothing else clears it (see the setter map below
      // and `handleSuccessfulLogin`, which only touches
      // `isAuthenticated`/`isApplicationLoading`), and AppRouter's top-level
      // `if (isAuthenticating) return <Loader />` gate once kept SamlCallback
      // from ever mounting on /auth/callback, hanging confidential OIDC and
      // SAML logins.
      //
      // Signed-out rendering is safe on callback routes: OidcAuthenticator
      // owns its own <Route path="/callback"> that renders regardless of
      // childElement, and its OidcCallbackWrapper renders above the
      // catch-all `path="*"`, so no sign-in blink shows. /silent-callback is
      // served by its own HTML entry (`silent-callback.html`) rather than
      // the SPA shell, so this code path is never entered on that URL.

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

      // A login callback stores a fresh token of its own. The stored token is
      // the one that sent the user to the identity provider, and after a
      // silent re-authentication the server has already rejected it whether
      // or not its exp has passed. Signed-in rendering would leave the
      // callback unmounted: Okta's and Auth0's /callback and /auth/callback
      // exist only in the signed-out routes. Refreshing the token instead
      // would race the callback, and a second failure right after a silent
      // re-authentication reads as a dead session.
      if (isLoginCallbackRoute()) {
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

      // A missing / non-positive `exp` means the token is opaque, a
      // non-JWT, or an Unlimited bot JWT (the ingestion-bot's
      // JWTTokenExpiry.Unlimited path emits `.withExpiresAt(null)`, so
      // the payload has no `exp` claim at all). None of these are
      // refreshable proactively — treat them as usable and let the axios
      // interceptor drive a refresh on a real 401 if one ever arrives.
      // Same reasoning as AuthCoordinator.onTabVisible's exp guard.
      if (typeof exp !== 'number' || exp <= 0) {
        set({ isAuthenticated: true, isAuthenticating: false });

        return;
      }

      const isExpired = exp * 1000 - Date.now() < EXPIRY_THRESHOLD_MILLES;

      if (!isExpired) {
        set({ isAuthenticated: true, isAuthenticating: false });
        // Arm the proactive renewal timer now; it is otherwise armed only by
        // a completed refresh, leaving the first renewal to a request that
        // 401s.
        authCoordinator.syncFromStoredToken().catch(() => undefined);

        return;
      }

      set(await resolveExpiredTokenState());
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
    if (persona?.id) {
      writePersonaSession(persona.id);
    } else {
      clearPersonaSession();
    }
    set({ selectedPersona: persona });
  },

  setApplicationConfig: (config: UIThemePreference) => {
    set({ applicationConfig: config, theme: config.customTheme });
  },
  setCurrentUser: (user) => {
    set({
      currentUser: user,
      selectedPersona: resolvePersonaFromSession(user) ?? user.defaultPersona,
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
  setIsAuthenticating: (authenticating: boolean) => {
    set({ isAuthenticating: authenticating });
  },
  setIsSigningUp: (signingUp: boolean) => {
    set({ isSigningUp: signingUp });
  },

  setApplicationLoading: (loading: boolean) => {
    set({ isApplicationLoading: loading });
  },

  updateCurrentUser: (user) => {
    const { defaultPersona, personas, inheritedPersonas } = user;

    // Partial API responses (join-team PATCH etc.) omit all persona fields.
    // Don't touch the active selection — just record the updated user object.
    if (
      defaultPersona === undefined &&
      personas === undefined &&
      inheritedPersonas === undefined
    ) {
      set({ currentUser: user });
      syncDomainStoreForUser(user);

      return;
    }

    const { selectedPersona } = get();
    const allPersonas = [
      ...(personas ?? []),
      ...(inheritedPersonas ?? []),
      ...(defaultPersona ? [defaultPersona] : []),
    ];
    const isSelectedStillValid =
      selectedPersona && allPersonas.some((p) => p.id === selectedPersona.id);

    set({
      currentUser: user,
      selectedPersona:
        resolvePersonaFromSession(user) ??
        (isSelectedStillValid ? selectedPersona : defaultPersona),
    });

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
