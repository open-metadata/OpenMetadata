/*
 *  Copyright 2022 Collate.
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

import { removeSession } from '@analytics/session-utils';
import type {
  Configuration,
  IPublicClientApplication,
} from '@azure/msal-browser';
import {
  AxiosError,
  AxiosRequestHeaders,
  InternalAxiosRequestConfig,
} from 'axios';
import { CookieStorage } from 'cookie-storage';
import { isNil } from 'lodash';
import type { WebStorageStateStore } from 'oidc-client';
import {
  ComponentType,
  createContext,
  Fragment,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  APP_ROUTER_ROUTES as ROUTES,
  REDIRECT_PATHNAME,
} from '../../../constants/router.constants';
import { TabSpecificField } from '../../../enums/entity.enum';
import {
  AuthenticationConfiguration,
  ClientType,
} from '../../../generated/configuration/authenticationConfiguration';
import { User } from '../../../generated/entity/teams/user';
import { AuthProvider as AuthProviderEnum } from '../../../generated/settings/settings';
import { withActivePersonaHeader } from '../../../hoc/withActivePersonaHeader';
import { withDomainFilter } from '../../../hoc/withDomainFilter';
import { withLanguageHeader } from '../../../hoc/withLanguageHeader';
import {
  derivePreferencesFromList,
  hydrateBackendSyncedPreferences,
  resetBackendSyncState,
} from '../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  clearAppMode,
  isAppModeHintFresh,
  readAppModeHint,
  readAppModeSession,
  resolveEffectiveAppMode,
  resolvePersonaAppMode,
  setAppDefaultMode,
  translatePreferenceMode,
  translateWireMode,
  writeAppMode,
} from '../../../hooks/useAppMode';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useExploreCache } from '../../../hooks/useExploreCache';
import { queryClient } from '../../../queryClient';
import axiosClient from '../../../rest';
import { getDocumentByFQN } from '../../../rest/DocStoreAPI';
import { clearEtagCache } from '../../../rest/etagInterceptor';
import {
  fetchAuthenticationConfig,
  fetchAuthorizerConfig,
} from '../../../rest/miscAPI';
import { personaDocFqn } from '../../../rest/queries/docStoreQuery';
import { getAppConfiguration } from '../../../rest/settingConfigAPI';
import { getLoggedInUser, getUserPreferences } from '../../../rest/userAPI';
import applicationRoutesClass from '../../../utils/ApplicationRoutesClassBase';
import { authCoordinator } from '../../../utils/Auth/AuthCoordinator';
import {
  getAuthConfig,
  getUrlPathnameExpiry,
  getUserManagerConfig,
  isRefreshableAuthError,
  prepareUserProfileFromClaims,
  validateAuthFieldsDetailed,
} from '../../../utils/AuthProvider.util';
import { clearPersonaSession } from '../../../utils/PersonaSessionUtils';
import {
  clearOidcToken,
  getOidcToken,
} from '../../../utils/SwTokenStorageUtils';
import { showErrorToast, showInfoToast } from '../../../utils/ToastUtils';
import { checkIfUpdateRequired } from '../../../utils/UserDataUtils';
import { resetWebAnalyticSession } from '../../../utils/WebAnalyticsUtils';
import Loader from '../../common/Loader/Loader';
import {
  LazyAuth0Authenticator,
  LazyBasicAuthAuthenticator,
  LazyGenericAuthenticator,
  LazyMsalAuthenticator,
  LazyOidcAuthenticator,
  LazyOktaAuthenticator,
} from '../AppAuthenticators/LazyAuthenticators';
import {
  AuthenticationConfigurationWithScope,
  AuthenticatorRef,
  OidcUser,
} from './AuthProvider.interface';
import {
  LazyAuth0ProviderWrapper,
  LazyBasicAuthProviderWrapper,
  LazyMsalProviderWrapper,
  LazyOktaAuthProviderWrapper,
} from './LazyAuthProviderWrappers';

interface AuthProviderProps {
  childComponentType: ComponentType;
  children: ReactNode;
}

const cookieStorage = new CookieStorage();

const userAPIQueryFields = [
  TabSpecificField.PROFILE,
  TabSpecificField.TEAMS,
  TabSpecificField.ROLES,
  TabSpecificField.PERSONAS,
  TabSpecificField.DEFAULT_PERSONA,
  TabSpecificField.DOMAINS,
];

const isEmailVerifyField = 'isEmailVerified';

/**
 * Boot-time app-mode plumbing, run once `currentUser` is known (both the
 * returning-session path and the fresh-login path need it). Fetches the
 * user's own preferences bag and the tenant-wide app-mode default in
 * parallel — neither depends on the other, only on `user.id` being
 * resolved already, so a true 3-way `Promise.all` alongside
 * `getLoggedInUser` isn't possible (the preferences fetch needs the id
 * `getLoggedInUser` itself returns).
 *
 * Hydrates the local preferences store from the server (or migrates a
 * local-only value up, on first boot after this feature ships), then
 * resolves and writes the effective app mode via the fallback chain:
 * user preference -> persona -> tenant default -> `DEFAULT_APP_MODE`.
 *
 * Persona resolution is authoritative at boot: when the chain actually
 * needs to run (no sticky session tuple, no fresh cross-tab hint) we
 * fetch the persona's UICustomization doc and translate its forced
 * `appMode` via {@link resolvePersonaAppMode}. This replaces the
 * now-deleted `useResolvedAppMode` hook, which used to refine the mode
 * asynchronously after boot — there is no post-boot resolver anymore, so
 * the write below is final rather than provisional.
 */
