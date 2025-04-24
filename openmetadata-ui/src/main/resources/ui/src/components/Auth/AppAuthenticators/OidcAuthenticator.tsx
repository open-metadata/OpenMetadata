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

import { OidcConfiguration, OidcProvider, useOidc } from '@axa-fr/react-oidc';
import { isEmpty } from 'lodash';
import {
  ComponentType,
  forwardRef,
  Fragment,
  ReactNode,
  useImperativeHandle,
} from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import SignInPage from '../../../pages/LoginPage/SignInPage';
import Loader from '../../common/Loader/Loader';
import {
  AuthenticatorRef,
  OidcUser,
} from '../AuthProviders/AuthProvider.interface';

interface Props {
  childComponentType: ComponentType;
  children: ReactNode;
  userConfig: OidcConfiguration;
  onLoginFailure: () => void;
  onLoginSuccess: (user: OidcUser) => void;
  onLogoutSuccess: () => void;
}

const OidcAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children, userConfig, onLogoutSuccess }: Props, ref) => {
    const {
      isSigningUp,
      setIsSigningUp,
      currentUser,
      newUser,
      isApplicationLoading,
    } = useApplicationStore();
    const location = useCustomLocation();
    const { login, logout, isAuthenticated: oidcIsAuthenticated } = useOidc();

    const handleLogin = async () => {
      setIsSigningUp(true);
      await login();
    };

    const handleLogout = async () => {
      await logout();
      onLogoutSuccess();
    };

    const signInSilently = async () => {
      // @axa-fr/react-oidc handles silent refresh automatically
      return;
    };

    useImperativeHandle(ref, () => ({
      invokeLogin: handleLogin,
      invokeLogout: handleLogout,
      renewIdToken: signInSilently,
    }));

    return (
      <OidcProvider configuration={userConfig}>
        <Routes>
          <Route path={ROUTES.HOME}>
            {!oidcIsAuthenticated && !isSigningUp ? (
              <Navigate to={ROUTES.SIGNIN} />
            ) : (
              <Navigate to={ROUTES.MY_DATA} />
            )}
          </Route>

          {!isSigningUp ? (
            <Route element={<SignInPage />} path={ROUTES.SIGNIN} />
          ) : null}

          {!location.pathname.includes(ROUTES.SILENT_CALLBACK) &&
            (oidcIsAuthenticated ? (
              !location.pathname.includes(ROUTES.SILENT_CALLBACK) && (
                <Fragment>{children}</Fragment>
              )
            ) : !isSigningUp && isEmpty(currentUser) && isEmpty(newUser) ? (
              <Navigate to={ROUTES.SIGNIN} />
            ) : (
              <Fragment>{children}</Fragment>
            ))}
        </Routes>

        {isApplicationLoading && isSigningUp && <Loader fullScreen />}
      </OidcProvider>
    );
  }
);

OidcAuthenticator.displayName = 'OidcAuthenticator';

export default OidcAuthenticator;
