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

import { AxiosResponse } from 'axios';
import axiosClient from '.';
import { ChangePasswordRequest } from '../generated/auth/changePasswordRequest';
import { LoginRequest } from '../generated/auth/loginRequest';
import { LogoutRequest } from '../generated/auth/logoutRequest';
import { PasswordResetRequest } from '../generated/auth/passwordResetRequest';
import { RegistrationRequest } from '../generated/auth/registrationRequest';
import { TokenRefreshRequest } from '../generated/auth/tokenRefreshRequest';

export interface AccessTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiryDuration: number;
  email: string;
}

const apiPath = '/users';
const authApiPath = '/api/v1/auth';

export const basicAuthRegister = async (payload: RegistrationRequest) => {
  const response = await axiosClient.post(`${apiPath}/signup`, payload);

  return response.status;
};

export const basicAuthSignIn = async (payload: LoginRequest) => {
  // Create a hidden form and submit it to avoid password in URL
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${authApiPath}/login`;
  form.style.display = 'none';

  const emailInput = document.createElement('input');
  emailInput.name = 'email';
  emailInput.value = payload.email;
  form.appendChild(emailInput);

  const passwordInput = document.createElement('input');
  passwordInput.name = 'password';
  passwordInput.value = payload.password || '';
  form.appendChild(passwordInput);

  const redirectInput = document.createElement('input');
  redirectInput.name = 'redirectUri';
  redirectInput.value = window.location.origin + '/callback';
  form.appendChild(redirectInput);

  document.body.appendChild(form);
  form.submit();

  return {
    accessToken: '',
    refreshToken: '',
    tokenType: '',
    expiryDuration: 0,
    email: payload.email,
  };
};

export const generatePasswordResetLink = async (email: string) => {
  const response = await axiosClient.post(
    `${apiPath}/generatePasswordResetLink`,
    { email }
  );

  return response.status;
};

export const resetPassword = async (payload: PasswordResetRequest) => {
  const response = await axiosClient.post(`${apiPath}/password/reset`, payload);

  return response;
};

export const confirmRegistration = async (token: string) => {
  const response = await axiosClient.put(
    `${apiPath}/registrationConfirmation?token=${token}`
  );

  return response.data;
};

export const getAccessTokenOnExpiry = async (payload: TokenRefreshRequest) => {
  // Starting token refresh with iframe

  // For token refresh, we'll use an iframe to avoid page reload
  return new Promise<AccessTokenResponse>((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.name = 'auth_refresh_frame';

    const redirectUri = encodeURIComponent(
      window.location.origin + '/silent-callback'
    );
    const refreshUrl = `${authApiPath}/refresh?refreshToken=${encodeURIComponent(
      payload.refreshToken as string
    )}&redirectUri=${redirectUri}`;

    // Creating iframe with URL
    iframe.src = refreshUrl;

    // Set up message listener for the response
    const messageHandler = (event: MessageEvent) => {
      // Received message in iframe handler

      if (event.origin !== window.location.origin) {
        // Ignoring message from different origin

        return;
      }

      if (event.data.type === 'auth_refresh_success') {
        // Token refresh successful via iframe
        window.removeEventListener('message', messageHandler);
        document.body.removeChild(iframe);
        resolve({
          accessToken: event.data.accessToken,
          refreshToken: event.data.refreshToken,
          tokenType: 'Bearer',
          expiryDuration: 3600,
          email: event.data.email || '',
        });
      } else if (event.data.type === 'auth_refresh_error') {
        // Token refresh failed via iframe
        window.removeEventListener('message', messageHandler);
        document.body.removeChild(iframe);
        reject(new Error(event.data.error));
      }
    };

    window.addEventListener('message', messageHandler);
    document.body.appendChild(iframe);
    // Iframe appended to body, waiting for response

    // Timeout after 10 seconds
    setTimeout(() => {
      // Token refresh timeout after 10 seconds
      window.removeEventListener('message', messageHandler);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      reject(new Error('Token refresh timeout'));
    }, 10000);
  });
};

export const refreshSAMLToken = async (payload: TokenRefreshRequest) => {
  const response = await axiosClient.post<
    TokenRefreshRequest,
    AxiosResponse<AccessTokenResponse>
  >(`/saml/refresh`, payload);

  return response.data;
};

export const changePassword = async (payload: ChangePasswordRequest) => {
  const response = await axiosClient.put(`${apiPath}/changePassword`, payload);

  return response;
};

export const generateRandomPwd = async () => {
  const response = await axiosClient.get(`${apiPath}/generateRandomPwd`);

  return response.data;
};

/**
 * Logout a User(Only called for saml and basic Auth)
 */
export const logoutUser = async (payload: LogoutRequest) => {
  const logoutRedirectUrl = encodeURIComponent(
    window.location.origin + '/signin'
  );
  window.location.href = `${authApiPath}/logout?token=${encodeURIComponent(
    payload.token as string
  )}&refreshToken=${encodeURIComponent(
    payload.refreshToken as string
  )}&logoutRedirectUrl=${logoutRedirectUrl}`;

  return {};
};
