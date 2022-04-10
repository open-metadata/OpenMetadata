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

import { useAuth0 } from '@auth0/auth0-react';
import React, {
  forwardRef,
  Fragment,
  ReactNode,
  useImperativeHandle,
} from 'react';
import { oidcTokenKey } from '../../constants/constants';
import { AuthTypes } from '../../enums/signin.enum';
import { useAuthContext } from '../auth-provider/AuthProvider';
import { AuthenticatorRef } from '../auth-provider/AuthProvider.interface';

interface Props {
  children: ReactNode;
  onLogoutSuccess: () => void;
}

const Auth0Authenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children, onLogoutSuccess }: Props, ref) => {
    const { setIsAuthenticated, authConfig } = useAuthContext();
    const {
      loginWithRedirect,
      logout,
      getAccessTokenSilently,
      getIdTokenClaims,
    } = useAuth0();

    useImperativeHandle(ref, () => ({
      invokeLogin() {
        loginWithRedirect();
      },
      invokeLogout() {
        logout();
        setIsAuthenticated(false);
        onLogoutSuccess();
      },
      renewIdToken() {
        let idToken = '';
        if (authConfig && authConfig.provider !== undefined) {
          return new Promise((resolve, reject) => {
            const { provider } = authConfig;
            if (provider === AuthTypes.AUTH0) {
              getAccessTokenSilently()
                .then(() => {
                  getIdTokenClaims()
                    .then((token) => {
                      if (token !== undefined) {
                        idToken = token.__raw;
                        localStorage.setItem(oidcTokenKey, idToken);
                        resolve(idToken);
                      }
                    })
                    .catch((err) => {
                      reject(
                        `Error while renewing id token from Auth0 SSO: ${err.message}`
                      );
                    });
                })
                .catch((err) => {
                  reject(
                    `Error while renewing id token from Auth0 SSO: ${err.message}`
                  );
                });
            } else {
              reject(
                `Auth Provider ${provider} not supported for renewing tokens.`
              );
            }
          });
        } else {
          return Promise.reject(
            'Cannot renew id token. Authentication Provider is not present.'
          );
        }
      },
    }));

    return <Fragment>{children}</Fragment>;
  }
);

Auth0Authenticator.displayName = 'Auth0Authenticator';

export default Auth0Authenticator;
