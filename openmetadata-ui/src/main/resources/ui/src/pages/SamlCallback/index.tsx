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
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthProvider } from '../../components/Auth/AuthProviders/AuthProvider';
import { OidcUser } from '../../components/Auth/AuthProviders/AuthProvider.interface';
import Loader from '../../components/common/Loader/Loader';
import { REFRESH_TOKEN_KEY } from '../../constants/constants';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { setOidcToken, setRefreshToken } from '../../utils/SwTokenStorageUtils';
import { resetWebAnalyticSession } from '../../utils/WebAnalyticsUtils';

const cookieStorage = new CookieStorage();

// Unified auth callback handler for all authentication methods
const AuthCallback = () => {
  const { handleSuccessfulLogin } = useAuthProvider();
  const location = useCustomLocation();
  const { t } = useTranslation();

  const processLogin = useCallback(async () => {
    // Extract token from URL params - works for all auth methods in unified flow
    const params = new URLSearchParams(location.search);
    const idToken = params.get('id_token');

    if (!idToken) {
      // If no token in URL params, redirect to login
      window.location.href = '/signin';

      return;
    }

    try {
      await setOidcToken(idToken);

      // Try to extract user info from the JWT token
      let email = params.get('email') || '';
      let name = params.get('name') || '';
      let sub = '';

      try {
        // Decode JWT payload to get user information
        const tokenParts = idToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          email = email || payload.email || payload.sub || '';
          name = name || payload.name || payload.preferred_username || '';
          sub = payload.sub || '';
        }
      } catch (jwtError) {
        // If JWT decoding fails, use params or empty values
      }

      const oidcUser: OidcUser = {
        id_token: idToken,
        scope: '',
        profile: {
          email,
          name,
          picture: '',
          locale: '',
          sub,
        },
      };

      // Check for refresh token in cookies (for session-based auth)
      const refreshToken = cookieStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await setRefreshToken(refreshToken);
        cookieStorage.removeItem(REFRESH_TOKEN_KEY);
      }

      // Reset analytics session for fresh login
      resetWebAnalyticSession();

      await handleSuccessfulLogin(oidcUser);
    } catch (error) {
      // Redirect to login on error
      window.location.href = '/signin';
    }
  }, [location, handleSuccessfulLogin]);

  useEffect(() => {
    processLogin();
  }, [processLogin]);

  return <Loader fullScreen />;
};

export default AuthCallback;
