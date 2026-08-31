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
import axiosClient from '.';

const BASE_URL = '/auth';

interface RenewTokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  // in seconds
  expiryDuration: number;
}

export const renewToken = async () => {
  const { data } = await axiosClient.get<RenewTokenResponse>(
    `${BASE_URL}/refresh`
  );

  // A refresh with no access token means the server could not renew the session
  // (e.g. it redirected an expired session to re-login; the browser silently
  // follows the 3xx so the status is never observable here). Treat it as a
  // failure so the caller re-authenticates instead of storing an empty token.
  if (!data?.accessToken) {
    throw new Error('Token refresh returned no access token');
  }

  return data;
};

export const logoutUser = async () => {
  // Logout is exposed as POST only; a GET returns 405 (see AuthLogoutServlet).
  const response = await axiosClient.post(`${BASE_URL}/logout`);

  return response.data;
};
