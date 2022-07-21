/*
 *  Copyright 2021 Collate
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

import { Auth0Provider } from '@auth0/auth0-react';
import { Configuration } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { LoginCallback } from '@okta/okta-react';
import { AxiosError, AxiosResponse } from 'axios';
import { CookieStorage } from 'cookie-storage';
import jwtDecode, { JwtPayload } from 'jwt-decode';
import { isEmpty, isNil } from 'lodash';
import { observer } from 'mobx-react';
import { UserPermissions } from 'Models';
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
import appState from '../../AppState';
import axiosClient from '../../axiosAPIs';
import {
  fetchAuthenticationConfig,
  getLoggedInUserPermissions,
} from '../../axiosAPIs/miscAPI';
import {
  getLoggedInUser,
  getUserByName,
  updateUser,
} from '../../axiosAPIs/userAPI';
import Loader from '../../components/Loader/Loader';
import { NO_AUTH } from '../../constants/auth.constants';
import {
  oidcTokenKey,
  REDIRECT_PATHNAME,
  ROUTES,
} from '../../constants/constants';
import { ClientErrors } from '../../enums/axios.enum';
import { AuthTypes } from '../../enums/signin.enum';
import { User } from '../../generated/entity/teams/user';
import jsonData from '../../jsons/en';
import {
  getAuthConfig,
  getNameFromEmail,
  getUrlPathnameExpiry,
  getUserManagerConfig,
  isProtectedRoute,
  isTourRoute,
  msalInstance,
  setMsalInstance,
} from '../../utils/AuthProvider.util';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  fetchAllUsers,
  getUserDataFromOidc,
  matchUserDetails,
} from '../../utils/UserDataUtils';
import Auth0Authenticator from '../authenticators/Auth0Authenticator';
import MsalAuthenticator from '../authenticators/MsalAuthenticator';
import OidcAuthenticator from '../authenticators/OidcAuthenticator';
import OktaAuthenticator from '../authenticators/OktaAuthenticator';
import Auth0Callback from '../callbacks/Auth0Callback/Auth0Callback';
import { AuthenticatorRef, OidcUser } from './AuthProvider.interface';
import OktaAuthProvider from './okta-auth-provider';

interface AuthProviderProps {
  childComponentType: ComponentType;
  children: ReactNode;
}

const cookieStorage = new CookieStorage();

const userAPIQueryFields = 'profile,teams,roles';

export const AuthProvider = ({
  childComponentType,
  children,
}: AuthProviderProps) => {
  const location = useLocation();
  const history = useHistory();
  const [timeoutId, setTimeoutId] = useState<number>();
  const authenticatorRef = useRef<AuthenticatorRef>(null);

  const oidcUserToken = localStorage.getItem(oidcTokenKey);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(
    Boolean(oidcUserToken)
  );
  const [isAuthDisabled, setIsAuthDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authConfig, setAuthConfig] =
    useState<Record<string, string | boolean>>();
  const [isSigningIn, setIsSigningIn] = useState(false);

  let silentSignInRetries = 0;

  const onLoginHandler = () => {
    authenticatorRef.current?.invokeLogin();
  };

  const onLogoutHandler = () => {
    authenticatorRef.current?.invokeLogout();
  };

  const onRenewIdTokenHandler = () => {
    return authenticatorRef.current?.renewIdToken();
  };

  const handledVerifiedUser = () => {
    if (!isProtectedRoute(location.pathname)) {
      const urlPathname = cookieStorage.getItem(REDIRECT_PATHNAME);
      if (urlPathname) {
        cookieStorage.removeItem(REDIRECT_PATHNAME);
        history.push(urlPathname);
      } else {
        history.push(ROUTES.HOME);
      }
    }
  };

  const setLoadingIndicator = (value: boolean) => {
    setLoading(value);
  };

  /**
   * Stores redirect URL for successful login
   */
  function storeRedirectPath() {
    const redirectPathExists = Boolean(
      cookieStorage.getItem(REDIRECT_PATHNAME)
    );
    if (!redirectPathExists) {
      cookieStorage.setItem(REDIRECT_PATHNAME, appState.getUrlPathname(), {
        expires: getUrlPathnameExpiry(),
        path: '/',
      });
    }
  }

  const resetUserDetails = (forceLogout = false) => {
    appState.updateUserDetails({} as User);
    appState.updateUserPermissions({} as UserPermissions);
    localStorage.removeItem(oidcTokenKey);
    setIsUserAuthenticated(false);
    setLoadingIndicator(false);
    if (forceLogout) {
      onLogoutHandler();
    } else {
      history.push(ROUTES.SIGNIN);
    }
  };

  const getUserPermissions = () => {
    setLoading(true);
    getLoggedInUserPermissions()
      .then((res: AxiosResponse) => {
        appState.updateUserPermissions(res.data.metadataOperations);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-user-permission-error']
        );
      })
      .finally(() => setLoading(false));
  };

  const getLoggedInUserDetails = () => {
    setLoading(true);
    getLoggedInUser(userAPIQueryFields)
      .then((res: AxiosResponse) => {
        if (res.data) {
          getUserPermissions();
          appState.updateUserDetails(res.data);
          fetchAllUsers();
        } else {
          resetUserDetails();
          setLoading(false);
        }
      })
      .catch((err: AxiosError) => {
        resetUserDetails();
        if (err.response?.data.code !== 404) {
          showErrorToast(
            err,
            jsonData['api-error-messages']['fetch-logged-in-user-error']
          );
        }
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
      .then((res: AxiosResponse) => {
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
  const renewIdToken = (): Promise<string> => {
    const onRenewIdTokenHandlerPromise = onRenewIdTokenHandler();

    return new Promise((resolve, reject) => {
      if (onRenewIdTokenHandlerPromise) {
        onRenewIdTokenHandlerPromise
          .then(() => {
            resolve(localStorage.getItem(oidcTokenKey) || '');
          })
          .catch((error) => {
            if (error.message !== 'Frame window timed out') {
              reject(error);
            } else {
              resolve(localStorage.getItem(oidcTokenKey) || '');
            }
          });
      } else {
        reject('RenewIdTokenHandler is undefined');
      }
    });
  };

  /**
   * This method will try to signIn silently when token is about to expire
   * It will try for max 3 times if it's not succeed then it will proceed for logout
   */
  const trySilentSignIn = () => {
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
      : onLogoutHandler(); // Logout if we reaches max silent signIn limit;
  };

  /**
   * It will set an timer for 50 secs before Token will expire
   * If time if less then 50 secs then it will try to SilentSignIn
   * It will also ensure that we have time left for token expiry
   * This method will be call upon successful signIn
   */
  const startTokenExpiryTimer = () => {
    const token: string | void = localStorage.getItem(oidcTokenKey) || '';
    // If token is not present do nothing
    if (token) {
      try {
        // Extract expiry
        const { exp } = jwtDecode<JwtPayload>(token);
        if (exp && exp * 1000 > Date.now()) {
          // Check if token isn't expired yet
          const diff = exp * 1000 - Date.now(); /* Convert to MS */

          // Have 50s buffer before start trying for silent signIn
          // If token is about to expire then start silentSignIn
          // else just set timer to try for silentSignIn before token expires
          if (diff > 50000) {
            const timerId = setTimeout(() => {
              trySilentSignIn();
            }, diff);
            setTimeoutId(Number(timerId));
          } else {
            trySilentSignIn();
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error parsing id token.', error);
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

  useEffect(() => {
    startTokenExpiryTimer();

    return cleanup;
  }, []);

  const handleFailedLogin = () => {
    setIsSigningIn(false);
    setIsUserAuthenticated(false);
    history.push(ROUTES.SIGNIN);
  };

  const handleSuccessfulLogin = (user: OidcUser) => {
    setLoading(true);
    getUserByName(getNameFromEmail(user.profile.email), userAPIQueryFields)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const updatedUserData = getUserDataFromOidc(res.data, user);
          if (
            !matchUserDetails(res.data, updatedUserData, ['profile', 'email'])
          ) {
            getUpdatedUser(updatedUserData, res.data);
          } else {
            appState.updateUserDetails(res.data);
          }
          getUserPermissions();
          fetchAllUsers();
          handledVerifiedUser();
          // Start expiry timer on successful login
          startTokenExpiryTimer();
        }
      })
      .catch((err) => {
        if (err && err.response && err.response.status === 404) {
          appState.updateNewUser(user.profile);
          appState.updateUserDetails({} as User);
          appState.updateUserPermissions({} as UserPermissions);
          setIsSigningIn(true);
          history.push(ROUTES.SIGNUP);
        } else {
          showErrorToast(err);
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
    axiosClient.interceptors.request.use(async function (config) {
      const token: string | void = localStorage.getItem(oidcTokenKey) || '';
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }

      return config;
    });

    // Axios response interceptor for statusCode 401,403
    axiosClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status } = error.response;
          if (status === ClientErrors.UNAUTHORIZED) {
            storeRedirectPath();
            showErrorToast(error);
            resetUserDetails(true);
          } else if (status === ClientErrors.FORBIDDEN) {
            showErrorToast(jsonData['api-error-messages']['forbidden-error']);
          }
        }

        throw error;
      }
    );
  };

  const fetchAuthConfig = (): void => {
    fetchAuthenticationConfig()
      .then((authRes: AxiosResponse) => {
        const isSecureMode =
          !isNil(authRes.data) && authRes.data.provider !== NO_AUTH;
        if (isSecureMode) {
          const { provider, providerName, authority, clientId, callbackUrl } =
            authRes.data;
          // show an error toast if provider is null or not supported
          if (provider && Object.values(AuthTypes).includes(provider)) {
            const configJson = getAuthConfig({
              authority,
              clientId,
              callbackUrl,
              provider,
              providerName,
            });
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
              `The configured SSO Provider "${provider}" is not supported. Please check the authentication configuration in the server.`
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
            location.pathname !== ROUTES.SIGNIN)
        ) {
          getLoggedInUserDetails();
        }
      }
    });
  }, [history]);

  useEffect(() => {
    appState.updateUrlPathname(location.pathname);
  }, [location.pathname]);

  const isLoading =
    !isAuthDisabled &&
    (!authConfig || (authConfig.provider === AuthTypes.AZURE && !msalInstance));

  const authContext = {
    isAuthenticated: isUserAuthenticated,
    setIsAuthenticated: setIsUserAuthenticated,
    isAuthDisabled,
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
  };

  return (
    <AuthContext.Provider value={authContext}>
      {isLoading ? <Loader /> : getProtectedApp()}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AuthContext = createContext({} as any);

export const useAuthContext = () => useContext(AuthContext);

export default observer(AuthProvider);
