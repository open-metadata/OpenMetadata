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

export const basicAuthRegister = async (payload: RegistrationRequest) => {
  const response = await axiosClient.post(`${apiPath}/signup`, payload);

  return response.status;
};

export const basicAuthSignIn = async (payload: LoginRequest) => {
  const response = await axiosClient.post<
    LoginRequest,
    AxiosResponse<AccessTokenResponse>
  >(`${apiPath}/login`, payload);

  return response.data;
};

export const checkEmailInUse = async (email: string) => {
  const response = await axiosClient.post(`${apiPath}/checkEmailInUse`, {
    email,
  });

  return response.data;
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

export const resendRegistrationToken = async () => {
  const response = await axiosClient.put(`${apiPath}/resendRegistrationToken`);

  return response;
};

export const getAccessTokenOnExpiry = async (payload: TokenRefreshRequest) => {
  const response = await axiosClient.post<
    TokenRefreshRequest,
    AxiosResponse<AccessTokenResponse>
  >(`${apiPath}/refresh`, payload);

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
  const response = await axiosClient.post(`${apiPath}/logout`, payload);

  return response.data;
};
