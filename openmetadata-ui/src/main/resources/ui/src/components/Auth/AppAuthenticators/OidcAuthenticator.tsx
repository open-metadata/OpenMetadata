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
import { Redirect, Route, Switch, useHistory } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import SignInPage from '../../../pages/LoginPage/SignInPage';
import PageNotFound from '../../../pages/PageNotFound/PageNotFound';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import {
  AuthenticatorRef,
  OidcUser,
} from '../AuthProviders/AuthProvider.interface';

interface Props {
  childComponentType: ComponentType;
  children: ReactNode;
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

const OidcAuthenticator = forwardRef<AuthenticatorRef, Props>(
  (
    {
      childComponentType,
      children,
      userConfig,
      onLoginSuccess,
      onLoginFailure,
      onLogoutSuccess,
    }: Props,
    ref
  ) => {
    const {
      isAuthenticated,
      setIsAuthenticated,
      isSigningIn,
      setIsSigningIn,
      updateAxiosInterceptors,
      currentUser,
      newUser,
      setOidcToken,
    } = useApplicationStore();
    const history = useHistory();
    const userManager = useMemo(
      () => makeUserManager(userConfig),
      [userConfig]
    );

    const login = () => {
      setIsSigningIn(true);
    };

    const logout = () => {
      userManager.removeUser();
      onLogoutSuccess();
    };

    // Performs silent signIn and returns with IDToken
    const signInSilently = async () => {
      const user = await userManager.signinSilent();
      setOidcToken(user.id_token);

      return user.id_token;
    };

    useImperativeHandle(ref, () => ({
      invokeLogin() {
        login();
      },
      invokeLogout() {
        logout();
      },
      renewIdToken() {
        return signInSilently();
      },
    }));

    const AppWithAuth = getAuthenticator(childComponentType, userManager);

    return (
      <>
        <Switch>
          <Route exact path={ROUTES.HOME}>
            {!isAuthenticated && !isSigningIn ? (
              <Redirect to={ROUTES.SIGNIN} />
            ) : (
              <Redirect to={ROUTES.MY_DATA} />
            )}
          </Route>
          <Route exact component={PageNotFound} path={ROUTES.NOT_FOUND} />
          {!isSigningIn ? (
            <Route exact component={SignInPage} path={ROUTES.SIGNIN} />
          ) : null}
          <Route
            path={ROUTES.CALLBACK}
            render={() => (
              <>
                <Callback
                  userManager={userManager}
                  onError={(error) => {
                    showErrorToast(error?.message);
                    onLoginFailure();
                  }}
                  onSuccess={(user) => {
                    setOidcToken(user.id_token);
                    setIsAuthenticated(true);
                    onLoginSuccess(user as OidcUser);
                  }}
                />
              </>
            )}
          />

          <Route
            path={ROUTES.SILENT_CALLBACK}
            render={() => (
              <>
                <Callback
                  userManager={userManager}
                  onError={(error) => {
                    // eslint-disable-next-line no-console
                    console.error(error);

                    history.push(ROUTES.SIGNIN);
                  }}
                  onSuccess={(user) => {
                    setOidcToken(user.id_token);
                    updateAxiosInterceptors();
                  }}
                />
              </>
            )}
          />
          {isAuthenticated ? (
            <Fragment>{children}</Fragment>
          ) : !isSigningIn && isEmpty(currentUser) && isEmpty(newUser) ? (
            <Redirect to={ROUTES.SIGNIN} />
          ) : (
            <AppWithAuth />
          )}
        </Switch>
        {isSigningIn && <Loader fullScreen />}
      </>
    );
  }
);

OidcAuthenticator.displayName = 'OidcAuthenticator';

export default OidcAuthenticator;
