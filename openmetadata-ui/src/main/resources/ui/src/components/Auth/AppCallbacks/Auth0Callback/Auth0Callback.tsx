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
import { VFC } from 'react';
import { useTranslation } from 'react-i18next';
import { setOidcToken } from '../../../../utils/LocalStorageUtils';
import { useAuthProvider } from '../../AuthProviders/AuthProvider';
import { OidcUser } from '../../AuthProviders/AuthProvider.interface';

const Auth0Callback: VFC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, user, getIdTokenClaims, error } = useAuth0();
  const { handleSuccessfulLogin } = useAuthProvider();
  if (isAuthenticated) {
    getIdTokenClaims()
      .then((token) => {
        setOidcToken(token?.__raw || '');
        const oidcUser: OidcUser = {
          id_token: token?.__raw || '',
          scope: '',
          profile: {
            email: user?.email || '',
            name: user?.name || '',
            picture: user?.picture || '',
            locale: user?.locale || '',
            sub: user?.sub || '',
          },
        };
        handleSuccessfulLogin(oidcUser);
      })
      .catch((err) => {
        return (
          <div>
            {t('message.error-while-fetching-access-token')} {err}
          </div>
        );
      });
  } else {
    // user is not authenticated
    if (error) {
      return (
        <div data-testid="auth0-error">
          {t('server.unexpected-error')} <span>{error.message}</span>
        </div>
      );
    }
  }

  return <div>{`${t('message.redirecting-to-home-page')}...`} </div>;
};

export default Auth0Callback;