const hydrateAndResolveAppMode = async (user: User): Promise<void> => {
  const [prefsRes, appConfig] = await Promise.all([
    getUserPreferences(user.id).catch(() => ({ preferences: [] })),
    getAppConfiguration().catch(() => null),
  ]);
  hydrateBackendSyncedPreferences(user, prefsRes);

  const appDefault = translateWireMode(appConfig?.defaultAppMode ?? null);
  setAppDefaultMode(appDefault);

  // Skip the boot-time write when this tab already has a stickier
  // signal:
  //
  //   1. A session tuple this tab already owns from a manual toggle or a
  //      prior resolve (`source !== 'boot'`) — the user's active in-tab
  //      choice wins over persona / preference. A `'boot'` tuple from an
  //      earlier auth cycle is NOT sticky and should be re-resolved, so
  //      don't skip on that.
  //   2. A fresh cross-tab `omAppModeHint` — the mechanism by which a
  //      sibling tab's active mode carries into a newly-opened tab
  //      (cmd+click). We still need to seed THIS tab's store from that
  //      hint (module init deliberately never reads the hint, so the
  //      store is at `DEFAULT_APP_MODE` here), but we must not run the
  //      persona/preference chain — the sibling's active choice wins.
  const existingSession = readAppModeSession();
  if (existingSession?.mode && existingSession.source !== 'boot') {
    return;
  }
  const hint = readAppModeHint();
  if (isAppModeHintFresh(hint) && hint?.mode) {
    // Adopt the sibling tab's mode so this new tab renders the right
    // shell. `source: 'boot'` keeps the tuple re-resolvable on the next
    // reload and skips re-writing the hint (no self-leak).
    writeAppMode(hint.mode, null, { source: 'boot' });

    return;
  }

  // `appMode` off the wire is the preference's WIRE token ("classic" /
  // "ai" / legacy "ai"), not the runtime mode string — translate
  // before feeding it into the resolver. See `translatePreferenceMode` in
  // `useAppMode.ts` (#31906 follow-up: the switcher's remember checkbox
  // writes the wire token, so the boot read must undo that translation).
  const userPref = translatePreferenceMode(
    derivePreferencesFromList(prefsRes.preferences).appMode ?? null
  );

  // Persona precedence: only fetched here (not in the Promise.all above)
  // so a returning tab that short-circuits on its session tuple / hint
  // pays no persona-doc round-trip. Best-effort — a failed fetch or a
  // persona with no forced `appMode` yields `null` and the chain falls
  // through to userPref / tenant default.
  const personaFqn = personaDocFqn(user.defaultPersona ?? null);
  const personaDoc = personaFqn
    ? await getDocumentByFQN(personaFqn).catch(() => undefined)
    : undefined;
  const personaMode = resolvePersonaAppMode(
    personaDoc,
    user.defaultPersona?.id
  );

  // Final boot write — persona is now known, so this is the authoritative
  // mode (the old async `useResolvedAppMode` refinement is gone). Marked
  // `source: 'boot'` so it stays re-resolvable on the next reload (a later
  // persona-doc edit takes effect) while a manual toggle's `'manual'`
  // tuple remains sticky. The `writeHint` inside `writeAppMode` is skipped
  // for `'boot'` writes so this doesn't leak to sibling tabs as an
  // authoritative hint.
  writeAppMode(
    resolveEffectiveAppMode(userPref, personaMode, appDefault),
    personaMode,
    { source: 'boot' }
  );
};

