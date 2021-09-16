/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { AxiosResponse } from 'axios';
import { CookieStorage } from 'cookie-storage';
import { isEmpty, isNil } from 'lodash';
import { observer } from 'mobx-react';
import { NewUser, User } from 'Models';
import { UserManager, WebStorageStateStore } from 'oidc-client';
import React, {
  ComponentType,
  FunctionComponent,
  useEffect,
  useState,
} from 'react';
import { Callback, makeAuthenticator, makeUserManager } from 'react-oidc';
import {
  Redirect,
  Route,
  Switch,
  useHistory,
  useLocation,
} from 'react-router-dom';
import appState from '../AppState';
import axiosClient from '../axiosAPIs';
import { fetchAuthorizerConfig } from '../axiosAPIs/miscAPI';
import { getLoggedInUser, getUserByName } from '../axiosAPIs/userAPI';
import Loader from '../components/Loader/Loader';
import { FirstTimeUserModal } from '../components/Modals/FirstTimeUserModal/FirstTimeUserModal';
import { COOKIE_VERSION } from '../components/Modals/WhatsNewModal/whatsNewData';
import { oidcTokenKey, ROUTES } from '../constants/constants';
import { ClientErrors } from '../enums/axios.enum';
import { useAuth } from '../hooks/authHooks';
import useToastContext from '../hooks/useToastContext';
import SigninPage from '../pages/login';
import PageNotFound from '../pages/page-not-found';
import {
  getNameFromEmail,
  getOidcExpiry,
  getUserManagerConfig,
} from '../utils/AuthProvider.util';
import { fetchAllUsers } from '../utils/UsedDataUtils';
import { AuthProviderProps, OidcUser } from './AuthProvider.interface';

const cookieStorage = new CookieStorage();
const userAPIQueryFields = 'profile, teams';

const getAuthenticator = (type: ComponentType, userManager: UserManager) => {
  return makeAuthenticator({
    userManager: userManager,
    signinArgs: {
      app: 'openmetadata',
    },
  })(type);
};

const AuthProvider: FunctionComponent<AuthProviderProps> = ({
  childComponentType,
  children,
}: AuthProviderProps) => {
  const location = useLocation();
  const history = useHistory();
  const showToast = useToastContext();
  const {
    isAuthenticatedRoute,
    isFirstTimeUser,
    isSignedIn,
    isSigningIn,
    isSignedOut,
  } = useAuth(location.pathname);

  const oidcUserToken = cookieStorage.getItem(oidcTokenKey);
  const [loading, setLoading] = useState(true);
  const [userManager, setUserManager] = useState<UserManager>(
    {} as UserManager
  );
  const [userManagerConfig, setUserManagerConfig] = useState<
    Record<string, string | boolean | WebStorageStateStore>
  >({});

  if (isFirstTimeUser) {
    cookieStorage.removeItem(COOKIE_VERSION);
  }

  const clearOidcUserData = (
    userConfig: Record<string, string | boolean | WebStorageStateStore>
  ): void => {
    cookieStorage.removeItem(
      `oidc.user:${userConfig.authority}:${userConfig.client_id}`
    );
  };

  const handledVerifiedUser = () => {
    history.push(ROUTES.HOME);
  };

  const fetchUserByEmail = (user: OidcUser) => {
    getUserByName(getNameFromEmail(user.profile.email), userAPIQueryFields)
      .then((res: AxiosResponse) => {
        if (res.data) {
          appState.userDetails = res.data;
          fetchAllUsers();
          handledVerifiedUser();
        } else {
          cookieStorage.removeItem(oidcTokenKey);
        }
      })
      .catch((err) => {
        if (err.response.data.code === 404) {
          appState.newUser = user.profile;
          appState.userDetails = {} as User;
          history.push(ROUTES.SIGNUP);
        }
      });
  };

  const resetUserDetails = () => {
    appState.userDetails = {} as User;
    cookieStorage.removeItem(oidcTokenKey);
    cookieStorage.removeItem(
      `oidc.user:${userManagerConfig?.authority}:${userManagerConfig?.client_id}`
    );
    window.location.href = ROUTES.SIGNIN;
  };

  const getLoggedInUserDetails = () => {
    setLoading(true);
    getLoggedInUser(userAPIQueryFields)
      .then((res: AxiosResponse) => {
        if (res.data) {
          appState.userDetails = res.data;
        } else {
          resetUserDetails();
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.response.data.code === 404) {
          resetUserDetails();
        }
      });
  };
  const fetchAuthConfig = (): void => {
    fetchAuthorizerConfig()
      .then((res: AxiosResponse) => {
        const isSecureMode =
          !isNil(res.data) &&
          Object.values(res.data).filter((item) => isNil(item)).length === 0;
        if (isSecureMode) {
          const { provider, authority, clientId, callbackUrl } = res.data;
          const userConfig = getUserManagerConfig({
            authority,
            clientId,
            callbackUrl,
          });
          setUserManagerConfig(userConfig);
          setUserManager(makeUserManager(userConfig));
          if (!oidcUserToken) {
            clearOidcUserData(userConfig);
            setLoading(false);
          } else {
            getLoggedInUserDetails();
          }
          // eslint-disable-next-line @typescript-eslint/camelcase
          appState.authProvider = { authority, provider, client_id: clientId };
          appState.authDisabled = false;
        } else {
          appState.authDisabled = true;
          setLoading(false);
        }
      })
      .finally(() => {
        if (oidcUserToken || appState.authDisabled) {
          fetchAllUsers();
        }
      });
  };

  const handleFirstTourModal = (skip: boolean) => {
    appState.newUser = {} as NewUser;
    if (skip) {
      history.push(ROUTES.HOME);
    } else {
      // TODO: Route to tour page
    }
  };

  useEffect(() => {
    fetchAuthConfig();

    // Axios intercepter for statusCode 403
    axiosClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status } = error.response;
          if (status === ClientErrors.FORBIDDEN) {
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
    return history.listen((location) => {
      if (!appState.authDisabled && !appState.userDetails) {
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

  const AppWithAuth = getAuthenticator(childComponentType, userManager);

  return (
    <>
      {!loading ? (
        <>
          <Switch>
            <Route exact path={ROUTES.HOME}>
              {!isSignedIn && !isSigningIn ? (
                <Redirect to={ROUTES.SIGNIN} />
              ) : (
                <Redirect to={ROUTES.MY_DATA} />
              )}
            </Route>
            <Route exact component={PageNotFound} path={ROUTES.NOT_FOUND} />
            {!isSigningIn ? (
              <Route exact component={SigninPage} path={ROUTES.SIGNIN} />
            ) : null}
            <Route
              path={ROUTES.CALLBACK}
              render={() => (
                <>
                  <Callback
                    userManager={userManager}
                    onSuccess={(user) => {
                      cookieStorage.setItem(oidcTokenKey, user.id_token, {
                        expires: getOidcExpiry(),
                      });
                      fetchUserByEmail(user as OidcUser);
                    }}
                  />
                  <Loader />
                </>
              )}
            />
            {isSignedOut ? <Redirect to={ROUTES.SIGNIN} /> : null}
            {oidcUserToken || !userManagerConfig?.client_id ? (
              children
            ) : (
              <AppWithAuth />
            )}
          </Switch>
          {isAuthenticatedRoute && isFirstTimeUser ? (
            <FirstTimeUserModal
              onCancel={() => handleFirstTourModal(true)}
              onSave={() => handleFirstTourModal(false)}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
};

export default observer(AuthProvider);
