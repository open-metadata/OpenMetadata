import { AxiosResponse } from 'axios';
import axiosClient from '.';
import { LoginRequest } from '../generated/auth/loginRequest';
import { PasswordResetRequest } from '../generated/auth/passwordResetRequest';
import { RegistrationRequest } from '../generated/auth/registrationRequest';
import { TokenRefreshRequest } from '../generated/auth/tokenRefreshRequest';

interface AccessTokenResponse {
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
  const response = await axiosClient.get(
    `${apiPath}/registrationConfirmation?token=${token}`
  );

  return response.data;
};

export const resendRegistrationToken = async () => {
  const response = await axiosClient.get(`${apiPath}/resendRegistrationToken`);

  return response;
};

export const getAccessTokenOnExpiry = async (payload: TokenRefreshRequest) => {
  const response = await axiosClient.post<
    TokenRefreshRequest,
    AxiosResponse<AccessTokenResponse>
  >(`${apiPath}/refresh`, payload);

  return response.data;
};
