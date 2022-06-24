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

import React, {
  ComponentType,
  forwardRef,
  Fragment,
  ReactNode,
  useImperativeHandle,
  useMemo,
} from 'react';
import { UserManager, WebStorageStateStore } from 'oidc-client';
import { Redirect, Route, Switch } from 'react-router-dom';
import {
  GoogleLoginResponse,
  useGoogleLogin,
  useGoogleLogout,
} from 'react-google-login';
import Appbar from '../../components/app-bar/Appbar';
import { oidcTokenKey, ROUTES } from '../../constants/constants';
import { useAuthContext } from '../auth-provider/AuthProvider';
import {
  AuthenticatorRef,
  OidcUser,
} from '../auth-provider/AuthProvider.interface';
import { refreshTokenSetup } from '../auth-provider/refreshToken';
import SigninPage from '../../pages/login';
import PageNotFound from '../../pages/page-not-found';
import { makeAuthenticator, makeUserManager } from 'react-oidc';
import Loader from '../../components/Loader/Loader';
import { isEmpty } from 'lodash';
import AppState from '../../AppState';

interface Props {
  children: ReactNode;
  childComponentType: ComponentType;
  userConfig: Record<string, string | boolean | WebStorageStateStore>;
  onLoginFailure: () => void;
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

const GoogleAuthenticator = forwardRef<AuthenticatorRef, Props>(
  (
    {
      childComponentType,
      children,
      onLoginSuccess,
      onLogoutSuccess,
      onLoginFailure,
      userConfig,
    }: Props,
    ref
  ) => {
    const { userDetails, newUser } = AppState;
    const {
      authConfig,
      isAuthDisabled,
      isAuthenticated,
      isSigningIn,
      loading,
      setIsAuthenticated,
    } = useAuthContext();
    const userManager = useMemo(
      () => makeUserManager(userConfig),
      [userConfig]
    );

    const googleClientLogin = useGoogleLogin({
      clientId: authConfig.clientId,
      onSuccess: (res) => {
        const { tokenObj, profileObj } = res as GoogleLoginResponse;
        const user = {
          // eslint-disable-next-line @typescript-eslint/camelcase
          id_token: tokenObj.id_token,
          scope: tokenObj.scope,
          profile: {
            email: profileObj.email,
            name: profileObj.name,
            picture: profileObj.imageUrl,
          },
        };
        setIsAuthenticated(true);
        localStorage.setItem(oidcTokenKey, tokenObj.id_token);
        refreshTokenSetup(res);
        onLoginSuccess(user);
      },
      onFailure: onLoginFailure,
      cookiePolicy: 'single_host_origin',
      isSignedIn: true,
    });

    const googleClientLogout = useGoogleLogout({
      clientId: authConfig.clientId,
      onLogoutSuccess: () => {
        setIsAuthenticated(false);
        onLogoutSuccess();
      },
      cookiePolicy: 'single_host_origin',
    });

    useImperativeHandle(ref, () => ({
      invokeLogin() {
        googleClientLogin.signIn();
      },
      invokeLogout() {
        googleClientLogout.signOut();
      },
      renewIdToken() {
        return Promise.resolve('');
      },
    }));

    const AppWithAuth = getAuthenticator(childComponentType, userManager);

    return (
      <Fragment>
        {!loading ? (
          <>
            <Appbar />
            {/* {children} */}
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
              {isAuthenticated || isAuthDisabled ? (
                <Fragment>{children}</Fragment>
              ) : !isSigningIn && isEmpty(userDetails) && isEmpty(newUser) ? (
                <Redirect to={ROUTES.SIGNIN} />
              ) : (
                <AppWithAuth />
              )}
            </Switch>
          </>
        ) : (
          <Loader />
        )}
      </Fragment>
    );
  }
);

GoogleAuthenticator.displayName = 'GoogleAuthenticator';

export default GoogleAuthenticator;
