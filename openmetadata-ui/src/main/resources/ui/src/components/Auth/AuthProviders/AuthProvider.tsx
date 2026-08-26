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
import { isNil, isNumber } from 'lodash';
import type { WebStorageStateStore } from 'oidc-client';
import {
  ComponentType,
  createContext,
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
import { DEFAULT_APP_MODE } from '../../../constants/appMode.constants';
import {
  REFRESHABLE_AUTH_ERRORS,
  UN_AUTHORIZED_EXCLUDED_PATHS,
} from '../../../constants/Auth.constants';
import {
  APP_ROUTER_ROUTES as ROUTES,
  REDIRECT_PATHNAME,
} from '../../../constants/router.constants';
import { ClientErrors } from '../../../enums/Axios.enum';
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
  resolveInitialAppMode,
  setAppDefaultMode,
  translateWireMode,
  writeAppMode,
} from '../../../hooks/useAppMode';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useExploreCache } from '../../../hooks/useExploreCache';
import { queryClient } from '../../../queryClient';
import axiosClient from '../../../rest';
import { clearEtagCache } from '../../../rest/etagInterceptor';
import {
  fetchAuthenticationConfig,
  fetchAuthorizerConfig,
} from '../../../rest/miscAPI';
import { getAppConfiguration } from '../../../rest/settingConfigAPI';
import { getLoggedInUser, getUserPreferences } from '../../../rest/userAPI';
import applicationRoutesClass from '../../../utils/ApplicationRoutesClassBase';
import TokenService from '../../../utils/Auth/TokenService/TokenServiceUtil';
import { clearPersonaSession } from '../../../utils/PersonaSessionUtils';
import {
  extractDetailsFromToken,
  getAuthConfig,
  getUrlPathnameExpiry,
  getUserManagerConfig,
  prepareUserProfileFromClaims,
  validateAuthFields,
} from '../../../utils/AuthProvider.util';
import {
  clearOidcToken,
  getOidcToken,
  getRefreshToken,
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
import { AuthenticatorRef, OidcUser } from './AuthProvider.interface';
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
 * user preference -> persona (unknown synchronously here; refined shortly
 * after by `useResolvedAppMode` once the persona doc loads) -> tenant
 * default -> `DEFAULT_APP_MODE`.
 */
const hydrateAndResolveAppMode = async (user: User): Promise<void> => {
  const [prefsRes, appConfig] = await Promise.all([
    getUserPreferences(user.id).catch(() => ({ preferences: [] })),
    getAppConfiguration().catch(() => null),
  ]);
  hydrateBackendSyncedPreferences(user, prefsRes);

  const appDefault = translateWireMode(appConfig?.defaultAppMode ?? null);
  setAppDefaultMode(appDefault);

  // Skip the boot-time write when this tab already has a signal that
  // `useResolvedAppMode` will resolve authoritatively — the resolver is
  // the single source of truth once it has persona + registry
  // information, and writing to the session tuple here poisons the
  // subsequent resolve. Two signals count:
  //
  //   1. A session tuple this tab already owns (returning tab, or a
  //      manual toggle earlier in this tab).
  //   2. A fresh cross-tab `omAppModeHint` — the mechanism by which a
  //      sibling tab's active mode carries into a newly-opened tab.
  //      Once we write `DEFAULT_APP_MODE` here, the resolver's session-
  //      tuple check is satisfied by our write and it never consults
  //      the hint, so a cmd+click from an AI tab silently boots the new
  //      tab into Classic.
  // A returning tab (a `'manual'` or `'resolver'` tuple from a prior
  // resolve) or a fresh tab that inherits an active hint from a
  // sibling — leave both alone. `useResolvedAppMode` treats these as
  // sticky and returns without rewriting. A `'boot'` tuple from an
  // earlier auth cycle is NOT sticky and should be re-resolved, so
  // don't skip on that.
  const existingSession = readAppModeSession();
  if (existingSession?.mode && existingSession.source !== 'boot') {
    return;
  }
  const hint = readAppModeHint();
  if (isAppModeHintFresh(hint) && hint?.mode) {
    return;
  }

  const userPref =
    derivePreferencesFromList(prefsRes.preferences).appMode ?? null;

  // Provisional boot write — persona isn't known synchronously (its
  // docStore doc is fetched by `useResolvedAppMode`), so we compute
  // the best guess from what IS available (userPref, appDefault) and
  // mark it `source: 'boot'`. The async resolver is allowed to
  // override this tuple once it has the persona-doc result and the
  // route registry has settled. The `writeHint` call inside
  // `writeAppMode` is skipped for `'boot'` writes so a provisional
  // guess doesn't leak to sibling tabs as an authoritative hint.
  writeAppMode(resolveEffectiveAppMode(userPref, null, appDefault), null, {
    source: 'boot',
  });
};

let requestInterceptor: number | null = null;
let responseInterceptor: number | null = null;

let pendingRequests: {
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
  config: InternalAxiosRequestConfig<unknown>;
}[] = [];

// True while THIS tab is driving a token refresh and draining `pendingRequests`.
// Kept in memory (not the cross-tab localStorage flag) so a sibling tab's
// refresh can never leave this tab's queued 401s without a driver to settle
// them — the bug that hung the UI on a spinner.
let isRefreshDriverActive = false;

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
  const tokenService = useRef<TokenService>(TokenService.getInstance());

  const location = useCustomLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [timeoutId, setTimeoutId] = useState<number>();
  const [msalInstance, setMsalInstance] = useState<IPublicClientApplication>();

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
    clearTimeout(timeoutId);

    // Clear persona selection before the async SSO call so it is always
    // erased even when invokeLogout() throws (no try/catch here).
    clearPersonaSession();

    // Let SSO complete the logout process
    await authenticatorRef.current?.invokeLogout();

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

    // Clear the refresh flag (used after refresh is complete)
    tokenService.current.clearRefreshInProgress();

    // Upon logout, redirect to the login page
    navigate(ROUTES.SIGNIN);
  }, [timeoutId]);

  const handledVerifiedUser = () => {
    if (!applicationRoutesClass.isProtectedRoute(location.pathname)) {
      // Non-default app modes (e.g. AskCollate's 'ai') own their own
      // shell and land pages — navigating to /my-data would drop the
      // user on the Classic My Data page even though their tab is in
      // AI mode. Route to `/` and let the mode-specific route tree
      // render its own landing page.
      //
      // At post-login redirect time `useResolvedAppMode` has not yet
      // run, so the useAppMode store alone only reflects the
      // sessionStorage tuple (empty on a fresh login). `resolveInitialAppMode`
      // consults the same synchronously-available signals as the
      // resolver — session tuple → fresh cross-tab hint → user's
      // stored preference — so a user whose "remember" checkbox is on
      // AI or whose sibling tab is in AI lands on `/` from the start
      // instead of being bounced through `/my-data` and then flipped
      // to AI by the resolver a tick later. Persona (async) stays
      // with the resolver.
      const userName = useApplicationStore.getState().currentUser?.name;
      const appMode = resolveInitialAppMode(userName);
      if (appMode !== DEFAULT_APP_MODE) {
        navigate(ROUTES.HOME);

        return;
      }

      // Check if provider uses OidcAuthenticator which has routing logic
      const usesOidcAuthenticator = [
        AuthProviderEnum.Google,
        AuthProviderEnum.CustomOidc,
        AuthProviderEnum.AwsCognito,
      ].includes(authConfig?.provider as AuthProviderEnum);

      // For providers using OidcAuthenticator, navigate to HOME for routing
      // For all others (Azure, Auth0, SAML, etc.), navigate directly to MY_DATA
      if (usesOidcAuthenticator && clientType !== ClientType.Confidential) {
        navigate(ROUTES.HOME);
      } else {
        navigate(ROUTES.MY_DATA);
      }
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

  const resetUserDetails = (forceLogout = false) => {
    clearPersonaSession();
    setCurrentUser({} as User);
    clearOidcToken();
    setIsAuthenticated(false);
    setApplicationLoading(false);
    clearTimeout(timeoutId);
    TokenService.getInstance().clearRefreshInProgress();
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
      // the axios response interceptor drives a refresh via TokenService.
      // The real fix for the race between that refresh and the lazy
      // authenticator's renewer registration lives in
      // TokenService.fetchNewToken (it now awaits `awaitRenewerReady`),
      // so this catch just needs to make sure we don't swallow the
      // recovered response — the interceptor drains the queued request
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
      resetUserDetails();
      if (err.response?.status !== 404) {
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

  /**
   * It will set an timer for 5 mins before Token will expire
   * If time if less then 5 mins then it will try to SilentSignIn
   * It will also ensure that we have time left for token expiry
   * This method will be call upon successful signIn
   */
  const startTokenExpiryTimer = async () => {
    const oidcToken = await getOidcToken();
    // Extract expiry
    const { isExpired, timeoutExpiry } = extractDetailsFromToken(oidcToken);
    const refreshToken = await getRefreshToken();

    // Basic & LDAP renewToken depends on RefreshToken hence adding a check here for the same
    const shouldStartExpiry =
      refreshToken ||
      ![AuthProviderEnum.Basic, AuthProviderEnum.LDAP].includes(
        authConfig?.provider as AuthProviderEnum
      );

    if (!isExpired && isNumber(timeoutExpiry) && shouldStartExpiry) {
      // Have 5m buffer before start trying for silent signIn
      // If token is about to expire then start silentSignIn
      // else just set timer to try for silentSignIn before token expires
      clearTimeout(timeoutId);

      const timerId = setTimeout(() => {
        tokenService.current?.refreshToken();
      }, timeoutExpiry);
      setTimeoutId(Number(timerId));
    }
  };

  // Renewer registration for TokenService moved into each authenticator's
  // own mount effect (BasicAuthAuthenticator, GenericAuthenticator,
  // OidcAuthenticator, MsalAuthenticator, OktaAuthenticator,
  // Auth0Authenticator). The previous ref-deps effect here
  // (`[authenticatorRef.current?.renewIdToken]`) never re-ran after the
  // lazy authenticator finished loading because ref changes don't
  // schedule re-renders — so on cold-load the first 401 raced ahead of
  // the registration and TokenService.refreshToken() returned null
  // without ever firing the `/api/v1/auth/refresh` HTTP call.
  // `updateRefreshSuccessCallback(startTokenExpiryTimer)` is registered
  // from the main mount effect below because that timer callback lives
  // in this component's closure.

  // When the tab becomes visible after being backgrounded, browsers may have
  // throttled or suspended the proactive renewal timer. Check token freshness
  // immediately and refresh only when the token is actually stale; otherwise
  // just reschedule the timer with the correct remaining time.
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      try {
        const token = await getOidcToken();
        // No token in storage (user is on /signin, or just logged out).
        // Firing tokenService.refreshToken() here would still invoke the
        // renewer (e.g. OIDC signinSilent → hidden iframe to the IdP) on
        // every tab focus — pure IdP-side noise for a signed-out session.
        if (!token) {
          return;
        }
        const { exp, isExpired, timeoutExpiry } =
          extractDetailsFromToken(token);
        // A missing / non-positive `exp` means the token is opaque, not a
        // JWT at all, or spec-violating. extractDetailsFromToken returns
        // `isExpired: true` for the jwt-decode-throws branch AND
        // `isExpired: false, timeoutExpiry: 0` for the isNil(exp) branch —
        // neither is signal we can act on, so leave the token in place and
        // let the next real 401 drive a refresh via the axios interceptor.
        // MUST come before the isExpired branch — otherwise opaque tokens
        // would fire refresh() on every tab focus.
        if (typeof exp !== 'number' || exp <= 0) {
          return;
        }
        if (isExpired) {
          const newToken = await tokenService.current?.refreshToken();
          // Post-refresh reauth: if the user was bounced to signin by an
          // earlier failed call, a successful refresh must re-run the
          // loggedInUser flow to flip isAuthenticated back to true.
          // Reading via getState() avoids the stale closure of the
          // mount-only useEffect.
          if (newToken && !useApplicationStore.getState().isAuthenticated) {
            await getLoggedInUserDetails();
          }

          return;
        }
        // Only near-expiry (within the pre-expiry buffer) should proactively
        // refresh here. `timeoutExpiry === 0` exactly captures that case
        // once we've ruled out invalid exp above.
        if (isNumber(timeoutExpiry) && timeoutExpiry <= 0) {
          const newToken = await tokenService.current?.refreshToken();
          if (newToken && !useApplicationStore.getState().isAuthenticated) {
            await getLoggedInUserDetails();
          }

          return;
        }
        startTokenExpiryTimer();
      } catch {
        // Storage read errors fall through: the next real 401 will drive
        // the refresh via the axios interceptor.
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  /**
   * Performs cleanup around timers
   * Clean silentSignIn activities if going on
   */
  const cleanup = useCallback(() => {
    clearTimeout(timeoutId);
  }, [timeoutId]);

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
          // Start expiry timer on successful login
          startTokenExpiryTimer();
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

  /**
   * Stores redirect URL for successful login
   */
  const handleStoreProtectedRedirectPath = useCallback(() => {
    if (applicationRoutesClass.isProtectedRoute(location.pathname)) {
      storeRedirectPath(location.pathname);
    }
  }, [location.pathname, storeRedirectPath]);

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
   * Initialize Axios interceptors to intercept every request and response
   * to handle appropriately. This should be called only when security is enabled.
   */
  const initializeAxiosInterceptors = async () => {
    // Axios Request interceptor to add Bearer tokens in Header
    if (requestInterceptor != null) {
      axiosClient.interceptors.request.eject(requestInterceptor);
    }

    if (responseInterceptor != null) {
      axiosClient.interceptors.response.eject(responseInterceptor);
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

    // Axios response interceptor for statusCode 401,403
    responseInterceptor = axiosClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status } = error.response;
          if (status === ClientErrors.UNAUTHORIZED) {
            // For login or refresh we don't want to fire another refresh req
            // Hence rejecting it
            if (
              UN_AUTHORIZED_EXCLUDED_PATHS.includes(error.config.url) ||
              (error.config.url === '/users/loggedInUser' &&
                !REFRESHABLE_AUTH_ERRORS.some((authError) =>
                  (error.response.data?.message ?? '').includes(authError)
                ))
            ) {
              throw error;
            }
            handleStoreProtectedRedirectPath();

            // Queue the failed request, then ensure exactly one refresh drives
            // the queue in THIS tab. Every 401 lands in pendingRequests; the
            // first arrival starts the refresh and, once it settles, ALWAYS
            // drains the queue — retry with the new token, or reject + log out.
            // Nothing is left parked. The previous code queued behind a
            // cross-tab localStorage flag that no in-tab driver would clear,
            // hanging the request (and the UI spinner) indefinitely.
            return new Promise((resolve, reject) => {
              pendingRequests.push({ resolve, reject, config: error.config });
              if (isRefreshDriverActive) {
                return;
              }
              isRefreshDriverActive = true;

              const drainPendingRequests = (hasNewToken: boolean) => {
                const queued = pendingRequests;
                pendingRequests = [];
                isRefreshDriverActive = false;
                if (hasNewToken) {
                  queued.forEach(
                    ({ resolve: onResolve, reject: onReject, config }) =>
                      axiosClient
                        .request(config)
                        .then(onResolve)
                        .catch(onReject)
                  );
                } else {
                  queued.forEach(({ reject: onReject }) => onReject(error));
                }
              };

              tokenService.current
                .refreshToken()
                .then(async (token) => {
                  if (token) {
                    await initializeAxiosInterceptors();
                    drainPendingRequests(true);
                  } else {
                    drainPendingRequests(false);
                    resetUserDetails(true);
                  }
                })
                .catch(() => {
                  drainPendingRequests(false);
                  resetUserDetails(true);
                });
            });
          }
        }

        throw error;
      }
    );
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
          const configJson = getAuthConfig(authConfig);
          validateAuthFields(configJson);
          setJwtPrincipalClaims(authConfig.jwtPrincipalClaims);
          setJwtPrincipalClaimsMapping(authConfig.jwtPrincipalClaimsMapping);
          setAuthConfig(configJson);
          setAuthorizerConfig(authorizerConfig);
          // RDF enabled status is already set from system config in App.tsx
          updateAuthInstance(configJson);
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
              getLoggedInUserDetails();
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
        return msalInstance ? (
          <LazyMsalProviderWrapper instance={msalInstance}>
            <LazyMsalAuthenticator ref={authenticatorRef}>
              {childElement}
            </LazyMsalAuthenticator>
          </LazyMsalProviderWrapper>
        ) : (
          <Loader fullScreen />
        );
      }
      default: {
        return null;
      }
    }
  };

  useEffect(() => {
    fetchAuthConfig();
    startTokenExpiryTimer();
    initializeAxiosInterceptors();
    // Timer restart after a successful cross-tab refresh — the callback
    // itself lives in this component's closure, so we register it here
    // rather than from each authenticator.
    tokenService.current.updateRefreshSuccessCallback(startTokenExpiryTimer);

    return cleanup;
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
    (authConfig.provider === AuthProviderEnum.Azure && !msalInstance);

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
