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
import { AxiosError } from 'axios';
import { UserManager } from 'oidc-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FETCHING_EXPIRY_TIME,
  FETCH_INTERVAL,
} from '../../../constants/ServiceType.constant';
import { AuthProvider } from '../../../generated/settings/settings';
import { TestLoginSession } from '../../../generated/system/testLoginSession';
import {
  getTestLoginResult,
  SecurityConfiguration,
  startTestLogin,
  submitTestLoginCredentials,
  TestLoginResult,
  testLoginValidateToken,
} from '../../../rest/securityConfigAPI';
import { getCandidateUserManagerConfig } from '../../../utils/AuthProvider.util';
import { t } from '../../../utils/i18next/LocalUtil';
import { isPlaywrightBuild } from '../../../utils/isPlaywrightBuild';
import {
  isHttpUrl,
  UnsafeSignInUrlError,
} from '../../../utils/SsoTestLoginPopup';
import { getErrorText } from '../../../utils/StringUtils';
import { AuthenticationConfigurationWithScope } from '../../Auth/AuthProviders/AuthProvider.interface';
import { SSO_TEST_LOGIN_CANDIDATE_KEY } from './ssoTestCallbackBootstrap';
import { UseSsoTestLoginResult } from './SsoTestLogin.interface';
import { isBrowserTestLogin, isTestLoginSettled } from './SsoTestLogin.utils';

const DEFAULT_SCOPE = 'openid email profile';
const TEST_LOGIN_POPUP_NAME = 'omSsoTestLogin';
const TEST_LOGIN_POPUP_FEATURES = 'width=520,height=680';

// These providers' live logins run through their vendor SDKs, which always use the authorization
// code flow with PKCE. The test popup must do the same — not the implicit flow — or it would fail
// (or pass) for a different reason than the real login would.
const CODE_FLOW_PROVIDERS: readonly string[] = [
  AuthProvider.Okta,
  AuthProvider.Auth0,
  AuthProvider.Azure,
];

// E2E seam: a real IdP popup cannot run in headless CI, so Playwright injects an
// id_token under this global key. It is honoured only in Playwright builds, so the
// real isolated popup flow below always runs in production.
export const E2E_INJECTED_ID_TOKEN_KEY = '__OM_E2E_SSO_TEST_ID_TOKEN__';

const delay = (millis: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, millis));

/** The candidate the public-client popup signs in with, matching what the live login requests. */
const popupCandidateFor = (
  securityConfiguration: SecurityConfiguration
): AuthenticationConfigurationWithScope => {
  const authConfig = securityConfiguration.authenticationConfiguration;
  const responseType = CODE_FLOW_PROVIDERS.includes(authConfig.provider)
    ? 'code'
    : authConfig.responseType ?? 'id_token';

  return {
    authority: authConfig.authority,
    clientId: authConfig.clientId,
    callbackUrl: authConfig.callbackUrl,
    responseType,
    scope: DEFAULT_SCOPE,
  } as AuthenticationConfigurationWithScope;
};

/**
 * oidc-client sends the popup to the discovery document's authorization endpoint without looking at
 * it, and the popup is still a same-origin window at that point.
 */
const refuseNonHttpAuthorizationEndpoint = (userManager: UserManager) => {
  const { metadataService } = userManager;
  const getAuthorizationEndpoint =
    metadataService.getAuthorizationEndpoint.bind(metadataService);
  metadataService.getAuthorizationEndpoint = async () => {
    const endpoint = await getAuthorizationEndpoint();
    if (!isHttpUrl(endpoint)) {
      throw new UnsafeSignInUrlError();
    }

    return endpoint;
  };
};

const acquireIdToken = async (
  candidate: AuthenticationConfigurationWithScope
): Promise<string | undefined> => {
  const injectedToken = isPlaywrightBuild()
    ? (globalThis as unknown as Record<string, unknown>)[
        E2E_INJECTED_ID_TOKEN_KEY
      ]
    : undefined;
  if (typeof injectedToken === 'string' && injectedToken) {
    return injectedToken;
  }

  globalThis.localStorage.setItem(
    SSO_TEST_LOGIN_CANDIDATE_KEY,
    JSON.stringify(candidate)
  );
  const userManager = new UserManager(getCandidateUserManagerConfig(candidate));
  refuseNonHttpAuthorizationEndpoint(userManager);
  const user = await userManager.signinPopup();

  return user?.id_token;
};

