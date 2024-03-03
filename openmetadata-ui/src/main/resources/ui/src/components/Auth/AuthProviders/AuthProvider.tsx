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
import { Auth0Provider } from '@auth0/auth0-react';
import { Configuration } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { LoginCallback } from '@okta/okta-react';
import {
  AxiosError,
  AxiosRequestHeaders,
  InternalAxiosRequestConfig,
} from 'axios';
import { CookieStorage } from 'cookie-storage';
import { compare } from 'fast-json-patch';
import { isEmpty, isNil, isNumber } from 'lodash';
import Qs from 'qs';
import React, {
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
import { useHistory, useLocation } from 'react-router-dom';
import {
  ACTIVE_DOMAIN_STORAGE_KEY,
  DEFAULT_DOMAIN_VALUE,
  REDIRECT_PATHNAME,
  ROUTES,
} from '../../../constants/constants';
import { useApplicationConfigContext } from '../../../context/ApplicationConfigProvider/ApplicationConfigProvider';
import { ClientErrors } from '../../../enums/Axios.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { AuthenticationConfiguration } from '../../../generated/configuration/authenticationConfiguration';
import { AuthorizerConfiguration } from '../../../generated/configuration/authorizerConfiguration';
import { User } from '../../../generated/entity/teams/user';
import { AuthProvider as AuthProviderEnum } from '../../../generated/settings/settings';
import axiosClient from '../../../rest';
import {
  fetchAuthenticationConfig,
  fetchAuthorizerConfig,
} from '../../../rest/miscAPI';
import { getLoggedInUser, updateUserDetail } from '../../../rest/userAPI';
import {
  extractDetailsFromToken,
  getAuthConfig,
  getUrlPathnameExpiry,
  getUserManagerConfig,
  isProtectedRoute,
  msalInstance,
  setMsalInstance,
} from '../../../utils/AuthProvider.util';
import localState from '../../../utils/LocalStorageUtils';
import { escapeESReservedCharacters } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  getUserDataFromOidc,
  matchUserDetails,
} from '../../../utils/UserDataUtils';
import { resetWebAnalyticSession } from '../../../utils/WebAnalyticsUtils';
import Loader from '../../common/Loader/Loader';
import Auth0Authenticator from '../AppAuthenticators/Auth0Authenticator';
import BasicAuthAuthenticator from '../AppAuthenticators/BasicAuthAuthenticator';
import MsalAuthenticator from '../AppAuthenticators/MsalAuthenticator';
import OidcAuthenticator from '../AppAuthenticators/OidcAuthenticator';
import OktaAuthenticator from '../AppAuthenticators/OktaAuthenticator';
import SamlAuthenticator from '../AppAuthenticators/SamlAuthenticator';
import Auth0Callback from '../AppCallbacks/Auth0Callback/Auth0Callback';
import {
  AuthenticationConfigurationWithScope,
  AuthenticatorRef,
  IAuthContext,
  OidcUser,
  UserProfile,
} from './AuthProvider.interface';
import BasicAuthProvider from './BasicAuthProvider';
import OktaAuthProvider from './OktaAuthProvider';

interface AuthProviderProps {
  childComponentType: ComponentType;
  children: ReactNode;
}

export const AuthContext = createContext<IAuthContext>({} as IAuthContext);

const cookieStorage = new CookieStorage();

const userAPIQueryFields = 'profile,teams,roles,personas,defaultPersona';

const isEmailVerifyField = 'isEmailVerified';

let requestInterceptor: number | null = null;
let responseInterceptor: number | null = null;

