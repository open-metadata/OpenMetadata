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

import { Configuration } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { LoginCallback } from '@okta/okta-react';
import { AxiosError, AxiosResponse } from 'axios';
import { CookieStorage } from 'cookie-storage';
import { isEmpty, isNil } from 'lodash';
import { observer } from 'mobx-react';
import { UserPermissions } from 'Models';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import appState from '../AppState';
import GoogleAuthenticator from '../authenticators/GoogleAuthenticator';
import MsalAuthenticator from '../authenticators/MsalAuthenticator';
import OktaAuthenticator from '../authenticators/OktaAuthenticator';
import axiosClient from '../axiosAPIs';
import {
  fetchAuthenticationConfig,
  fetchAuthorizerConfig,
  getLoggedInUserPermissions,
} from '../axiosAPIs/miscAPI';
import {
  getLoggedInUser,
  getUserByName,
  updateUser,
} from '../axiosAPIs/userAPI';
import Loader from '../components/Loader/Loader';
import { NOOP_FILTER, NO_AUTH } from '../constants/auth.constants';
import { isAdminUpdated, oidcTokenKey, ROUTES } from '../constants/constants';
import { ClientErrors } from '../enums/axios.enum';
import { AuthTypes } from '../enums/signin.enum';
import { User } from '../generated/entity/teams/user';
import useToastContext from '../hooks/useToastContext';
import {
  getAuthConfig,
  getNameFromEmail,
  isProtectedRoute,
  isTourRoute,
  msalInstance,
  setMsalInstance,
} from '../utils/AuthProvider.util';
import { getImages } from '../utils/CommonUtils';
import { fetchAllUsers } from '../utils/UsedDataUtils';
import { AuthenticatorRef, OidcUser } from './AuthProvider.interface';
import OktaAuthProvider from './okta-auth-provider';

interface AuthProviderProps {
  children: ReactNode;
}

