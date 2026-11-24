/*
 *  Copyright 2026 Collate.
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

// OIDC authorization errors that mean "cannot finish without a visit to the
// identity provider" (OIDC Core 3.1.2.6). Background renewal cannot show the
// provider anything, but a top-level redirect with prompt=none can still ride
// a live provider session.
const INTERACTION_REQUIRED_ERROR_CODES = new Set([
  'login_required',
  'interaction_required',
  'consent_required',
  'account_selection_required',
]);

/**
 * Thrown by a Renewer when silent renewal failed in a way a top-level
 * redirect to the identity provider can recover from. AuthProvider answers it
 * with one silent re-authentication instead of signing the user out.
 */
export class ReauthRequiredError extends Error {
  readonly reason: unknown;

  constructor(message: string, reason?: unknown) {
    super(message);
    this.name = 'ReauthRequiredError';
    this.reason = reason;
  }
}

export const isReauthRequiredError = (
  error: unknown
): error is ReauthRequiredError =>
  error instanceof ReauthRequiredError ||
  (error instanceof Error && error.name === 'ReauthRequiredError');

// SDKs disagree on where the code lives: MSAL and Okta use `errorCode`,
// oidc-client and Auth0 use `error`.
export const getAuthErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const { errorCode, error: code } = error as {
    errorCode?: unknown;
    error?: unknown;
  };
  if (typeof errorCode === 'string') {
    return errorCode;
  }

  return typeof code === 'string' ? code : undefined;
};

export const isInteractionRequiredCode = (code: string | undefined): boolean =>
  code !== undefined && INTERACTION_REQUIRED_ERROR_CODES.has(code);
