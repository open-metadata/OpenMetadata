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
import { AxiosError } from 'axios';
import { CookieStorage } from 'cookie-storage';
import { isEmpty, isNil } from 'lodash';
import { observer } from 'mobx-react';
import React, {
  ComponentType,
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import axiosClient from 'rest/index';
import { fetchAuthenticationConfig } from 'rest/miscAPI';
import { getLoggedInUser, getUserByName, updateUser } from 'rest/userAPI';
import appState from '../../../AppState';
import { NO_AUTH } from '../../../constants/auth.constants';
import { REDIRECT_PATHNAME, ROUTES } from '../../../constants/constants';
import { ClientErrors } from '../../../enums/axios.enum';
import { AuthTypes } from '../../../enums/signin.enum';
import { AuthenticationConfiguration } from '../../../generated/configuration/authenticationConfiguration';
import { AuthType, User } from '../../../generated/entity/teams/user';
import jsonData from '../../../jsons/en';
import {
  EXPIRY_THRESHOLD_MILLES,
  extractDetailsFromToken,
  getAuthConfig,
  getNameFromEmail,
  getUrlPathnameExpiry,
  getUserManagerConfig,
  isProtectedRoute,
  isTourRoute,
  msalInstance,
  setMsalInstance,
} from '../../../utils/AuthProvider.util';
import localState from '../../../utils/LocalStorageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  fetchAllUsers,
  getUserDataFromOidc,
  matchUserDetails,
} from '../../../utils/UserDataUtils';
import { resetWebAnalyticSession } from '../../../utils/WebAnalyticsUtils';
import Loader from '../../Loader/Loader';
import Auth0Authenticator from '../authenticators/Auth0Authenticator';
import BasicAuthAuthenticator from '../authenticators/basic-auth.authenticator';
import MsalAuthenticator from '../authenticators/MsalAuthenticator';
import OidcAuthenticator from '../authenticators/OidcAuthenticator';
import OktaAuthenticator from '../authenticators/OktaAuthenticator';
import Auth0Callback from '../callbacks/Auth0Callback/Auth0Callback';
import { AuthenticatorRef, OidcUser } from './AuthProvider.interface';
import BasicAuthProvider from './basic-auth.provider';
import OktaAuthProvider from './okta-auth-provider';

interface AuthProviderProps {
  childComponentType: ComponentType;
  children: ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AuthContext = createContext({} as any);

const cookieStorage = new CookieStorage();

const userAPIQueryFields = 'profile,teams,roles';

const isEmailVerifyField = 'isEmailVerified';

let requestInterceptor: number | null = null;
let responseInterceptor: number | null = null;

export const AuthProvider = ({
  childComponentType,
  children,
}: AuthProviderProps) => {
  const location = useLocation();
  const history = useHistory();
  const [timeoutId, setTimeoutId] = useState<number>();
  const authenticatorRef = useRef<AuthenticatorRef>(null);

  const oidcUserToken = localState.getOidcToken();

  const [isUserAuthenticated, setIsUserAuthenticated] = useState(
    Boolean(oidcUserToken)
  );
  const [isAuthDisabled, setIsAuthDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authConfig, setAuthConfig] =
    useState<Record<string, string | boolean>>();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isUserCreated, setIsUserCreated] = useState(false);

  const [jwtPrincipalClaims, setJwtPrincipalClaims] = useState<
    AuthenticationConfiguration['jwtPrincipalClaims']
  >([]);

  let silentSignInRetries = 0;

  const handleUserCreated = (isUser: boolean) => setIsUserCreated(isUser);

  const onLoginHandler = () => {
    setLoading(true);
    authenticatorRef.current?.invokeLogin();

    resetWebAnalyticSession();
  };

