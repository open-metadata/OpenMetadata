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
  forwardRef,
  Fragment,
  ReactNode,
  useImperativeHandle,
} from 'react';
import {
  GoogleLoginResponse,
  useGoogleLogin,
  useGoogleLogout,
} from 'react-google-login';
import { useAuthContext } from '../auth-provider/AuthProvider';
import {
  AuthenticatorRef,
  OidcUser,
} from '../auth-provider/AuthProvider.interface';
import { refreshTokenSetup } from '../auth-provider/refreshToken';
import { oidcTokenKey } from '../constants/constants';

interface Props {
  children: ReactNode;
  onLoginSuccess: (user: OidcUser) => void;
  onLogoutSuccess: () => void;
}

const GoogleAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children, onLoginSuccess, onLogoutSuccess }: Props, ref) => {
    const { authConfig, setIsAuthenticated } = useAuthContext();

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
        // eslint-disable-next-line no-console
        console.log('Login Success: currentUser:', res);
        setIsAuthenticated(true);
        localStorage.setItem(oidcTokenKey, tokenObj.id_token);
        refreshTokenSetup(res);
        onLoginSuccess(user);
      },
      onFailure: (res) => {
        // eslint-disable-next-line no-console
        console.log('Login failed: res:', res);
      },
      cookiePolicy: 'single_host_origin',
      isSignedIn: true,
    });

    const googleClientLogout = useGoogleLogout({
      clientId: authConfig.clientId,
      onLogoutSuccess: () => {
        setIsAuthenticated(false);
        onLogoutSuccess();
      },
      onFailure: () => {
        // eslint-disable-next-line no-console
        console.log('Logout failed!');
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
    }));

    return <Fragment>{children}</Fragment>;
  }
);

GoogleAuthenticator.displayName = 'GoogleAuthenticator';

export default GoogleAuthenticator;
