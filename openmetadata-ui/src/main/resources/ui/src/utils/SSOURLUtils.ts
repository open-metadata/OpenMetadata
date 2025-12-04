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

/**
 * Get dynamic callback URL based on environment
 * @returns The callback URL for SSO authentication
 */
export const getCallbackUrl = (): string => {
  if (isDev()) {
    return 'http://localhost:8585/callback';
  }

  // In production, use the current domain with /callback path
  return `${globalThis.location.origin}/callback`;
};

/**
 * Get dynamic server URL based on environment
 * @returns The server URL for SSO configuration
 */
export const getServerUrl = (): string => {
  if (isDev()) {
    return 'http://localhost:8585';
  }

  // In production, use the current domain
  return globalThis.location.origin;
};

/**
 * Get the authority URL for SAML authentication
 * @returns The authority URL for SAML login
 */
export const getAuthorityUrl = (): string => {
  if (isDev()) {
    return 'http://localhost:8585/api/v1/auth/login';
  }

  // In production, use the current domain with /api/auth/login path
  return `${globalThis.location.origin}/api/v1/auth/login`;
};