  const onLogoutHandler = useCallback(() => {
    clearTimeout(timeoutId);
    authenticatorRef.current?.invokeLogout();

    // remove analytics session on logout
    removeSession();
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
  function storeRedirectPath() {
    cookieStorage.setItem(REDIRECT_PATHNAME, appState.getUrlPathname(), {
      expires: getUrlPathnameExpiry(),
      path: '/',
    });
  }

  const resetUserDetails = (forceLogout = false) => {
    appState.updateUserDetails({} as User);
    appState.updateUserPermissions([]);
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
    getLoggedInUser(userAPIQueryFields)
      .then((res) => {
        if (res) {
          appState.updateUserDetails(res);
        } else {
          resetUserDetails();
        }
      })
      .catch((err: AxiosError) => {
        resetUserDetails();
        if (err.response?.status !== 404) {
          showErrorToast(
            err,
            jsonData['api-error-messages']['fetch-logged-in-user-error']
          );
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const getUpdatedUser = (updatedData: User, existingData: User) => {
    // PUT method for users api only excepts below fields
    const {
      isAdmin,
      teams,
      timezone,
      name,
      description,
      displayName,
      profile,
      email,
      isBot,
      roles,
    } = { ...existingData, ...updatedData };
    const teamIds = teams?.map((team) => team.id);
    const roleIds = roles?.map((role) => role.id);
    updateUser({
      isAdmin,
      teams: teamIds,
      timezone,
      name,
      description,
      displayName,
      profile,
      email,
      isBot,
      roles: roleIds,
    } as User)
      .then((res) => {
        if (res.data) {
          appState.updateUserDetails(res.data);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((error: AxiosError) => {
        appState.updateUserDetails(existingData);
        showErrorToast(
          error,
          jsonData['api-error-messages']['update-admin-profile-error']
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
    } catch (error: any) {
      console.error(error.message);
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
              // eslint-disable-next-line no-console
              console.error('Error while attempting for silent signIn. ', err);
              silentSignInRetries += 1;
              trySilentSignIn();
            })
        : resetUserDetails(); // Logout if we reaches max silent signIn limit;
    }
  };

  /**
   * It will set an timer for 50 secs before Token will expire
   * If time if less then 50 secs then it will try to SilentSignIn
   * It will also ensure that we have time left for token expiry
   * This method will be call upon successful signIn
   */
  const startTokenExpiryTimer = () => {
    // Extract expiry
    const { exp, isExpired, diff, timeoutExpiry } = extractDetailsFromToken();

    if (!isExpired && exp && diff && timeoutExpiry && timeoutExpiry > 0) {
      // Have 2m buffer before start trying for silent signIn
      // If token is about to expire then start silentSignIn
      // else just set timer to try for silentSignIn before token expires
      if (diff > EXPIRY_THRESHOLD_MILLES) {
        clearTimeout(timeoutId);
        const timerId = setTimeout(() => {
          trySilentSignIn();
        }, timeoutExpiry);
        setTimeoutId(Number(timerId));
      } else {
        trySilentSignIn();
      }
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
      authConfig?.provider === AuthType.Basic
        ? userAPIQueryFields + ',' + isEmailVerifyField
        : userAPIQueryFields;
    getUserByName(getNameFromEmail(user.profile.email), fields)
      .then((res) => {
        if (res) {
          const updatedUserData = getUserDataFromOidc(res, user);
          if (!matchUserDetails(res, updatedUserData, ['profile', 'email'])) {
            getUpdatedUser(updatedUserData, res);
          } else {
            appState.updateUserDetails(res);
          }
          handledVerifiedUser();
          // Start expiry timer on successful login
          startTokenExpiryTimer();
        }
      })
      .catch((err) => {
        if (err && err.response && err.response.status === 404) {
          appState.updateNewUser(user.profile);
          appState.updateUserDetails({} as User);
          appState.updateUserPermissions([]);
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

  const updateAuthInstance = (configJson: Record<string, string | boolean>) => {
    const { provider, ...otherConfigs } = configJson;
    switch (provider) {
      case AuthTypes.AZURE:
        {
          setMsalInstance(otherConfigs as unknown as Configuration);
        }

        break;
    }
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
      config
    ) {
      const token: string = localState.getOidcToken() || '';
      if (token) {
        if (config.headers) {
          config.headers['Authorization'] = `Bearer ${token}`;
        } else {
          config.headers = {
            Authorization: `Bearer ${token}`,
          };
        }
      }

      return config;
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

  const fetchAuthConfig = (): void => {
    fetchAuthenticationConfig()
      .then((authRes) => {
        const isSecureMode = !isNil(authRes) && authRes.provider !== NO_AUTH;
        if (isSecureMode) {
          const provider = authRes?.provider;
          // show an error toast if provider is null or not supported
          if (
            provider &&
            Object.values(AuthTypes).includes(provider as AuthTypes)
          ) {
            const configJson = getAuthConfig(authRes);
            setJwtPrincipalClaims(authRes.jwtPrincipalClaims);
            initializeAxiosInterceptors();
            setAuthConfig(configJson);
            updateAuthInstance(configJson);
            if (!oidcUserToken) {
              if (isProtectedRoute(location.pathname)) {
                storeRedirectPath();
              }
              setLoading(false);
            } else {
              getLoggedInUserDetails();
            }
          } else {
            // provider is either null or not supported
            setLoading(false);
            showErrorToast(
              `The configured SSO Provider "${authRes?.provider}" is not supported. Please check the authentication configuration in the server.`
            );
          }
        } else {
          setLoading(false);
          setIsAuthDisabled(true);
          fetchAllUsers();
        }
      })
      .catch((err: AxiosError) => {
        setLoading(false);
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-auth-config-error']
        );
      });
  };

  const getCallBackComponent = () => {
    switch (authConfig?.provider) {
      case AuthTypes.OKTA: {
        return LoginCallback;
      }
      case AuthTypes.AUTH0: {
        return Auth0Callback;
      }
      default: {
        return null;
      }
    }
  };

  const getProtectedApp = () => {
    switch (authConfig?.provider) {
      case AuthTypes.LDAP:
      case AuthTypes.BASIC: {
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
      case AuthTypes.AUTH0: {
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
      case AuthTypes.OKTA: {
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
      case AuthTypes.GOOGLE:
      case AuthTypes.CUSTOM_OIDC:
      case AuthTypes.AWS_COGNITO: {
        return authConfig ? (
          <OidcAuthenticator
            childComponentType={childComponentType}
            ref={authenticatorRef}
            userConfig={getUserManagerConfig({
              ...(authConfig as Record<string, string>),
            })}
            onLoginFailure={handleFailedLogin}
            onLoginSuccess={handleSuccessfulLogin}
            onLogoutSuccess={handleSuccessfulLogout}>
            {children}
          </OidcAuthenticator>
        ) : (
          <Loader />
        );
      }
      case AuthTypes.AZURE: {
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
          <Loader />
        );
      }
      default: {
        return isAuthDisabled ? children : null;
      }
    }
  };

  useEffect(() => {
    fetchAuthConfig();
    startTokenExpiryTimer();

    return cleanup;
  }, []);

  useEffect(() => {
    appState.updateAuthState(isAuthDisabled);
  }, [isAuthDisabled]);

  useEffect(() => {
    return history.listen((location) => {
      if (!isAuthDisabled && !appState.userDetails) {
        if (
          (location.pathname === ROUTES.SIGNUP && isEmpty(appState.newUser)) ||
          (!location.pathname.includes(ROUTES.CALLBACK) &&
            location.pathname !== ROUTES.HOME &&
            location.pathname !== ROUTES.SIGNUP &&
            location.pathname !== ROUTES.REGISTER &&
            location.pathname !== ROUTES.SIGNIN)
        ) {
          getLoggedInUserDetails();
        }
      }
    });
  }, [history]);

  useEffect(() => {
    if (isProtectedRoute(location.pathname)) {
      appState.updateUrlPathname(location.pathname);
    }
  }, [location.pathname]);

  const isLoading =
    !isAuthDisabled &&
    (!authConfig || (authConfig.provider === AuthTypes.AZURE && !msalInstance));

  const authContext = {
    isAuthenticated: isUserAuthenticated,
    setIsAuthenticated: setIsUserAuthenticated,
    isAuthDisabled,
    isUserCreated,
    setIsAuthDisabled,
    authConfig,
    setAuthConfig,
    isSigningIn,
    setIsSigningIn,
    onLoginHandler,
    onLogoutHandler,
    getCallBackComponent,
    isProtectedRoute,
    isTourRoute,
    loading,
    setLoadingIndicator,
    handleSuccessfulLogin,
    handleUserCreated,
    updateAxiosInterceptors: initializeAxiosInterceptors,
    jwtPrincipalClaims,
  };

  return (
    <AuthContext.Provider value={authContext}>
      {isLoading ? <Loader /> : getProtectedApp()}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);

export default observer(AuthProvider);
