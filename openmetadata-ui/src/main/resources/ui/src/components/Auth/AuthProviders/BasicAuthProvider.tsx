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

import { AxiosError } from 'axios';
import { ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  HTTP_STATUS_CODE,
  LOGIN_FAILED_ERROR,
} from '../../../constants/Auth.constants';
import { APP_ROUTER_ROUTES as ROUTES } from '../../../constants/router.constants';
import { PasswordResetRequest } from '../../../generated/auth/passwordResetRequest';
import { RegistrationRequest } from '../../../generated/auth/registrationRequest';
import {
  basicAuthRegister,
  basicAuthSignIn,
  generatePasswordResetLink,
  logoutUser,
  resetPassword,
} from '../../../rest/auth-API';
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from '../../../utils/ToastUtils';
import { resetWebAnalyticSession } from '../../../utils/WebAnalyticsUtils';
import { BasicAuthContext } from './BasicAuthContext';

import { toLower } from 'lodash';
import { extractDetailsFromToken } from '../../../utils/AuthProvider.util';
import {
  getOidcToken,
  getRefreshToken,
  setOidcToken,
} from '../../../utils/SwTokenStorageUtils';
import { useAuthProvider } from './AuthProvider';
interface BasicAuthProps {
  children: ReactNode;
}

const BasicAuthProvider = ({ children }: BasicAuthProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { handleSuccessfulLogin, handleFailedLogin, handleSuccessfulLogout } =
    useAuthProvider();

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      try {
        try {
          const response = await basicAuthSignIn({
            email,
            password: btoa(password),
          });

          if (response.accessToken) {
            await setOidcToken(response.accessToken);

            handleSuccessfulLogin({
              id_token: response.accessToken,
              profile: {
                email: toLower(email),
                name: '',
                picture: '',
                sub: '',
              },
              scope: '',
            });
          }

          // reset web analytic session
          resetWebAnalyticSession();
        } catch (error) {
          const err = error as AxiosError<{ code: number; message: string }>;

          showErrorToast(err.response?.data.message ?? LOGIN_FAILED_ERROR);
          handleFailedLogin();
        }
      } catch (err) {
        showErrorToast(err as AxiosError, t('server.unauthorized-user'));
      }
    },
    [handleSuccessfulLogin, handleFailedLogin, t]
  );

  const handleRegister = useCallback(
    async (request: RegistrationRequest) => {
      try {
        await basicAuthRegister(request);

        showSuccessToast(
          t('server.create-entity-success', { entity: t('label.user-account') })
        );
        showInfoToast(t('server.email-confirmation'));
        navigate(ROUTES.SIGNIN);
      } catch (err) {
        if (
          (err as AxiosError).response?.status ===
          HTTP_STATUS_CODE.FAILED_DEPENDENCY
        ) {
          showSuccessToast(
            t('server.create-entity-success', {
              entity: t('label.user-account'),
            })
          );
          showErrorToast(
            err as AxiosError,
            t('server.email-verification-error')
          );
          navigate(ROUTES.SIGNIN);
        } else {
          showErrorToast(err as AxiosError, t('server.unexpected-response'));
        }
      }
    },
    [navigate, t]
  );

  const handleForgotPassword = useCallback(async (email: string) => {
    await generatePasswordResetLink(email);
  }, []);

  const handleResetPassword = useCallback(
    async (payload: PasswordResetRequest) => {
      const response = await resetPassword(payload);
      if (response) {
        showSuccessToast(t('server.reset-password-success'));
      }
    },
    [t]
  );

  const handleLogout = useCallback(async () => {
    const [token, refreshToken] = await Promise.all([
      getOidcToken(),
      getRefreshToken(),
    ]);
    const isExpired = extractDetailsFromToken(token).isExpired;
    if (token && !isExpired) {
      try {
        await logoutUser({ token, refreshToken });
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        // This will cleanup the application state and redirect to login page
        handleSuccessfulLogout();
      }
    }
  }, [handleSuccessfulLogout]);

  const contextValue = useMemo(
    () => ({
      handleLogin,
      handleRegister,
      handleForgotPassword,
      handleResetPassword,
      handleLogout,
    }),
    [
      handleLogin,
      handleRegister,
      handleForgotPassword,
      handleResetPassword,
      handleLogout,
    ]
  );

  return (
    <BasicAuthContext.Provider value={contextValue}>
      {children}
    </BasicAuthContext.Provider>
  );
};

// `useBasicAuth` and `BasicAuthContext` now live in ./BasicAuthContext
// (re-exported below for backwards compatibility). Keeping the hook in
// the lazy-loaded provider file created two module instances — one in the
// eager graph pulled in by SignInPage, one in the lazy chunk — each with
// its own `createContext()` object, so the provider populated one context
// while consumers read from the other and always got the stub default.
export { BasicAuthContext, useBasicAuth } from './BasicAuthContext';

export default BasicAuthProvider;
