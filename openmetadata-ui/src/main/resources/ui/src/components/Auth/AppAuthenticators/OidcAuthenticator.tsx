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
import { User, UserManager, WebStorageStateStore } from 'oidc-client';
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
import { ROUTES } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import SignInPage from '../../../pages/LoginPage/SignInPage';
import TokenService from '../../../utils/Auth/TokenService/TokenServiceUtil';
import { setOidcToken } from '../../../utils/LocalStorageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import { useAuthProvider } from '../AuthProviders/AuthProvider';
import {
  AuthenticatorRef,
  OidcUser,
} from '../AuthProviders/AuthProvider.interface';

interface Props {
  childComponentType: ComponentType;
  children: ReactNode;
  userConfig: Record<string, string | boolean | WebStorageStateStore>;
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
  ({ childComponentType, children, userConfig }: Props, ref) => {
    const {
      isAuthenticated,
      isSigningUp,
      setIsSigningUp,
      currentUser,
      newUser,
      isApplicationLoading,
    } = useApplicationStore();
    const {
      handleSuccessfulLogout,
      handleFailedLogin,
      handleSuccessfulLogin,
      updateAxiosInterceptors,
    } = useAuthProvider();

    const location = useCustomLocation();
    const userManager = useMemo(
      () => makeUserManager({ ...userConfig, silentRequestTimeout: 20000 }),
      [userConfig]
    );

    const login = () => {
      // Clear any stale state in the user manager before starting the sign in flow
      // Remove the existing user configuration for the user who is different from the user trying to log in
      userManager.clearStaleState();
      // Remove the existing user configuration for the same user who is trying to log
      userManager.removeUser();
      setIsSigningUp(true);
    };

    const logout = async () => {
      try {
        await userManager.signoutRedirect({
          post_logout_redirect_uri: window.location.origin,
        });
      } catch (error) {
        // If signout fails, still clean up local state
        userManager.removeUser();
      } finally {
        // Cleanup application state
        handleSuccessfulLogout();
      }
    };

    // Performs silent signIn and returns with IDToken
    const signInSilently = async () => {
      // For OIDC token will be coming as silent-callback as an IFram hence not returning new token here
      await userManager.signinSilent();
    };

    const handleSilentSignInSuccess = (user: User) => {
      // On success update token in store and update axios interceptors
      setOidcToken(user.id_token);
      updateAxiosInterceptors();
      // Clear the refresh token in progress flag
      // Since refresh token request completes with a callback
      TokenService.getInstance().clearRefreshInProgress();
    };

    const handleSilentSignInFailure = (error: unknown) => {
      // eslint-disable-next-line no-console
      console.error(error);

      try {
        userManager.removeUser();
      } finally {
        // If silent sign in fails, we need to logout the user
        handleSuccessfulLogout();
      }
    };

    useImperativeHandle(ref, () => ({
      invokeLogin: login,
      invokeLogout: logout,
      renewIdToken: signInSilently,
    }));

    const AppWithAuth = getAuthenticator(childComponentType, userManager);

    return (
      <>
        <Switch>
          {/* render sign in page if user is not authenticated and not signing up
           * else redirect to my data page as user is authenticated and not signing up
           */}
          <Route exact path={ROUTES.HOME}>
            {!isAuthenticated && !isSigningUp ? (
              <Redirect to={ROUTES.SIGNIN} />
            ) : (
              <Redirect to={ROUTES.MY_DATA} />
            )}
          </Route>

          {/* render the sign in route only if user is not signing up */}
          {!isSigningUp ? (
            <Route exact component={SignInPage} path={ROUTES.SIGNIN} />
          ) : null}

          {/* callback route to handle the auth flow after user has successfully provided their consent */}
          <Route
            path={ROUTES.CALLBACK}
            render={() => (
              <>
                <Callback
                  userManager={userManager}
                  onError={(error) => {
                    showErrorToast(error?.message);
                    handleFailedLogin();
                  }}
                  onSuccess={(user) => {
                    setOidcToken(user.id_token);
                    handleSuccessfulLogin(user as OidcUser);
                  }}
                />
              </>
            )}
          />

          {/* silent callback route to handle the silent auth flow */}
          <Route
            path={ROUTES.SILENT_CALLBACK}
            render={() => (
              <Callback
                userManager={userManager}
                onError={handleSilentSignInFailure}
                onSuccess={handleSilentSignInSuccess}
              />
            )}
          />

          {!location.pathname.includes(ROUTES.SILENT_CALLBACK) &&
            // render the children only if user is authenticated
            (isAuthenticated ? (
              !location.pathname.includes(ROUTES.SILENT_CALLBACK) && (
                <Fragment>{children}</Fragment>
              )
            ) : // render the sign in page if user is not authenticated and not signing up
            !isSigningUp && isEmpty(currentUser) && isEmpty(newUser) ? (
              <Redirect to={ROUTES.SIGNIN} />
            ) : (
              // render the authenticator component to handle the auth flow while user is signing in
              <AppWithAuth />
            ))}
        </Switch>

        {/* show loader when application is loading and user is signing up*/}
        {isApplicationLoading && isSigningUp && <Loader fullScreen />}
      </>
    );
  }
);

OidcAuthenticator.displayName = 'OidcAuthenticator';

export default OidcAuthenticator;
