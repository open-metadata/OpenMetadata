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
import React, { VFC } from 'react';
import { oidcTokenKey } from '../../../constants/constants';
import jsonData from '../../../jsons/en';
import { useAuthContext } from '../../auth-provider/AuthProvider';
import { OidcUser } from '../../auth-provider/AuthProvider.interface';

const Auth0Callback: VFC = () => {
  const { isAuthenticated, user, getIdTokenClaims, error } = useAuth0();
  const { setIsAuthenticated, handleSuccessfulLogin } = useAuthContext();
  if (isAuthenticated) {
    getIdTokenClaims()
      .then((token) => {
        localStorage.setItem(oidcTokenKey, token?.__raw || '');
        setIsAuthenticated(true);
        const oidcUser: OidcUser = {
          // eslint-disable-next-line @typescript-eslint/camelcase
          id_token: token?.__raw || '',
          scope: '',
          profile: {
            email: user?.email || '',
            name: user?.name || '',
            picture: user?.picture || '',
            locale: user?.locale || '',
          },
        };
        handleSuccessfulLogin(oidcUser);
      })
      .catch((err) => {
        return <div>Error while fetching access token. {err}</div>;
      });
  } else {
    // user is not authenticated
    if (error) {
      return (
        <div data-testid="auth0-error">
          {jsonData['api-error-messages']['unexpected-error']} {error.message}
        </div>
      );
    }
  }

  return <div>Redirecting to the home page... </div>;
};

export default Auth0Callback;
