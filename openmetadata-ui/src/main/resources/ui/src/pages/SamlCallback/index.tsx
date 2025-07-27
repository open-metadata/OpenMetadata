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
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthProvider } from '../../components/Auth/AuthProviders/AuthProvider';
import { OidcUser } from '../../components/Auth/AuthProviders/AuthProvider.interface';
import Loader from '../../components/common/Loader/Loader';
import { REFRESH_TOKEN_KEY } from '../../constants/constants';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { setOidcToken, setRefreshToken } from '../../utils/LocalStorageUtils';

const cookieStorage = new CookieStorage();

const SamlCallback = () => {
  const { handleSuccessfulLogin } = useAuthProvider();
  const location = useCustomLocation();
  const { t } = useTranslation();

  useEffect(() => {
    // get #id_token from hash params in the URL
    const params = new URLSearchParams(location.search);
    const idToken = params.get('id_token');
    const name = params.get('name');
    const email = params.get('email');
    if (idToken) {
      setOidcToken(idToken);
      const oidcUser: OidcUser = {
        id_token: idToken,
        scope: '',
        profile: {
          email: email || '',
          name: name || '',
          picture: '',
          locale: '',
          sub: '',
        },
      };

      const refreshToken = cookieStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        setRefreshToken(refreshToken);
        // Remove refresh token from cookie storage, don't want to keep it in the browser
        cookieStorage.removeItem(REFRESH_TOKEN_KEY);
      }

      handleSuccessfulLogin(oidcUser);
    }
  }, [location]);

  return (
    <>
      <div data-testid="redirect-message">{t('message.redirect-message')}</div>
      <Loader fullScreen />
    </>
  );
};

export default SamlCallback;
