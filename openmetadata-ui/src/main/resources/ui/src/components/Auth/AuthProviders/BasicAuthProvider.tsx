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
import { HTTP_STATUS_CODE } from '../../../constants/Auth.constants';
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
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from '../../../utils/ToastUtils';

import { extractDetailsFromToken } from '../../../utils/AuthProvider.util';
import {
  getOidcToken,
  getRefreshToken,
} from '../../../utils/SwTokenStorageUtils';
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
      await basicAuthSignIn({
        email,
        password,
      });
    } catch (error) {
      const err = error as Error;

      // Check if it's a network error (CORS or connection issue)
      if (
        err.message === 'Failed to fetch' ||
        err.message === 'Network Error'
      ) {
        // Try direct navigation as fallback
        showErrorToast('Network error. Please check your connection.');
      } else {
        // Parse error message if it's JSON
        try {
          const errorObj = JSON.parse(err.message);
          showErrorToast(
            errorObj.error || errorObj.message || 'Authentication failed'
          );
        } catch {
          showErrorToast(err.message || 'Authentication failed');
        }
      }
      handleFailedLogin();
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
    const token = await getOidcToken();
    const refreshToken = await getRefreshToken();
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
