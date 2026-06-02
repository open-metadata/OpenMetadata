/*
 *  Copyright 2023 Collate.
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

import { CookieStorage } from 'cookie-storage';
import jwtDecode from 'jwt-decode';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthProvider } from '../../components/Auth/AuthProviders/AuthProvider';
import { OidcUser } from '../../components/Auth/AuthProviders/AuthProvider.interface';
import Loader from '../../components/common/Loader/Loader';
import {
  AUTH_TOKEN_COOKIE_KEY,
  REFRESH_TOKEN_KEY,
} from '../../constants/constants';
import { setOidcToken, setRefreshToken } from '../../utils/SwTokenStorageUtils';

const cookieStorage = new CookieStorage();

interface IdTokenClaims {
  email?: string;
  name?: string;
  preferred_username?: string;
  sub?: string;
}

const SamlCallback = () => {
  const { handleSuccessfulLogin } = useAuthProvider();
  const { t } = useTranslation();

  const processLogin = useCallback(async () => {
    // The backend delivers the access token via a short-lived secure cookie
    // (never as a URL query parameter) to avoid leaking it through browser
    // history, the Referer header, or access logs. Read it and remove it.
    const idToken = cookieStorage.getItem(AUTH_TOKEN_COOKIE_KEY);

    if (!idToken) {
      return;
    }

    cookieStorage.removeItem(AUTH_TOKEN_COOKIE_KEY);

    try {
      await setOidcToken(idToken);

      const claims = jwtDecode<IdTokenClaims>(idToken);
      const oidcUser: OidcUser = {
        id_token: idToken,
        scope: '',
        profile: {
          email: claims.email ?? '',
          name: claims.name ?? claims.preferred_username ?? claims.sub ?? '',
          picture: '',
          locale: '',
          sub: claims.sub ?? '',
        },
      };

      const refreshToken = cookieStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await setRefreshToken(refreshToken);
        // Remove refresh token from cookie storage, don't want to keep it in the browser
        cookieStorage.removeItem(REFRESH_TOKEN_KEY);
      }

      await handleSuccessfulLogin(oidcUser);
    } catch {
      // Error handling is already done in handleSuccessfulLogin
    }
  }, [handleSuccessfulLogin]);

  useEffect(() => {
    processLogin();
  }, [processLogin]);

  return (
    <>
      <div data-testid="redirect-message">{t('message.redirect-message')}</div>
      <Loader fullScreen />
    </>
  );
};

export default SamlCallback;
