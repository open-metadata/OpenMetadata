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
import { isEmpty } from 'lodash';
import { observer } from 'mobx-react';
import { User } from 'Models';
import { UserManager, WebStorageStateStore } from 'oidc-client';
import React, {
  ComponentType,
  FunctionComponent,
  useEffect,
  useState,
} from 'react';
import { Callback, makeAuthenticator, makeUserManager } from 'react-oidc';
import { Redirect, Route, Switch, useHistory } from 'react-router-dom';
import appState from '../AppState';
import { fetchAuthorizerConfig } from '../axiosAPIs/miscAPI';
import {
  getLoggedInUser,
  getTeams,
  getUserByName,
  getUsers,
} from '../axiosAPIs/userAPI';
import { oidcTokenKey, ROUTES, TIMEOUT } from '../constants/constants';
import { useAuth } from '../hooks/authHooks';
import SigninPage from '../pages/login';
import PageNotFound from '../pages/page-not-found';
import {
  getNameFromEmail,
  getOidcExpiry,
  getUserManagerConfig,
} from '../utils/AuthProvider.util';
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
  const history = useHistory();
  const { isSignedIn, isSigningIn, isSignedOut } = useAuth();

  const oidcUserToken = cookieStorage.getItem(oidcTokenKey);
  const [loading, setLoading] = useState(true);
  const [userManager, setUserManager] = useState<UserManager>(
    {} as UserManager
  );
  const [userManagerConfig, setUserManagerConfig] = useState<
    Record<string, string | WebStorageStateStore>
  >({});

  const clearOidcUserData = (
    userConfig: Record<string, string | WebStorageStateStore>
  ): void => {
    cookieStorage.removeItem(
      `oidc.user:${userConfig.authority}:${userConfig.client_id}`
    );
  };

  const handledVerifiedUser = () => {
    history.push(ROUTES.HOME);
  };

  // Moving this code here from App.tsx
  const getAllUsersList = (): void => {
    getUsers().then((res) => {
      appState.users = res.data.data;
    });
  };

  const getAllTeams = (): void => {
    getTeams().then((res) => {
      appState.userTeams = res.data.data;
    });
  };

  const fetchAllUsers = () => {
    getAllUsersList();
    getAllTeams();
    setInterval(getAllUsersList, TIMEOUT.USER_LIST);
  };

  const fetchUserByEmail = (user: OidcUser) => {
    getUserByName(getNameFromEmail(user.profile.email), userAPIQueryFields)
      .then((res: AxiosResponse) => {
        if (res.data) {
          appState.userDetails = res.data;
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
        if (res.data) {
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

  useEffect(() => {
    fetchAuthConfig();
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
              <Callback
                userManager={userManager}
                onSuccess={(user) => {
                  cookieStorage.setItem(oidcTokenKey, user.id_token, {
                    expires: getOidcExpiry(),
                  });
                  fetchUserByEmail(user as OidcUser);
                }}
              />
            )}
          />
          {isSignedOut ? <Redirect to={ROUTES.SIGNIN} /> : null}
          {oidcUserToken || !userManagerConfig?.client_id ? (
            children
          ) : (
            <AppWithAuth />
          )}
        </Switch>
      ) : null}
    </>
  );
};

export default observer(AuthProvider);