export const AuthProvider = ({
  childComponentType,
  children,
}: AuthProviderProps) => {
  const location = useLocation();
  const history = useHistory();
  const { t } = useTranslation();
  const [timeoutId, setTimeoutId] = useState<number>();
  const authenticatorRef = useRef<AuthenticatorRef>(null);
  const [currentUser, setCurrentUser] = useState<User>();
  const { urlPathName } = useApplicationConfigContext();

  const oidcUserToken = localState.getOidcToken();
  const [newUserProfile, setNewUserProfile] = useState<UserProfile>();
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(
    Boolean(oidcUserToken)
  );

  const [loading, setLoading] = useState(true);
  const [authConfig, setAuthConfig] =
    useState<AuthenticationConfigurationWithScope>();

  const [authorizerConfig, setAuthorizerConfig] =
    useState<AuthorizerConfiguration>();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [jwtPrincipalClaims, setJwtPrincipalClaims] = useState<
    AuthenticationConfiguration['jwtPrincipalClaims']
  >([]);

  let silentSignInRetries = 0;

  const userConfig = useMemo(
    () => (authConfig ? getUserManagerConfig(authConfig) : {}),
    [authConfig]
  );

  const onLoginHandler = () => {
    setLoading(true);
    authenticatorRef.current?.invokeLogin();

    resetWebAnalyticSession();
  };

  const onLogoutHandler = useCallback(() => {
    clearTimeout(timeoutId);
    authenticatorRef.current?.invokeLogout();

    // reset the user details on logout
    setCurrentUser({} as User);

    // remove analytics session on logout
    removeSession();

    // remove the refresh token on logout
    localState.removeRefreshToken();

    setLoading(false);
  }, [timeoutId]);

  const onRenewIdTokenHandler = () => {
    return authenticatorRef.current?.renewIdToken();
  };

  const handledVerifiedUser = () => {
    if (!isProtectedRoute(location.pathname)) {
      history.push(ROUTES.HOME);
    }
  };

  const setLoadingIndicator = (value: boolean) => {
    setLoading(value);
  };

  /**
   * Stores redirect URL for successful login
   */
  const storeRedirectPath = useCallback(
    (path?: string) => {
      cookieStorage.setItem(REDIRECT_PATHNAME, path ?? urlPathName, {
        expires: getUrlPathnameExpiry(),
        path: '/',
      });
    },
    [urlPathName]
  );

  const resetUserDetails = (forceLogout = false) => {
    setCurrentUser({} as User);
    localState.removeOidcToken();
    setIsUserAuthenticated(false);
    setLoadingIndicator(false);
    clearTimeout(timeoutId);
    if (forceLogout) {
      onLogoutHandler();
    } else {
      history.push(ROUTES.SIGNIN);
    }
  };

  const getLoggedInUserDetails = () => {
    setLoading(true);
    getLoggedInUser({ fields: userAPIQueryFields })
      .then((res) => {
        if (res) {
          setCurrentUser(res);
        } else {
          resetUserDetails();
        }
      })
      .catch((err: AxiosError) => {
        resetUserDetails();
        if (err.response?.status !== 404) {
          showErrorToast(
            err,
            t('server.entity-fetch-error', {
              entity: t('label.logged-in-user-lowercase'),
            })
          );
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const getUpdatedUser = (updatedData: User, existingData: User) => {
    // PUT method for users api only excepts below fields
    const updatedUserData = { ...existingData, ...updatedData };
    const jsonPatch = compare(existingData, updatedUserData);

    updateUserDetail(existingData.id, jsonPatch)
      .then((res) => {
        if (res) {
          setCurrentUser({ ...existingData, ...res });
        } else {
          throw t('server.unexpected-response');
        }
      })
      .catch((error: AxiosError) => {
        setCurrentUser(existingData);
        showErrorToast(
          error,
          t('server.entity-updating-error', {
            entity: t('label.admin-profile'),
          })
        );
      });
  };

  /**
   * Renew Id Token handler for all the SSOs.
   * This method will be called when the id token is about to expire.
   */
  const renewIdToken = async () => {
    try {
      const onRenewIdTokenHandlerPromise = onRenewIdTokenHandler();
      onRenewIdTokenHandlerPromise && (await onRenewIdTokenHandlerPromise);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `Error while refreshing token: `,
        (error as AxiosError).message
      );

      throw error;
    }

    return localState.getOidcToken();
  };

  /**
   * This method will try to signIn silently when token is about to expire
   * It will try for max 3 times if it's not succeed then it will proceed for logout
   */
  const trySilentSignIn = () => {
    const pathName = location.pathname;
    // Do not try silent sign in for SignIn or SignUp route
    if ([ROUTES.SIGNIN, ROUTES.SIGNUP].indexOf(pathName) === -1) {
      // Try to renew token
      silentSignInRetries < 3
        ? renewIdToken()
            .then(() => {
              silentSignInRetries = 0;
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              startTokenExpiryTimer();
            })
            .catch((err) => {
              if (err.message.includes('Frame window timed out')) {
                silentSignInRetries = 0;
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                startTokenExpiryTimer();

                return;
              }
              // eslint-disable-next-line no-console
              console.error('Error while attempting for silent signIn. ', err);
              silentSignInRetries += 1;
              trySilentSignIn();
            })
        : resetUserDetails(); // Logout if we reaches max silent signIn limit;
    }
  };

  /**
   * It will set an timer for 5 mins before Token will expire
   * If time if less then 5 mins then it will try to SilentSignIn
   * It will also ensure that we have time left for token expiry
   * This method will be call upon successful signIn
   */
  const startTokenExpiryTimer = () => {
    // Extract expiry
    const { isExpired, timeoutExpiry } = extractDetailsFromToken();
    const refreshToken = localState.getRefreshToken();

    // Basic & LDAP renewToken depends on RefreshToken hence adding a check here for the same
    const shouldStartExpiry =
      refreshToken ||
      [AuthProviderEnum.Basic, AuthProviderEnum.LDAP].indexOf(
        authConfig?.provider as AuthProviderEnum
      ) === -1;

    if (!isExpired && isNumber(timeoutExpiry) && shouldStartExpiry) {
      // Have 5m buffer before start trying for silent signIn
      // If token is about to expire then start silentSignIn
      // else just set timer to try for silentSignIn before token expires
      clearTimeout(timeoutId);
      const timerId = setTimeout(() => {
        trySilentSignIn();
      }, timeoutExpiry);
      setTimeoutId(Number(timerId));
    }
  };

  /**
   * Performs cleanup around timers
   * Clean silentSignIn activities if going on
   */
  const cleanup = useCallback(() => {
    clearTimeout(timeoutId);
  }, [timeoutId]);

  const handleFailedLogin = () => {
    setIsSigningIn(false);
    setIsUserAuthenticated(false);
    setLoading(false);
    history.push(ROUTES.SIGNIN);
  };

  const handleSuccessfulLogin = (user: OidcUser) => {
    setLoading(true);
    setIsUserAuthenticated(true);
    const fields =
      authConfig?.provider === AuthProviderEnum.Basic
        ? userAPIQueryFields + ',' + isEmailVerifyField
        : userAPIQueryFields;
    getLoggedInUser({ fields })
      .then((res) => {
        if (res) {
          const updatedUserData = getUserDataFromOidc(res, user);
          if (!matchUserDetails(res, updatedUserData, ['profile', 'email'])) {
            getUpdatedUser(updatedUserData, res);
          } else {
            setCurrentUser(res);
          }
          handledVerifiedUser();
          // Start expiry timer on successful login
          startTokenExpiryTimer();
        }
      })
      .catch((err) => {
        if (err && err.response && err.response.status === 404) {
          setNewUserProfile(user.profile);
          setCurrentUser({} as User);
          setIsSigningIn(true);
          history.push(ROUTES.SIGNUP);
        } else {
          // eslint-disable-next-line no-console
          console.error(err);
          history.push(ROUTES.SIGNIN);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleSuccessfulLogout = () => {
    resetUserDetails();
  };

  const updateAuthInstance = (configJson: AuthenticationConfiguration) => {
    const { provider, ...otherConfigs } = configJson;
    switch (provider) {
      case AuthProviderEnum.Azure:
        {
          setMsalInstance(otherConfigs as unknown as Configuration);
        }

        break;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withDomainFilter = (config: InternalAxiosRequestConfig<any>) => {
    const activeDomain =
      localStorage.getItem(ACTIVE_DOMAIN_STORAGE_KEY) ?? DEFAULT_DOMAIN_VALUE;
    const isGetRequest = config.method === 'get';
    const hasActiveDomain = activeDomain !== DEFAULT_DOMAIN_VALUE;
    const currentPath = window.location.pathname;

    // Do not intercept requests from domains page
    if (currentPath.includes('/domain')) {
      return config;
    }

    if (isGetRequest && hasActiveDomain) {
      // Filter ES Query
      if (config.url?.includes('/search/query')) {
        if (config.params?.index === SearchIndex.TAG) {
          return config;
        }

        // Parse and update the query parameter
        const queryParams = Qs.parse(config.url.split('?')[1]);
        // adding quotes for exact matching
        const domainStatement = `(domain.fullyQualifiedName:"${escapeESReservedCharacters(
          activeDomain
        )}")`;
        queryParams.q = queryParams.q ?? '';
        queryParams.q += isEmpty(queryParams.q)
          ? domainStatement
          : ` AND ${domainStatement}`;

        // Update the URL with the modified query parameter
        config.url = `${config.url.split('?')[0]}?${Qs.stringify(queryParams)}`;
      } else {
        config.params = {
          ...config.params,
          domain: activeDomain,
        };
      }
    }

    return config;
  };

  /**
   * Initialize Axios interceptors to intercept every request and response
   * to handle appropriately. This should be called only when security is enabled.
   */
  const initializeAxiosInterceptors = () => {
    // Axios Request interceptor to add Bearer tokens in Header
    if (requestInterceptor != null) {
      axiosClient.interceptors.request.eject(requestInterceptor);
    }

    if (responseInterceptor != null) {
      axiosClient.interceptors.response.eject(responseInterceptor);
    }

    requestInterceptor = axiosClient.interceptors.request.use(async function (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: InternalAxiosRequestConfig<any>
    ) {
      const token: string = localState.getOidcToken() || '';
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

      return withDomainFilter(config);
    });

    // Axios response interceptor for statusCode 401,403
    responseInterceptor = axiosClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status } = error.response;
          if (status === ClientErrors.UNAUTHORIZED) {
            storeRedirectPath();
            resetUserDetails(true);
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
          setJwtPrincipalClaims(authConfig.jwtPrincipalClaims);
          setAuthConfig(configJson);
          setAuthorizerConfig(authorizerConfig);
          updateAuthInstance(configJson);
          if (!oidcUserToken) {
            if (isProtectedRoute(location.pathname)) {
              storeRedirectPath(location.pathname);
            }
            setLoading(false);
          } else {
            getLoggedInUserDetails();
          }
        } else {
          // provider is either null or not supported
          setLoading(false);
          showErrorToast(
            t('message.configured-sso-provider-is-not-supported', {
              provider: authConfig?.provider,
            })
          );
        }
      } else {
        setLoading(false);
        showErrorToast(t('message.auth-configuration-missing'));
      }
    } catch (error) {
      setLoading(false);
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.auth-config-lowercase-plural'),
        })
      );
    }
  };

  const getCallBackComponent = () => {
    switch (authConfig?.provider) {
      case AuthProviderEnum.Okta: {
        return LoginCallback;
      }
      case AuthProviderEnum.Auth0: {
        return Auth0Callback;
      }
      default: {
        return null;
      }
    }
  };

  const getProtectedApp = () => {
    switch (authConfig?.provider) {
      case AuthProviderEnum.LDAP:
      case AuthProviderEnum.Basic: {
        return (
          <BasicAuthProvider
            onLoginFailure={handleFailedLogin}
            onLoginSuccess={handleSuccessfulLogin}>
            <BasicAuthAuthenticator ref={authenticatorRef}>
              {children}
            </BasicAuthAuthenticator>
          </BasicAuthProvider>
        );
      }
      case AuthProviderEnum.Auth0: {
        return (
          <Auth0Provider
            useRefreshTokens
            cacheLocation="localstorage"
            clientId={authConfig.clientId.toString()}
            domain={authConfig.authority.toString()}
            redirectUri={authConfig.callbackUrl.toString()}>
            <Auth0Authenticator
              ref={authenticatorRef}
              onLogoutSuccess={handleSuccessfulLogout}>
              {children}
            </Auth0Authenticator>
          </Auth0Provider>
        );
      }
      case AuthProviderEnum.Saml: {
        return (
          <SamlAuthenticator
            ref={authenticatorRef}
            onLogoutSuccess={handleSuccessfulLogout}>
            {children}
          </SamlAuthenticator>
        );
      }
      case AuthProviderEnum.Okta: {
        return (
          <OktaAuthProvider onLoginSuccess={handleSuccessfulLogin}>
            <OktaAuthenticator
              ref={authenticatorRef}
              onLogoutSuccess={handleSuccessfulLogout}>
              {children}
            </OktaAuthenticator>
          </OktaAuthProvider>
        );
      }
      case AuthProviderEnum.Google:
      case AuthProviderEnum.CustomOidc:
      case AuthProviderEnum.AwsCognito: {
        return authConfig ? (
          <OidcAuthenticator
            childComponentType={childComponentType}
            ref={authenticatorRef}
            userConfig={userConfig}
            onLoginFailure={handleFailedLogin}
            onLoginSuccess={handleSuccessfulLogin}
            onLogoutSuccess={handleSuccessfulLogout}>
            {children}
          </OidcAuthenticator>
        ) : (
          <Loader fullScreen />
        );
      }
      case AuthProviderEnum.Azure: {
        return msalInstance ? (
          <MsalProvider instance={msalInstance}>
            <MsalAuthenticator
              ref={authenticatorRef}
              onLoginFailure={handleFailedLogin}
              onLoginSuccess={handleSuccessfulLogin}
              onLogoutSuccess={handleSuccessfulLogout}>
              {children}
            </MsalAuthenticator>
          </MsalProvider>
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

    return cleanup;
  }, []);

  const isLoading =
    !authConfig ||
    (authConfig.provider === AuthProviderEnum.Azure && !msalInstance);

  const authContext: IAuthContext = {
    currentUser: currentUser,
    isAuthenticated: isUserAuthenticated,
    setIsAuthenticated: setIsUserAuthenticated,
    newUser: newUserProfile,
    updateNewUser: setNewUserProfile,
    authConfig,
    authorizerConfig,
    isSigningIn,
    setIsSigningIn,
    onLoginHandler,
    onLogoutHandler,
    getCallBackComponent,
    loading,
    setLoadingIndicator,
    handleSuccessfulLogin,
    updateAxiosInterceptors: initializeAxiosInterceptors,
    jwtPrincipalClaims,
    updateCurrentUser: setCurrentUser,
  };

  return (
    <AuthContext.Provider value={authContext}>
      {isLoading ? <Loader fullScreen /> : getProtectedApp()}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);

export default AuthProvider;
