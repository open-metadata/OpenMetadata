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
        scope: DEFAULT_SCOPE,
      } as AuthenticationConfigurationWithScope;

      globalThis.localStorage.setItem(
        SSO_TEST_LOGIN_CANDIDATE_KEY,
        JSON.stringify(candidate)
      );
      const userManager = new UserManager(
        getCandidateUserManagerConfig(candidate)
      );

      try {
        const user = await userManager.signinPopup();
        const idToken = user?.id_token;
        if (!idToken) {
          setError(t('message.sso-test-login-no-token'));

          return;
        }
        const response = await testLoginValidateToken({
          securityConfiguration,
          idToken,
        });
        setResult(response.data);
      } catch {
        setError(t('message.sso-test-login-popup-failed'));
      } finally {
        globalThis.localStorage.removeItem(SSO_TEST_LOGIN_CANDIDATE_KEY);
        setIsTesting(false);
      }
    },
    []
  );

  return { isTesting, result, error, runTestLogin, reset };
};
