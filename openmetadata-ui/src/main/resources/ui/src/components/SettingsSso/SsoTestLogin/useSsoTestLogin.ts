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
import { UserManager } from 'oidc-client';
import { useCallback, useState } from 'react';
import {
  SecurityConfiguration,
  TestLoginResult,
  testLoginValidateToken,
} from '../../../rest/securityConfigAPI';
import { getCandidateUserManagerConfig } from '../../../utils/AuthProvider.util';
import { t } from '../../../utils/i18next/LocalUtil';
import { AuthenticationConfigurationWithScope } from '../../Auth/AuthProviders/AuthProvider.interface';
import { SSO_TEST_LOGIN_CANDIDATE_KEY } from './ssoTestCallbackBootstrap';
import { UseSsoTestLoginResult } from './SsoTestLogin.interface';

const DEFAULT_SCOPE = 'openid email profile';

// E2E seam: a real IdP popup cannot run in headless CI, so Playwright injects an
// id_token under this global key. It is NEVER set during normal app usage, so the
// real isolated popup flow below always runs in production.
export const E2E_INJECTED_ID_TOKEN_KEY = '__OM_E2E_SSO_TEST_ID_TOKEN__';

const acquireIdToken = async (
  candidate: AuthenticationConfigurationWithScope
): Promise<string | undefined> => {
  const injectedToken = (
    globalThis as unknown as Record<string, string | undefined>
  )[E2E_INJECTED_ID_TOKEN_KEY];
  if (injectedToken) {
    return injectedToken;
  }

  globalThis.localStorage.setItem(
    SSO_TEST_LOGIN_CANDIDATE_KEY,
    JSON.stringify(candidate)
  );
  const userManager = new UserManager(getCandidateUserManagerConfig(candidate));
  const user = await userManager.signinPopup();

  return user?.id_token;
};

/**
 * Drives the interactive SSO "Test Login" for public-client OIDC providers. The
 * admin completes a real sign-in in an isolated popup; the resulting id_token is
 * sent to the admin-only backend endpoint that resolves the identity a real
 * login would produce. The popup uses a dedicated, prefixed token store and a
 * dedicated callback route, so the admin's current session is never touched.
 */
export const useSsoTestLogin = (): UseSsoTestLoginResult => {
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [result, setResult] = useState<TestLoginResult | undefined>();
  const [error, setError] = useState<string | undefined>();

  const reset = useCallback(() => {
    setResult(undefined);
    setError(undefined);
  }, []);

  const runTestLogin = useCallback(
    async (securityConfiguration: SecurityConfiguration) => {
      setIsTesting(true);
      setResult(undefined);
      setError(undefined);

      const authConfig = securityConfiguration.authenticationConfiguration;
      const candidate = {
        authority: authConfig.authority,
        clientId: authConfig.clientId,
        callbackUrl: authConfig.callbackUrl,
        scope: DEFAULT_SCOPE,
      } as AuthenticationConfigurationWithScope;

      try {
        let idToken: string | undefined;
        try {
          idToken = await acquireIdToken(candidate);
        } catch {
          // Failure obtaining the token in the popup (cancelled / blocked).
          setError(t('message.sso-test-login-popup-failed'));

          return;
        } finally {
          globalThis.localStorage.removeItem(SSO_TEST_LOGIN_CANDIDATE_KEY);
        }

        if (!idToken) {
          setError(t('message.sso-test-login-no-token'));

          return;
        }

        try {
          const response = await testLoginValidateToken({
            securityConfiguration,
            idToken,
          });
          setResult(response.data);
        } catch {
          // The popup succeeded but the admin-only backend call failed
          // (server error / network) — distinct from a cancelled sign-in.
          setError(t('message.sso-test-login-error'));
        }
      } finally {
        setIsTesting(false);
      }
    },
    []
  );

  return { isTesting, result, error, runTestLogin, reset };
};
