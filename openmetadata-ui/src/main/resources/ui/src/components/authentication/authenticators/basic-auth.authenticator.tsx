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

import React, {
  forwardRef,
  Fragment,
  ReactNode,
  useImperativeHandle,
} from 'react';
import { AccessTokenResponse, getAccessTokenOnExpiry } from 'rest/auth-API';
import { AuthTypes } from '../../../enums/signin.enum';
import localState from '../../../utils/LocalStorageUtils';
import { useAuthContext } from '../auth-provider/AuthProvider';
import { useBasicAuth } from '../auth-provider/basic-auth.provider';

interface BasicAuthenticatorInterface {
  children: ReactNode;
}

const BasicAuthenticator = forwardRef(
  ({ children }: BasicAuthenticatorInterface, ref) => {
    const { handleLogout } = useBasicAuth();
    const { setIsAuthenticated, authConfig } = useAuthContext();

    const handleSilentSignIn = async (): Promise<AccessTokenResponse> => {
      const refreshToken = localState.getRefreshToken();

      if (
        authConfig.provider !== AuthTypes.BASIC &&
        authConfig.provider !== AuthTypes.LDAP
      ) {
        Promise.reject('AuthProvider is not Basic');
      }

      const response = await getAccessTokenOnExpiry({
        refreshToken: refreshToken as string,
      });

      localState.setRefreshToken(response.refreshToken);
      localState.setOidcToken(response.accessToken);

      return Promise.resolve(response);
    };

    useImperativeHandle(ref, () => ({
      invokeLogout() {
        handleLogout();
        setIsAuthenticated(false);
      },
      renewIdToken() {
        return handleSilentSignIn();
      },
    }));

    return <Fragment>{children}</Fragment>;
  }
);

export default BasicAuthenticator;
