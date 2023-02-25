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

import { useAuth0 } from '@auth0/auth0-react';
import React, {
  forwardRef,
  Fragment,
  ReactNode,
  useImperativeHandle,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AuthTypes } from '../../../enums/signin.enum';
import localState from '../../../utils/LocalStorageUtils';
import { useAuthContext } from '../auth-provider/AuthProvider';
import { AuthenticatorRef } from '../auth-provider/AuthProvider.interface';

interface Props {
  children: ReactNode;
  onLogoutSuccess: () => void;
}

const Auth0Authenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children, onLogoutSuccess }: Props, ref) => {
    const { setIsAuthenticated, authConfig } = useAuthContext();
    const { t } = useTranslation();
    const { loginWithRedirect, getAccessTokenSilently, getIdTokenClaims } =
      useAuth0();

    useImperativeHandle(ref, () => ({
      invokeLogin() {
        loginWithRedirect().catch((error) => {
          // eslint-disable-next-line no-console
          console.error(error);
        });
      },
      invokeLogout() {
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
                        localState.setOidcToken(idToken);
                        resolve(idToken);
                      }
                    })
                    .catch((err) => {
                      reject(
                        t('server.error-while-renewing-id-token-with-message', {
                          message: err.message,
                        })
                      );
                    });
                })
                .catch((err) => {
                  reject(
                    t('server.error-while-renewing-id-token-with-message', {
                      message: err.message,
                    })
                  );
                });
            } else {
              reject(
                t('server.auth-provider-not-supported-renewing', { provider })
              );
            }
          });
        } else {
          return Promise.reject(
            t('server.can-not-renew-token-authentication-not-present')
          );
        }
      },
    }));

    return <Fragment>{children}</Fragment>;
  }
);

Auth0Authenticator.displayName = 'Auth0Authenticator';

export default Auth0Authenticator;
