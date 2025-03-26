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
import React, { createContext, ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
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
  checkEmailInUse,
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
import TokenService from '../../../utils/Auth/TokenService/TokenServiceUtil';
import { extractDetailsFromToken } from '../../../utils/AuthProvider.util';
import {
  getOidcToken,
  getRefreshToken,
  setOidcToken,
  setRefreshToken,
} from '../../../utils/LocalStorageUtils';
import { OidcUser } from './AuthProvider.interface';

interface BasicAuthProps {
  children: ReactNode;
  onLoginSuccess: (user: OidcUser) => void;
  onLoginFailure: () => void;
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

const BasicAuthProvider = ({
  children,
  onLoginSuccess,
  onLoginFailure,
}: BasicAuthProps) => {
  const { t } = useTranslation();
  const history = useHistory();

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

          onLoginSuccess({
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
        onLoginFailure();
      }
    } catch (err) {
      showErrorToast(err as AxiosError, t('server.unauthorized-user'));
    }
  };

  const handleRegister = async (request: RegistrationRequest) => {
    try {
      const isEmailAlreadyExists = await checkEmailInUse(request.email);
      if (!isEmailAlreadyExists) {
        await basicAuthRegister(request);

        showSuccessToast(
          t('server.create-entity-success', { entity: t('label.user-account') })
        );
        showInfoToast(t('server.email-confirmation'));
        history.push(ROUTES.SIGNIN);
      } else {
        return showErrorToast(t('server.email-found'));
      }
    } catch (err) {
      if (
        (err as AxiosError).response?.status ===
        HTTP_STATUS_CODE.FAILED_DEPENDENCY
      ) {
        showSuccessToast(
          t('server.create-entity-success', { entity: t('label.user-account') })
        );
        showErrorToast(err as AxiosError, t('server.email-verification-error'));
        history.push(ROUTES.SIGNIN);
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
        setOidcToken('');
        setRefreshToken('');
        TokenService.getInstance().clearRefreshInProgress();
        history.push(ROUTES.SIGNIN);
      } catch (error) {
        showErrorToast(error as AxiosError);
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
