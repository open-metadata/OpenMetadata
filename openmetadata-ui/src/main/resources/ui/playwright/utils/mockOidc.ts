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

import { APIRequestContext } from '@playwright/test';

const MOCK_OIDC_BASE_URL = process.env.MOCK_OIDC_URL || 'http://localhost:9090';

export interface MockOidcConfig {
  accessTokenTTL?: number;
  idTokenTTL?: number;
  refreshTokenEnabled?: boolean;
  forceInteractionRequired?: boolean;
  tokenEndpointError?: { errorCode: string; httpStatus: number } | null;
  defaultLoginAccount?: string;
}

export interface MockOidcState {
  accessTokenTTL: number;
  idTokenTTL: number;
  forceInteractionRequired: boolean;
  refreshTokenEnabled: boolean;
  tokenEndpointError: { errorCode: string; httpStatus: number } | null;
  defaultLoginAccount: string;
}

export interface MockOidcMetrics {
  tokenRequests: number;
  authRequests: number;
  refreshAttempts: number;
}

export const configureMockOidc = async (
  request: APIRequestContext,
  config: MockOidcConfig
): Promise<MockOidcState> => {
  const response = await request.post(`${MOCK_OIDC_BASE_URL}/test/configure`, {
    data: config,
  });
  const body = await response.json();

  return body.state;
};

export const setTokenExpiry = async (
  request: APIRequestContext,
  seconds: number
): Promise<MockOidcState> => {
  return configureMockOidc(request, {
    accessTokenTTL: seconds,
    idTokenTTL: seconds,
  });
};

export const forceInteractionRequired = async (
  request: APIRequestContext
): Promise<void> => {
  await request.post(`${MOCK_OIDC_BASE_URL}/test/force-interaction-required`);
};

export const resetMockOidc = async (
  request: APIRequestContext
): Promise<void> => {
  await request.post(`${MOCK_OIDC_BASE_URL}/test/reset`);
};

export const getMockOidcState = async (
  request: APIRequestContext
): Promise<MockOidcState> => {
  const response = await request.get(`${MOCK_OIDC_BASE_URL}/test/state`);

  return response.json();
};

export const waitForMockOidcReady = async (
  request: APIRequestContext,
  timeoutMs = 30000
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await request.get(`${MOCK_OIDC_BASE_URL}/health`);
      if (response.ok()) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    `Mock OIDC provider not ready after ${timeoutMs}ms at ${MOCK_OIDC_BASE_URL}`
  );
};

export const setTokenEndpointError = async (
  request: APIRequestContext,
  errorCode: string,
  httpStatus: number
): Promise<MockOidcState> => {
  return configureMockOidc(request, {
    tokenEndpointError: { errorCode, httpStatus },
  });
};

export const setDefaultLoginAccount = async (
  request: APIRequestContext,
  accountId: string
): Promise<MockOidcState> => {
  return configureMockOidc(request, { defaultLoginAccount: accountId });
};

export const getMetrics = async (
  request: APIRequestContext
): Promise<MockOidcMetrics> => {
  const response = await request.get(`${MOCK_OIDC_BASE_URL}/test/metrics`);

  return response.json();
};

export const resetMetrics = async (
  request: APIRequestContext
): Promise<void> => {
  await request.post(`${MOCK_OIDC_BASE_URL}/test/metrics/reset`);
};

export const MOCK_OIDC_CLIENT_ID = 'openmetadata-test';
export const MOCK_OIDC_CLIENT_SECRET = 'openmetadata-test-secret';
export const MOCK_OIDC_PUBLIC_CLIENT_ID = 'openmetadata-test-public';
export const MOCK_OIDC_DISCOVERY_URL = `${MOCK_OIDC_BASE_URL}/.well-known/openid-configuration`;

// Server-facing base URL — what OM's backend uses to fetch JWKS + discovery
// when it needs to validate an incoming Bearer token. `MOCK_OIDC_URL` is
// the browser-facing origin (typically localhost:9090); `MOCK_OIDC_INTERNAL_URL`
// is the docker-network container name (typically http://mock-oidc-provider:9090).
// They differ ONLY inside docker-compose — local dev leaves both unset and
// both fall back to the same localhost URL. `publicKeyUrls` in every fixture
// config must use this so the JWT filter can actually reach the JWKS.
const MOCK_OIDC_INTERNAL_BASE_URL =
  process.env.MOCK_OIDC_INTERNAL_URL || MOCK_OIDC_BASE_URL;
export const MOCK_OIDC_INTERNAL_JWKS_URL = `${MOCK_OIDC_INTERNAL_BASE_URL}/.well-known/jwks.json`;

// Provider-shaped SPA clients registered on the same mock IdP. The Auth0
// SPA SDK (@auth0/auth0-react) talks to `${domain}/authorize`,
// `${domain}/oauth/token` etc.; the mock hosts those as URL-rewrite
// aliases on top of the shared oidc-provider (see docker/development/
// mock-oidc-provider/server.js). Point Auth0Provider's `domain` prop at
// `MOCK_OIDC_BASE_URL` and its `clientId` at this constant to drive the
// real SDK against the mock — no in-page shim required.
export const MOCK_AUTH0_CLIENT_ID = 'openmetadata-auth0-client';
export const MOCK_AUTH0_DOMAIN = MOCK_OIDC_BASE_URL;

export const MOCK_OIDC_BASE = MOCK_OIDC_BASE_URL;

// Seeded mock account whose sub differs from the email local-part — used to
// verify OIDC self-signup persists the mapped email claim (issue #29189).
export const MOCK_OIDC_MAPPED_CLAIM_ACCOUNT = {
  sub: 'claim-user',
  email: 'claim.user.mapped@open-metadata.org',
};
