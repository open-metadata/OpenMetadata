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
import { getAccessTokenOnExpiry } from '../../axiosAPIs/auth-API';
import { AuthTypes } from '../../enums/signin.enum';
import localState from '../../utils/LocalStorageUtils';
import { useAuthContext } from '../auth-provider/AuthProvider';
import { useBasicAuth } from '../auth-provider/basic-auth.provider';

interface BasicAuthenticatorInterface {
  children: ReactNode;
}

const BasicAuthenticator = forwardRef(
  ({ children }: BasicAuthenticatorInterface, ref) => {
    const { handleLogout } = useBasicAuth();
    const { setIsAuthenticated, authConfig } = useAuthContext();
    useImperativeHandle(ref, () => ({
      invokeLogout() {
        handleLogout();
        setIsAuthenticated(false);
      },
      renewIdToken() {
        let idToken = '';
        const refreshToken = localState.getRefreshToken();
        if (authConfig && authConfig.provider !== undefined) {
          return new Promise((resolve, reject) => {
            const { provider } = authConfig;
            if (provider === AuthTypes.BASIC) {
              getAccessTokenOnExpiry({
                refreshToken: refreshToken as string,
              })
                .then((res) => {
                  idToken = res.accessToken;
                  localState.setOidcToken(res.accessToken);
                  resolve(idToken);
                })
                .catch((err) => {
                  reject(
                    `Error while renewing id token from Basic Auth: ${err.message}`
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

export default BasicAuthenticator;
