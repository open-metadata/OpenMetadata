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
import { createContext, ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  HTTP_STATUS_CODE,
  LOGIN_FAILED_ERROR,
} from '../../../constants/Auth.constants';
import { ROUTES } from '../../../constants/constants';
import { PasswordResetRequest } from '../../../generated/auth/passwordResetRequest';
import { RegistrationRequest } from '../../../generated/auth/registrationRequest';
import {
  basicAuthRegister,
  basicAuthSignIn,
  generatePasswordResetLink,
  logoutUser,
  resetPassword,
} from '../../../rest/auth-API';
import { getBase64EncodedString } from '../../../utils/CommonUtils';
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from '../../../utils/ToastUtils';
import { resetWebAnalyticSession } from '../../../utils/WebAnalyticsUtils';

import { toLower } from 'lodash';
import { extractDetailsFromToken } from '../../../utils/AuthProvider.util';
import {
  getOidcToken,
  getRefreshToken,
  setOidcToken,
  setRefreshToken,
} from '../../../utils/LocalStorageUtils';
import { useAuthProvider } from './AuthProvider';
interface BasicAuthProps {
  children: ReactNode;
}

interface InitialContext {
  handleLogin: (email: string, password: string) => void;
  handleRegister: (payload: RegistrationRequest) => void;
  handleForgotPassword: (email: string) => Promise<void>;
  handleResetPassword: (payload: PasswordResetRequest) => Promise<void>;
  handleLogout: () => void;
}

/**
 * @ignore
 */
const stub = (): never => {
  throw new Error('You forgot to wrap your component in <BasicAuthProvider>.');
};

const initialContext = {
  handleLogin: stub,
  handleRegister: stub,
  handleForgotPassword: stub,
  handleResetPassword: stub,
  handleLogout: stub,
  handleUserCreated: stub,
};

/**
 * The Basic Auth Context
 */
export const BasicAuthContext = createContext<InitialContext>(initialContext);

const BasicAuthProvider = ({ children }: BasicAuthProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { handleSuccessfulLogin, handleFailedLogin, handleSuccessfulLogout } =
    useAuthProvider();

  const handleLogin = async (email: string, password: string) => {
    try {
      try {
        const response = await basicAuthSignIn({
          email,
          password: getBase64EncodedString(password),
        });

        if (response.accessToken) {
          setRefreshToken(response.refreshToken);
          setOidcToken(response.accessToken);

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
  };

  const handleRegister = async (request: RegistrationRequest) => {
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
          t('server.create-entity-success', { entity: t('label.user-account') })
        );
        showErrorToast(err as AxiosError, t('server.email-verification-error'));
        navigate(ROUTES.SIGNIN);
      } else {
        showErrorToast(err as AxiosError, t('server.unexpected-response'));
      }
    }
  };

  const handleForgotPassword = async (email: string) => {
    await generatePasswordResetLink(email);
  };

  const handleResetPassword = async (payload: PasswordResetRequest) => {
    const response = await resetPassword(payload);
    if (response) {
      showSuccessToast(t('server.reset-password-success'));
    }
  };

  const handleLogout = async () => {
    const token = getOidcToken();
    const refreshToken = getRefreshToken();
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
  };

  const contextValue = {
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleResetPassword,
    handleLogout,
  };

  return (
    <BasicAuthContext.Provider value={contextValue}>
      {children}
    </BasicAuthContext.Provider>
  );
};

export const useBasicAuth = () => useContext(BasicAuthContext);

export default BasicAuthProvider;