/**
 * Drives the interactive SSO "Test Login" against a candidate (unsaved) configuration, always
 * exercising the same flow the real login uses:
 *
 * - Public-client OIDC signs in in the browser, so the admin completes the sign-in in an isolated
 *   popup and the resulting id_token is checked by the admin-only validate-token endpoint.
 * - Confidential OIDC and SAML sign in on the server: the server starts the test, the popup is sent
 *   to the identity provider, and the outcome is read back by polling.
 * - LDAP and Basic take the admin's credentials in the modal instead of a popup.
 *
 * The admin's current session is never touched: the popup uses a dedicated token store, and the
 * server-driven flows never issue a token or start a session at all.
 */
export const useSsoTestLogin = (): UseSsoTestLoginResult => {
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [result, setResult] = useState<TestLoginResult | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [credentialsSessionId, setCredentialsSessionId] = useState<
    string | undefined
  >();
  // Bumping the run id abandons whatever run is in flight: its polling stops and its late
  // responses are ignored, so a slow first test can never overwrite a newer one.
  const runIdRef = useRef<number>(0);
  const popupRef = useRef<Window | null>(null);

  const abandonRun = useCallback(() => {
    runIdRef.current += 1;
    popupRef.current?.close();
    popupRef.current = null;
  }, []);

  useEffect(() => abandonRun, [abandonRun]);

  const reset = useCallback(() => {
    abandonRun();
    setIsTesting(false);
    setResult(undefined);
    setError(undefined);
    setCredentialsSessionId(undefined);
  }, [abandonRun]);

  const runBrowserTestLogin = useCallback(
    async (securityConfiguration: SecurityConfiguration, runId: number) => {
      let idToken: string | undefined;
      try {
        idToken = await acquireIdToken(
          popupCandidateFor(securityConfiguration)
        );
      } catch (err) {
        // Failure obtaining the token in the popup (cancelled / blocked / refused).
        setError(
          err instanceof UnsafeSignInUrlError
            ? t('message.sso-test-login-unsafe-redirect')
            : t('message.sso-test-login-popup-failed')
        );

        return;
      } finally {
        globalThis.localStorage.removeItem(SSO_TEST_LOGIN_CANDIDATE_KEY);
      }

      if (!idToken) {
        setError(t('message.sso-test-login-no-token'));

        return;
      }

      const response = await testLoginValidateToken({
        securityConfiguration,
        idToken,
      });
      if (runId === runIdRef.current) {
        setResult(response.data);
      }
    },
    []
  );

  const pollUntilSettled = useCallback(
    async (
      testSessionId: string,
      runId: number,
      deadline: number
    ): Promise<TestLoginResult | undefined> => {
      await delay(FETCH_INTERVAL);
      if (runId !== runIdRef.current) {
        return undefined;
      }
      const { data } = await getTestLoginResult(testSessionId);
      const popupClosed = popupRef.current?.closed ?? true;
      if (isTestLoginSettled(data) || popupClosed || Date.now() > deadline) {
        return data;
      }
      setResult(data);

      return pollUntilSettled(testSessionId, runId, deadline);
    },
    []
  );

  const awaitRedirectResult = useCallback(
    async (session: TestLoginSession, popup: Window, runId: number) => {
      const authorizationUrl = session.authorizationUrl ?? '';
      // The server refuses these too; the popup is same-origin until it leaves, so check here as well.
      if (!isHttpUrl(authorizationUrl)) {
        popup.close();
        setError(t('message.sso-test-login-unsafe-redirect'));

        return;
      }
      popup.location.href = authorizationUrl;
      const latest = await pollUntilSettled(
        session.testSessionId,
        runId,
        Date.now() + FETCHING_EXPIRY_TIME
      );
      if (runId !== runIdRef.current || !latest) {
        return;
      }
      // Read before closing it ourselves: an admin-closed window means an abandoned sign-in, an
      // open one means the provider never came back (e.g. it rejected the redirect URI).
      const closedByAdmin = popup.closed;
      popup.close();
      setResult(latest);
      if (!isTestLoginSettled(latest)) {
        setError(
          closedByAdmin
            ? t('message.sso-test-login-popup-closed')
            : t('message.sso-test-login-timeout')
        );
      }
    },
    [pollUntilSettled]
  );

  const runServerTestLogin = useCallback(
    async (
      securityConfiguration: SecurityConfiguration,
      popup: Window | null,
      runId: number
    ) => {
      const { data: session } = await startTestLogin({ securityConfiguration });
      if (runId !== runIdRef.current) {
        return;
      }
      if (session.requiresCredentials) {
        setCredentialsSessionId(session.testSessionId);
      } else if (session.authorizationUrl && popup) {
        await awaitRedirectResult(session, popup, runId);
      } else {
        // The server could not even begin a sign-in; its result already explains why.
        popup?.close();
        const { data } = await getTestLoginResult(session.testSessionId);
        setResult(data);
      }
    },
    [awaitRedirectResult]
  );

  const runTestLogin = useCallback(
    async (securityConfiguration: SecurityConfiguration) => {
      reset();
      const runId = runIdRef.current;
      const { provider, clientType } =
        securityConfiguration.authenticationConfiguration;
      const inBrowser = isBrowserTestLogin(provider, clientType);
      const needsPopup =
        !inBrowser &&
        provider !== AuthProvider.LDAP &&
        provider !== AuthProvider.Basic;
      // Opened synchronously, inside the click that started the test: a popup opened after the
      // server responds is no longer a user gesture, and browsers block it.
      const popup = needsPopup
        ? globalThis.open('', TEST_LOGIN_POPUP_NAME, TEST_LOGIN_POPUP_FEATURES)
        : null;
      if (needsPopup && !popup) {
        setError(t('message.sso-test-login-popup-blocked'));

        return;
      }
      if (popup) {
        // Cut the identity provider's way back to this page (reverse tabnabbing) while the popup is
        // still blank. The test only polls, so it never needs the link.
        popup.opener = null;
      }
      popupRef.current = popup;
      setIsTesting(true);
      try {
        await (inBrowser
          ? runBrowserTestLogin(securityConfiguration, runId)
          : runServerTestLogin(securityConfiguration, popup, runId));
      } catch (err) {
        popup?.close();
        if (runId === runIdRef.current) {
          // The admin-only backend call failed (server error / network) — distinct from a
          // cancelled sign-in, and the server's own reason is the most useful thing to show.
          setError(
            getErrorText(err as AxiosError, t('message.sso-test-login-error'))
          );
        }
      } finally {
        if (runId === runIdRef.current) {
          setIsTesting(false);
        }
      }
    },
    [reset, runBrowserTestLogin, runServerTestLogin]
  );

  const submitCredentials = useCallback(
    async (email: string, password: string) => {
      if (!credentialsSessionId) {
        return;
      }
      const runId = runIdRef.current;
      setIsTesting(true);
      setError(undefined);
      try {
        const { data } = await submitTestLoginCredentials({
          testSessionId: credentialsSessionId,
          email,
          password,
        });
        if (runId === runIdRef.current) {
          setResult(data);
          setCredentialsSessionId(undefined);
        }
      } catch (err) {
        if (runId === runIdRef.current) {
          setError(
            getErrorText(err as AxiosError, t('message.sso-test-login-error'))
          );
        }
      } finally {
        if (runId === runIdRef.current) {
          setIsTesting(false);
        }
      }
    },
    [credentialsSessionId]
  );

  return {
    isTesting,
    isAwaitingCredentials: !!credentialsSessionId,
    result,
    error,
    runTestLogin,
    submitCredentials,
    reset,
  };
};