let requestInterceptor: number | null = null;

type AuthContextType = {
  onLoginHandler: () => void;
  onLogoutHandler: () => void;
  handleSuccessfulLogin: (user: OidcUser) => Promise<void>;
  handleFailedLogin: () => void;
  handleSuccessfulLogout: () => void;
  updateAxiosInterceptors: () => void;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({
  childComponentType,
  children,
}: AuthProviderProps) => {
  const {
    setCurrentUser,
    updateNewUser: setNewUserProfile,
    setIsAuthenticated,
    authConfig,
    setAuthConfig,
    setAuthorizerConfig,
    setIsSigningUp,
    authorizerConfig,
    jwtPrincipalClaims,
    jwtPrincipalClaimsMapping,
    setJwtPrincipalClaims,
    setJwtPrincipalClaimsMapping,
    isApplicationLoading,
    setApplicationLoading,
    isAuthenticating,
  } = useApplicationStore();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [msalInstance, setMsalInstance] = useState<IPublicClientApplication>();
  // False when `validateAuthFieldsDetailed` flagged any required field
  // as missing on the last `fetchAuthConfig` run. Used to short-circuit
  // the Azure-specific `!msalInstance` gate below — with an empty
  // clientId MSAL's PublicClientApplication.initialize() rejects and
  // `msalInstance` never sets, so the whole shell would sit on Loader.
  // Falling through to `getProtectedApp()` renders SignInPage instead
  // (matches the invalid-config path every other provider already takes).
  const [hasValidConfig, setHasValidConfig] = useState<boolean>(true);

  const authenticatorRef = useRef<AuthenticatorRef>(null);

  const userConfig = useMemo(
    () =>
      authConfig
        ? getUserManagerConfig(authConfig)
        : ({} as Record<string, string | boolean | WebStorageStateStore>),
    [authConfig]
  );

  const clientType = authConfig?.clientType ?? ClientType.Public;

  const onLoginHandler = () => {
    setApplicationLoading(true);

    let attempts = 0;
    const maxAttempts = 100;

    const invokeLogin = () => {
      if (authenticatorRef.current) {
        authenticatorRef.current.invokeLogin?.();
        resetWebAnalyticSession();
      } else if (attempts < maxAttempts) {
        // Polling mechanism to wait for authenticator ref to be available.
        // This handles race conditions in production builds where onLoginHandler
        // may be called before the authenticator component has mounted and set the ref.
        // Retry every 50ms until ref is available (max 100 attempts = 5 seconds).
        attempts++;
        setTimeout(invokeLogin, 50);
      } else {
        // Max attempts reached, stop loading and silently fail
        setApplicationLoading(false);
      }
    };

    invokeLogin();
  };

  // Handler to perform logout within application
  const onLogoutHandler = useCallback(async () => {
    try {
      // Let SSO complete the logout process. Swallow failures so local
      // cleanup always runs — a rejected OIDC end-session call must not
      // leave the user half-logged-out with a stale persona session key.
      await authenticatorRef.current?.invokeLogout();
    } catch {
      // SSO logout failed; proceed with local cleanup anyway
    }

    clearPersonaSession();

    setIsAuthenticated(false);

    // reset the user details on logout
    setCurrentUser({} as User);

    // remove analytics session on logout
    removeSession();

    // Clear tokens properly during logout
    await clearOidcToken();

    // Drop every in-memory client-side cache keyed by the current principal so the next user
    // that signs in within this SPA session cannot see the previous user's cached responses.
    // The app navigates to /signin without a hard reload, so global Zustand / module-level
    // caches would otherwise survive across users.
    //
    // Three caches need clearing:
    //   * useExploreCache — SWR cache for Explore search results (Zustand store)
    //   * clearEtagCache() — ETag interceptor's response cache; without it, a freshly-
    //     authenticated user could pick up another principal's cached body via 304.
    //   * queryClient.clear() — React Query cache. Entries are keyed without the principal
    //     in the key (auth comes from the Authorization header), so without an explicit
    //     clear the next user would see the previous user's bodies until staleTime + gcTime.
    useExploreCache.getState().clearCache();
    clearEtagCache();
    queryClient.clear();

    // Drop the tab-scoped app-mode session so the next user boots into
    // their own persona/preference-resolved mode rather than inheriting
    // this user's transient mode.
    clearAppMode();

    // Reset the debounced backend-sync bookkeeping so a pending PATCH
    // from user A cannot be flushed with user B's value/id when the SPA
    // logs out + back in within the 300ms window.
    resetBackendSyncState();

    setApplicationLoading(false);

    // Upon logout, redirect to the login page
    navigate(ROUTES.SIGNIN);
  }, []);

  const handledVerifiedUser = () => {
    if (!applicationRoutesClass.isProtectedRoute(location.pathname)) {
      // Route to `/` and let the (mode-specific) route tree render its
      // own landing page. Rendering in place at `/` is provider-agnostic
      // and lets non-default app modes (e.g. AskCollate's AI) own their
      // own landing page without racing an early client-side redirect.
      navigate(ROUTES.HOME);
    }
  };

  /**
   * Stores redirect URL for successful login
   */
  const storeRedirectPath = useCallback((path?: string) => {
    if (!path) {
      return;
    }
    cookieStorage.setItem(REDIRECT_PATHNAME, path, {
      expires: getUrlPathnameExpiry(),
      path: '/',
    });
  }, []);

  // Tracks the CURRENT pathname for `handleStoreProtectedRedirectPath` below.
  // That callback is captured once by `authCoordinator.install` in the
  // mount-only effect further down, so it must read the pathname via a ref
  // rather than closing over `location.pathname` directly — otherwise a 401
  // firing after any client-side navigation would store the pathname from
  // the FIRST render instead of the page the user is actually on (see the
  // install effect's comment for why the callback identity itself must stay
  // stable). `window.location.pathname` isn't a substitute here: unlike
  // `location` (from `useCustomLocation`), it isn't stripped of the
  // deploy-time base path, so it would mismatch what `isProtectedRoute` and
  // the post-login `navigate(urlPathname)` call both expect.
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  /**
   * Stores redirect URL for successful login
   */
  const handleStoreProtectedRedirectPath = useCallback(() => {
    if (applicationRoutesClass.isProtectedRoute(pathnameRef.current)) {
      storeRedirectPath(pathnameRef.current);
    }
  }, [storeRedirectPath]);

  const resetUserDetails = (forceLogout = false) => {
    clearPersonaSession();
    setCurrentUser({} as User);
    clearOidcToken();
    setIsAuthenticated(false);
    setApplicationLoading(false);
    if (forceLogout) {
      onLogoutHandler();
      showInfoToast(t('message.session-expired'));
    } else {
      navigate(ROUTES.SIGNIN);
    }
  };

  const getLoggedInUserDetails = async () => {
    setApplicationLoading(true);
    try {
      // Bug 1: on cold-load with an expired token, /loggedInUser 401s and
      // the AuthCoordinator's axios response interceptor drives a refresh.
      // Each authenticator registers its renewer from its own mount effect
      // (see the corresponding *Authenticator.tsx), so the coordinator has
      // a renewer as soon as the lazy authenticator mounts — no race with
      // the first 401. This catch just needs to make sure we don't swallow
      // the recovered response — the interceptor drains the queued request
      // itself and getLoggedInUser resolves normally on success.
      const res = await getLoggedInUser({ fields: userAPIQueryFields });
      if (res) {
        setCurrentUser(res);
        setIsAuthenticated(true);
        await hydrateAndResolveAppMode(res);
      } else {
        resetUserDetails();
      }
    } catch (error) {
      const err = error as AxiosError;
      const status = err.response?.status ?? 0;
      const url = err.config?.url ?? '';

      // A 401 the AuthCoordinator can silently refresh must propagate to its
      // axios response interceptor instead of being swallowed here — the old
      // unconditional `resetUserDetails()` bounced the user straight to
      // /signin on a cold-load expired token instead of ever attempting a
      // silent refresh (Bug 1). `resetUserDetails` still runs, but only via
      // the coordinator's `refresh-failed` event if `ensureFreshToken` itself
      // rejects (see the mount effect above).
      if (isRefreshableAuthError(status, url, err.response?.data)) {
        throw error;
      }

      resetUserDetails();
      if (status !== 404) {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.logged-in-user-lowercase'),
          })
        );
      }
    } finally {
      setApplicationLoading(false);
    }
  };

  // Renewer registration for the AuthCoordinator lives in each authenticator's
  // own mount effect (BasicAuthAuthenticator, GenericAuthenticator,
  // OidcAuthenticator, MsalAuthenticator, OktaAuthenticator,
  // Auth0Authenticator). Doing it there — instead of via a parent-side effect
  // that reads authenticatorRef.current?.getRenewer — avoids a race: ref
  // changes don't schedule a re-render, so a parent-side effect keyed on the
  // ref can register late (or never, on some render paths). Each authenticator
  // knows exactly when its useImperativeHandle has run and owns the register/
  // unregister lifecycle for its own renewer.

  // Installs the coordinator's axios response interceptor and mirrors its
  // outcome into React state (auth-coordinator-refactor Task 12 — Bug 2 fix).
  // The coordinator owns 401 detection, the refresh call, cross-tab
  // coordination, and the same-tab proactive timer (previously duplicated
  // here via `pendingRequests`/`isRefreshDriverActive`/`startTokenExpiryTimer`/
  // a local `visibilitychange` listener — all deleted, including the hotfix
  // v2 visibility guard from #31819 which the coordinator's VisibilityWatcher
  // now handles more thoroughly). Without the `refreshed` subscription, a
  // silent refresh would update storage but never tell the router the user
  // was authenticated again, so a route guard reading stale `isAuthenticated`
  // kept bouncing to /signin even though the retried request had already
  // succeeded.
  //
  // `handleStoreProtectedRedirectPath` is passed as the third argument so it
  // fires the moment a 401 kicks off a refresh cycle — matching the timing
  // of the old inline interceptor. Without it, a user bounced to /signin
  // after a failed refresh loses their current URL and lands on the default
  // page after re-login instead of back where they were.
  useEffect(() => {
    const disposeInterceptor = authCoordinator.install(
      axiosClient,
      isRefreshableAuthError,
      handleStoreProtectedRedirectPath
    );
    const offRefreshed = authCoordinator.on('refreshed', () => {
      setIsAuthenticated(true);
    });
    const offFailed = authCoordinator.on('refresh-failed', () => {
      resetUserDetails(true);
    });

    return () => {
      disposeInterceptor();
      offRefreshed();
      offFailed();
    };
  }, []);

  const handleFailedLogin = () => {
    setIsSigningUp(false);
    setIsAuthenticated(false);
    setApplicationLoading(false);
    navigate(ROUTES.SIGNIN);
  };

  const handleSuccessfulLogin = useCallback(
    async (user: OidcUser) => {
      setApplicationLoading(true);
      setIsAuthenticated(true);
      const fields =
        authConfig?.provider === AuthProviderEnum.Basic
          ? userAPIQueryFields + ',' + isEmailVerifyField
          : userAPIQueryFields;
      try {
        const newUser = prepareUserProfileFromClaims({
          user,
          jwtPrincipalClaims,
          principalDomain: authorizerConfig?.principalDomain ?? '',
          jwtPrincipalClaimsMapping,
          clientType,
        });

        const res = await getLoggedInUser({ fields });
        if (res) {
          const userDetails = await checkIfUpdateRequired(res, newUser);
          setCurrentUser(userDetails);
          await hydrateAndResolveAppMode(userDetails);

          handledVerifiedUser();
        }
      } catch (error) {
        const err = error as AxiosError;
        if (err?.response?.status === 404) {
          if (authConfig?.enableSelfSignup) {
            setNewUserProfile(user.profile);
            setCurrentUser({} as User);
            setIsSigningUp(true);
            navigate(ROUTES.SIGNUP);
          } else {
            resetUserDetails();
            navigate(ROUTES.UNAUTHORISED);
            showErrorToast(err);
          }
        } else {
          // eslint-disable-next-line no-console
          console.error(err);
          showErrorToast(err);
          resetUserDetails();
          navigate(ROUTES.SIGNIN);
        }
      } finally {
        setApplicationLoading(false);
      }
    },
    [
      authConfig?.enableSelfSignup,
      clientType,
      authorizerConfig?.principalDomain,
      jwtPrincipalClaims,
      jwtPrincipalClaimsMapping,
      setIsSigningUp,
      setIsAuthenticated,
      setApplicationLoading,
      setCurrentUser,
      setNewUserProfile,
    ]
  );

  const updateAuthInstance = async (
    configJson: AuthenticationConfiguration
  ) => {
    const { provider, ...otherConfigs } = configJson;
    if (provider === AuthProviderEnum.Azure) {
      const AzureBrowser = await import('@azure/msal-browser');
      const { PublicClientApplication } = AzureBrowser;
      const instance = new PublicClientApplication(
        otherConfigs as unknown as Configuration
      );

      // Need to initialize the instance before setting it
      await instance.initialize();

      setMsalInstance(instance);
    }
  };

  /**
   * Initialize the Axios request interceptor to attach Bearer tokens (and
   * the language/persona/domain headers) to every outgoing request. This
   * should be called only when security is enabled.
   *
   * The response side (401 detection + silent refresh) is no longer owned
   * here — it's installed once by the AuthCoordinator (see the mount effect
   * below), which also handles cross-tab coordination and the proactive
   * refresh timer.
   */
  const initializeAxiosInterceptors = async () => {
    // Axios Request interceptor to add Bearer tokens in Header
    if (requestInterceptor != null) {
      axiosClient.interceptors.request.eject(requestInterceptor);
    }

    requestInterceptor = axiosClient.interceptors.request.use(async function (
      config: InternalAxiosRequestConfig<unknown>
    ) {
      // Need to read token from local storage as it might have been updated with refresh
      const token: string = await getOidcToken();
      if (token) {
        if (config.headers) {
          config.headers['Authorization'] = `Bearer ${token}`;
        } else {
          config.headers = {
            Authorization: `Bearer ${token}`,
          } as AxiosRequestHeaders;
        }
      }

      if (config.method === 'patch' && config.headers) {
        config.headers['Content-type'] = 'application/json-patch+json';
      }

      return withLanguageHeader(
        withActivePersonaHeader(withDomainFilter(config))
      );
    });
  };

  const fetchAuthConfig = async () => {
    try {
      const [authConfig, authorizerConfig] = await Promise.all([
        fetchAuthenticationConfig(),
        fetchAuthorizerConfig(),
      ]);
      if (!isNil(authConfig)) {
        const provider = authConfig.provider;
        // show an error toast if provider is null or not supported
        if (provider && Object.values(AuthProviderEnum).includes(provider)) {
          // Validate against the RAW server response, not the transformed
          // configJson. `getAuthConfig` reshapes into per-SDK payloads —
          // Azure/Basic nest fields under `auth.*`, Okta renames
          // `authority` → `issuer`, several providers omit `providerName`
          // — so validating the transformed shape falsely reported every
          // Azure/Auth0 config as broken (fields "missing" that were only
          // nested-away). REQUIRED_FIELDS_BY_PROVIDER lists the fields the
          // /system/config/auth public endpoint actually exposes, which is
          // what `authConfig` is.
          const validation = validateAuthFieldsDetailed(
            authConfig as AuthenticationConfigurationWithScope
          );
          const configJson = getAuthConfig(authConfig);
          setHasValidConfig(validation.valid);
          if (!validation.valid) {
            // Surface the misconfiguration with a toast — the SPA still
            // proceeds to render whatever the current provider allows so
            // the admin isn't locked out of the shell entirely (per
            // conductor review). Any downstream SDK failure with the
            // empty fields surfaces its own error.
            const missing = validation.errors
              .map((error) => error.field)
              .join(', ');
            showErrorToast(
              t('message.auth-configuration-missing-fields', {
                fields: missing,
              })
            );
          }
          setJwtPrincipalClaims(authConfig.jwtPrincipalClaims);
          setJwtPrincipalClaimsMapping(authConfig.jwtPrincipalClaimsMapping);
          setAuthConfig(configJson);
          setAuthorizerConfig(authorizerConfig);
          // RDF enabled status is already set from system config in App.tsx.
          //
          // Gate the SDK-instance wiring on validation.valid: MSAL's
          // PublicClientApplication.initialize() rejects an empty
          // clientId, and setMsalInstance never runs, leaving
          // isConfigLoading true forever — the whole shell sits on
          // <Loader /> instead of falling through to SignInPage like the
          // other providers do. Skip the SDK boot when required fields
          // are missing so Azure matches Basic/LDAP/OIDC/Auth0/Okta:
          // toast fires, SignInPage renders, admin can retry after the
          // config is fixed on the server.
          if (validation.valid) {
            updateAuthInstance(configJson);
          }
          const oidcToken = await getOidcToken();
          if (!oidcToken) {
            handleStoreProtectedRedirectPath();
            setApplicationLoading(false);
          } else {
            // get the user details if token is present and route is not auth callback and saml callback
            if (
              ![ROUTES.AUTH_CALLBACK, ROUTES.SILENT_CALLBACK].includes(
                location.pathname
              )
            ) {
              // Fire-and-forget: `getLoggedInUserDetails` now re-throws a
              // refreshable 401 (Task 13 — Bug 1 fix) so the AuthCoordinator's
              // axios response interceptor can retry it. Before that change
              // this call could never reject; now that it can, the rejection
              // needs a handler here or it surfaces as an uncaught promise.
              // If the interceptor's own refresh attempt ultimately fails, the
              // coordinator's `refresh-failed` subscription (mount effect
              // above) already drives `resetUserDetails(true)` — this catch
              // only silences the otherwise-unhandled rejection.
              getLoggedInUserDetails().catch(() => undefined);
            }
          }
        } else {
          // provider is either null or not supported
          setApplicationLoading(false);
          showErrorToast(
            t('message.configured-sso-provider-is-not-supported', {
              provider: authConfig?.provider,
            })
          );
        }
      } else {
        setApplicationLoading(false);
        showErrorToast(t('message.auth-configuration-missing'));
      }
    } catch (error) {
      setApplicationLoading(false);
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.auth-config-lowercase-plural'),
        })
      );
    }
  };

  const getProtectedApp = () => {
    // Show loader if application is loading or authenticating
    const childElement =
      isApplicationLoading || isAuthenticating ? (
        <Loader fullScreen />
      ) : (
        children
      );

    // Handling for SAML moved to GenericAuthenticator
    if (
      clientType === ClientType.Confidential ||
      authConfig?.provider === AuthProviderEnum.Saml
    ) {
      return (
        <LazyGenericAuthenticator ref={authenticatorRef}>
          {childElement}
        </LazyGenericAuthenticator>
      );
    }
    switch (authConfig?.provider) {
      case AuthProviderEnum.LDAP:
      case AuthProviderEnum.Basic: {
        return (
          <LazyBasicAuthProviderWrapper>
            <LazyBasicAuthAuthenticator ref={authenticatorRef}>
              {childElement}
            </LazyBasicAuthAuthenticator>
          </LazyBasicAuthProviderWrapper>
        );
      }
      case AuthProviderEnum.Auth0: {
        return (
          <LazyAuth0ProviderWrapper
            useRefreshTokens
            cacheLocation="memory"
            clientId={authConfig.clientId?.toString() ?? ''}
            domain={authConfig.authority?.toString() ?? ''}
            redirectUri={authConfig.callbackUrl?.toString() ?? ''}>
            <LazyAuth0Authenticator ref={authenticatorRef}>
              {childElement}
            </LazyAuth0Authenticator>
          </LazyAuth0ProviderWrapper>
        );
      }
      case AuthProviderEnum.Okta: {
        return (
          <LazyOktaAuthProviderWrapper>
            <LazyOktaAuthenticator ref={authenticatorRef}>
              {childElement}
            </LazyOktaAuthenticator>
          </LazyOktaAuthProviderWrapper>
        );
      }
      case AuthProviderEnum.Google:
      case AuthProviderEnum.CustomOidc:
      case AuthProviderEnum.AwsCognito: {
        return (
          <LazyOidcAuthenticator
            childComponentType={childComponentType}
            ref={authenticatorRef}
            userConfig={userConfig}>
            {childElement}
          </LazyOidcAuthenticator>
        );
      }
      case AuthProviderEnum.Azure: {
        if (msalInstance) {
          return (
            <LazyMsalProviderWrapper instance={msalInstance}>
              <LazyMsalAuthenticator ref={authenticatorRef}>
                {childElement}
              </LazyMsalAuthenticator>
            </LazyMsalProviderWrapper>
          );
        }

        // No msalInstance because the config validator flagged fields
        // missing and updateAuthInstance was skipped. Render children
        // (SignInPage / AppRouter) directly so the shell isn't locked
        // to Loader with an unrecoverable state.
        if (!hasValidConfig) {
          return <Fragment>{childElement}</Fragment>;
        }

        return <Loader fullScreen />;
      }
      default: {
        return null;
      }
    }
  };

  useEffect(() => {
    fetchAuthConfig();
    initializeAxiosInterceptors();
  }, []);

  const contextValues = useMemo(() => {
    return {
      onLoginHandler,
      onLogoutHandler,
      handleSuccessfulLogin,
      handleFailedLogin,
      handleSuccessfulLogout: resetUserDetails,
      updateAxiosInterceptors: initializeAxiosInterceptors,
    };
  }, [
    onLoginHandler,
    onLogoutHandler,
    handleSuccessfulLogin,
    handleFailedLogin,
    resetUserDetails,
    initializeAxiosInterceptors,
  ]);

  const isConfigLoading =
    !authConfig ||
    (authConfig.provider === AuthProviderEnum.Azure &&
      hasValidConfig &&
      !msalInstance);

  return (
    <AuthContext.Provider value={contextValues}>
      {isConfigLoading ? <Loader fullScreen /> : getProtectedApp()}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

export const useAuthProvider = () => {
  return useContext(AuthContext);
};
