/*
 *  Copyright 2025 Collate.
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
import { isDev } from './EnvironmentUtils';

export const getServerUrl = (): string => {
  if (isDev()) {
    return new URL(
      process.env.SSO_SERVER_URL ||
        process.env.DEV_SERVER_TARGET ||
        'http://localhost:8585/'
    ).origin;
  }

  return globalThis.location.origin;
};

export const getCallbackUrl = (): string => `${getServerUrl()}/callback`;

export const getAuthorityUrl = (): string =>
  `${getServerUrl()}/api/v1/auth/login`;