const cookieStorage = new CookieStorage();
const userAPIQueryFields = 'profile,teams,roles';

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const location = useLocation();
  const history = useHistory();
  const showToast = useToastContext();

  const authenticatorRef = useRef<AuthenticatorRef>(null);

  const oidcUserToken = localStorage.getItem(oidcTokenKey);

  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(oidcUserToken || localStorage.getItem('okta-token-storage'))
  );
  const [isAuthDisabled, setIsAuthDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authConfig, setAuthConfig] =
    useState<Record<string, string | boolean>>();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const onLoginHandler = () => {
    authenticatorRef.current?.invokeLogin();
  };

  const onLogoutHandler = () => {
    authenticatorRef.current?.invokeLogout();
  };

  const handledVerifiedUser = () => {
    if (!isProtectedRoute(location.pathname)) {
      history.push(ROUTES.HOME);
    }
  };

  const resetUserDetails = (forceLogout = false) => {
    appState.updateUserDetails({} as User);
    appState.updateUserPermissions({} as UserPermissions);
    localStorage.removeItem(oidcTokenKey);
    if (forceLogout) {
      onLogoutHandler();
    }
    window.location.href = ROUTES.SIGNIN;
  };

  const setLoadingIndicator = (value: boolean) => {
    setLoading(value);
  };

  const getUserPermissions = () => {
    setLoading(true);
    getLoggedInUserPermissions()
      .then((res: AxiosResponse) => {
        appState.updateUserPermissions(res.data.metadataOperations);
      })
      .catch(() =>
        showToast({
          variant: 'error',
          body: 'Error while getting user permissions',
        })
      )
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
      .catch((err) => {
        if (err.response.data.code === 404) {
          resetUserDetails();
        }
      });
  };

  const getUpdatedUser = (data: User, user: OidcUser) => {
    let getAdminCookie = localStorage.getItem(isAdminUpdated);

    // TODO: Remove when using cookie no more
    if (!getAdminCookie) {
      getAdminCookie = cookieStorage.getItem(isAdminUpdated);
      if (getAdminCookie) {
        localStorage.setItem(isAdminUpdated, getAdminCookie);
      }
    }

    if (getAdminCookie) {
      appState.updateUserDetails(data);
    } else {
      const updatedData = {
        isAdmin: data.isAdmin,
        email: data.email,
        name: data.name,
        displayName: user.profile.name,
        profile: { images: getImages(user.profile.picture ?? '') },
      };
      updateUser(updatedData)
        .then((res: AxiosResponse) => {
          appState.updateUserDetails(res.data);
          localStorage.setItem(isAdminUpdated, 'true');
        })
        .catch(() => {
          showToast({
            variant: 'error',
            body: 'Error while updating admin user profile',
          });
        });
    }
  };

  const handleSuccessfulLogin = (user: OidcUser) => {
    getUserByName(getNameFromEmail(user.profile.email), userAPIQueryFields)
      .then((res: AxiosResponse) => {
        if (res.data) {
          if (res.data?.isAdmin) {
            getUpdatedUser(res.data, user);
          }
          getUserPermissions();
          appState.updateUserDetails(res.data);
          fetchAllUsers();
          handledVerifiedUser();
        }
      })
      .catch((err) => {
        if (err.response.data.code === 404) {
          appState.updateNewUser(user.profile);
          appState.updateUserDetails({} as User);
          appState.updateUserPermissions({} as UserPermissions);
          setIsSigningIn(true);
          history.push(ROUTES.SIGNUP);
        }
      });
  };

  const handleSuccessfulLogout = () => {
    resetUserDetails();
  };

  const getAuthenticatedUser = (config: Record<string, string | boolean>) => {
    switch (config?.provider) {
      case AuthTypes.OKTA:
      case AuthTypes.AZURE: {
        getLoggedInUserDetails();

        break;
      }
    }
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

  const fetchAuthConfig = (): void => {
    const promises = [fetchAuthenticationConfig(), fetchAuthorizerConfig()];
    Promise.allSettled(promises)
      .then(
        ([
          authenticationConfig,
          authorizerConfig,
        ]: PromiseSettledResult<AxiosResponse>[]) => {
          let authRes = {} as AxiosResponse;
          if (authenticationConfig.status === 'fulfilled') {
            authRes = authenticationConfig.value;
            const authorizerRes =
              authorizerConfig.status === 'fulfilled'
                ? authorizerConfig.value
                : ({} as AxiosResponse);
            const isSecureMode =
              !isNil(authRes.data) &&
              authorizerRes?.data?.containerRequestFilter &&
              authRes.data.provider !== NO_AUTH &&
              authorizerRes.data.containerRequestFilter !== NOOP_FILTER &&
              Object.values(authRes.data).filter((item) => isNil(item))
                .length === 0;
            if (isSecureMode) {
              const { provider, authority, clientId, callbackUrl } =
                authRes.data;
              const configJson = getAuthConfig({
                authority,
                clientId,
                callbackUrl,
                provider,
              });
              setAuthConfig(configJson);
              updateAuthInstance(configJson);
              if (!oidcUserToken) {
                setLoading(false);
              } else {
                getAuthenticatedUser(configJson);
              }
            } else {
              setLoading(false);
              setIsAuthDisabled(true);
              fetchAllUsers();
            }
          } else {
            authenticationConfig.reason as AxiosError;
            showToast({
              variant: 'error',
              body:
                (authenticationConfig.reason as AxiosError).response?.data
                  .message || 'Error occured while fetching auth config',
            });
          }
        }
      )
      .catch(() => {
        showToast({
          variant: 'error',
          body: 'Error occured while fetching auth config',
        });
      });
  };

  const getCallBackComponent = () => {
    switch (authConfig?.provider) {
      case AuthTypes.OKTA: {
        return LoginCallback;
      }
      default: {
        return null;
      }
    }
  };

  const getProtectedApp = () => {
    switch (authConfig?.provider) {
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
      case AuthTypes.GOOGLE: {
        return (
          <GoogleAuthenticator
            ref={authenticatorRef}
            onLoginSuccess={handleSuccessfulLogin}
            onLogoutSuccess={handleSuccessfulLogout}>
            {children}
          </GoogleAuthenticator>
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

    // Axios intercepter for statusCode 401,403
    axiosClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status } = error.response;
          if (status === ClientErrors.UNAUTHORIZED) {
            resetUserDetails(true);
          } else if (status === ClientErrors.FORBIDDEN) {
            showToast({
              variant: 'error',
              body: 'You do not have permission for this action!',
            });
          }
        }

        throw error;
      }
    );
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

  const isLoading =
    !isAuthDisabled &&
    (!authConfig || (authConfig.provider === AuthTypes.AZURE && !msalInstance));

  const authContext = {
    isAuthenticated,
    setIsAuthenticated,
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
