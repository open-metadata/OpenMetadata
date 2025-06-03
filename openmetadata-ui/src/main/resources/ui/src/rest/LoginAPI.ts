/*
 *  Copyright 2024 Collate.
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
import { HttpStatusCode } from 'axios';
import { NavigateFunction } from 'react-router-dom';
import axiosClient from '.';
import { ROUTES } from '../constants/constants';

const BASE_URL = '/auth';

interface RenewTokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  // in seconds
  expiryDuration: number;
}

export const renewToken = async (navigate: NavigateFunction) => {
  const data = await axiosClient.get<RenewTokenResponse>(`${BASE_URL}/refresh`);

  if (data.status === HttpStatusCode.Found) {
    navigate(ROUTES.LOGOUT);
  }

  return data.data;
};

export const logoutUser = async () => {
  const response = await axiosClient.get(`${BASE_URL}/logout`);

  return response.data;
};
