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

import { isEmpty } from 'lodash';
import { UserManager, WebStorageStateStore } from 'oidc-client';
import React, {
  ComponentType,
  forwardRef,
  Fragment,
  ReactNode,
  useImperativeHandle,
  useMemo,
} from 'react';
import { Callback, makeAuthenticator, makeUserManager } from 'react-oidc';
import { Redirect, Route, Switch } from 'react-router-dom';
import AppState from '../AppState';
import { useAuthContext } from '../auth-provider/AuthProvider';
import {
  AuthenticatorRef,
  OidcUser,
} from '../auth-provider/AuthProvider.interface';
import Appbar from '../components/app-bar/Appbar';
import Loader from '../components/Loader/Loader';
import { oidcTokenKey, ROUTES } from '../constants/constants';
import SigninPage from '../pages/login';
import PageNotFound from '../pages/page-not-found';

interface Props {
  childComponentType: ComponentType;
  children: ReactNode;
  userConfig: Record<string, string | boolean | WebStorageStateStore>;
  onLoginSuccess: (user: OidcUser) => void;
  onLogoutSuccess: () => void;
}

const getAuthenticator = (type: ComponentType, userManager: UserManager) => {
  return makeAuthenticator({
    userManager: userManager,
    signinArgs: {
      app: 'openmetadata',
    },
  })(type);
};

const OidcAuthenticator = forwardRef<AuthenticatorRef, Props>(
  (
    {
      childComponentType,
      children,
      userConfig,
      onLoginSuccess,
      onLogoutSuccess,
    }: Props,
    ref
  ) => {
    const {
      loading,
      isAuthenticated,
      setIsAuthenticated,
      isAuthDisabled,
      isSigningIn,
      setIsSigningIn,
      setLoadingIndicator,
    } = useAuthContext();
    const { userDetails, newUser } = AppState;
    const userManager = useMemo(
      () => makeUserManager(userConfig),
      [userConfig]
    );

    const login = () => {
      setIsSigningIn(true);
    };

    const logout = () => {
      setLoadingIndicator(true);
      setIsAuthenticated(false);
      localStorage.removeItem(
        `oidc.user:${userConfig.authority}:${userConfig.client_id}`
      );
      onLogoutSuccess();
    };

    useImperativeHandle(ref, () => ({
      invokeLogin() {
        login();
      },
      invokeLogout() {
        logout();
      },
    }));

    const AppWithAuth = getAuthenticator(childComponentType, userManager);

    return (
      <Fragment>
        {!loading ? (
          <>
            <Appbar />
            <Switch>
              <Route exact path={ROUTES.HOME}>
                {!isAuthDisabled && !isAuthenticated && !isSigningIn ? (
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
                        localStorage.setItem(oidcTokenKey, user.id_token);
                        setIsAuthenticated(true);
                        onLoginSuccess(user as OidcUser);
                      }}
                    />
                    <Loader />
                  </>
                )}
              />
              {isAuthenticated || isAuthDisabled ? (
                <Fragment>{children}</Fragment>
              ) : !isSigningIn && isEmpty(userDetails) && isEmpty(newUser) ? (
                <Redirect to={ROUTES.SIGNIN} />
              ) : (
                <AppWithAuth />
              )}
            </Switch>
            {/* TODO: Uncomment below lines to show Welcome modal on Sign-up */}
            {/* {isAuthenticatedRoute && isFirstTimeUser ? (
            <FirstTimeUserModal
              onCancel={() => handleFirstTourModal(true)}
              onSave={() => handleFirstTourModal(false)}
            />
          ) : null} */}
          </>
        ) : (
          <Loader />
        )}
      </Fragment>
    );
  }
);

OidcAuthenticator.displayName = 'OidcAuthenticator';

export default OidcAuthenticator;
