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

/**
 * The query parameter the server's SSO callback names a failed sign-in with
 * (ADR:2026-11-12-a-failed-sso-sign-in-returns-to-the-sign-in-page).
 */
export const SIGN_IN_ERROR_PARAM = 'error';

const SIGN_IN_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['provider_refused', 'message.sso-sign-in-provider-refused'],
  ['token_exchange_failed', 'message.sso-sign-in-token-exchange-failed'],
  ['account_not_allowed', 'message.sso-sign-in-account-not-allowed'],
]);

const GENERIC_SIGN_IN_ERROR = 'message.sso-sign-in-failed';

/**
 * The message key for the code a failed SSO sign-in comes back with. The code
 * itself is never shown, so the URL cannot put text on the page: an unknown
 * one gets the generic message.
 */
export const getSignInErrorMessageKey = (
  code: string | null
): string | undefined => {
  if (!code) {
    return undefined;
  }

  return SIGN_IN_ERROR_MESSAGES.get(code) ?? GENERIC_SIGN_IN_ERROR;
};

interface AutoRedirectConditions {
  isEnabled?: boolean;
  isAuthProviderBasic: boolean;
  isAuthenticated: boolean;
  hasSignInError: boolean;
  hasLoginHandler: boolean;
}

/**
 * Whether the sign-in page sends the person straight to the identity provider.
 * After a failed sign-in it stays to say why: redirecting again would loop.
 */
export const shouldAutoRedirectToProvider = ({
  isEnabled,
  isAuthProviderBasic,
  isAuthenticated,
  hasSignInError,
  hasLoginHandler,
}: AutoRedirectConditions): boolean => {
  const isSignedOutOfSso = !isAuthProviderBasic && !isAuthenticated;

  return (
    Boolean(isEnabled) && isSignedOutOfSso && !hasSignInError && hasLoginHandler
  );
};
