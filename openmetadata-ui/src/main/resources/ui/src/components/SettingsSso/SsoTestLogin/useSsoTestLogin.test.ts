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
import { act, renderHook, waitFor } from '@testing-library/react';
import { AxiosResponse } from 'axios';
import { UserManager } from 'oidc-client';
import { StageStatus, Status } from '../../../generated/system/testLoginResult';
import {
  Protocol,
  TestLoginSession,
} from '../../../generated/system/testLoginSession';
import {
  getTestLoginResult,
  SecurityConfiguration,
  startTestLogin,
  submitTestLoginCredentials,
  TestLoginResult,
  testLoginValidateToken,
} from '../../../rest/securityConfigAPI';
import { getCandidateUserManagerConfig } from '../../../utils/AuthProvider.util';
import { setOidcToken } from '../../../utils/SwTokenStorageUtils';
import { SSO_TEST_LOGIN_CANDIDATE_KEY } from './ssoTestCallbackBootstrap';
import { useSsoTestLogin } from './useSsoTestLogin';

jest.mock('oidc-client', () => ({
  UserManager: jest.fn(),
  WebStorageStateStore: jest.fn(),
}));

jest.mock('../../../rest/securityConfigAPI', () => ({
  testLoginValidateToken: jest.fn(),
  startTestLogin: jest.fn(),
  getTestLoginResult: jest.fn(),
  submitTestLoginCredentials: jest.fn(),
}));

jest.mock('../../../utils/AuthProvider.util', () => ({
  getCandidateUserManagerConfig: jest.fn(() => ({})),
  SSO_TEST_LOGIN_STORE_PREFIX: 'omSsoTestLogin.',
}));

jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  setOidcToken: jest.fn(),
  setRefreshToken: jest.fn(),
}));

jest.mock('../../../utils/i18next/LocalUtil', () => ({
  t: (key: string) => key,
}));

// Poll immediately and give up quickly, so the tests exercise the loop without waiting on it.
jest.mock('../../../constants/ServiceType.constant', () => ({
  FETCH_INTERVAL: 0,
  FETCHING_EXPIRY_TIME: 60_000,
}));

const mockUserManager = UserManager as unknown as jest.Mock;
const mockTestLoginValidateToken =
  testLoginValidateToken as jest.MockedFunction<typeof testLoginValidateToken>;
const mockStartTestLogin = startTestLogin as jest.MockedFunction<
  typeof startTestLogin
>;
const mockGetTestLoginResult = getTestLoginResult as jest.MockedFunction<
  typeof getTestLoginResult
>;
const mockSubmitCredentials = submitTestLoginCredentials as jest.MockedFunction<
  typeof submitTestLoginCredentials
>;
const mockCandidateConfig = getCandidateUserManagerConfig as jest.Mock;
const mockSetOidcToken = setOidcToken as jest.MockedFunction<
  typeof setOidcToken
>;

const configFor = (authenticationConfiguration: Record<string, unknown>) =>
  ({
    authenticationConfiguration: {
      authority: 'https://idp.example.com',
      clientId: 'client-1',
      ...authenticationConfiguration,
    },
    authorizerConfiguration: {},
  } as unknown as SecurityConfiguration);

const publicGoogle = configFor({ provider: 'google' });
const confidentialOidc = configFor({
  provider: 'custom-oidc',
  clientType: 'confidential',
});
const ldap = configFor({ provider: 'ldap' });

const asResponse = <T>(data: T) => ({ data } as AxiosResponse<T>);

const fakePopup = (closed = false) => ({
  location: { href: '' },
  close: jest.fn(),
  closed,
  opener: {} as unknown,
});

// Mirrors oidc-client: signinPopup reads the authorization endpoint before sending the popup there.
const userManagerWith = (
  signIn: () => Promise<unknown>,
  authorizationEndpoint = 'https://idp.example.com/authorize'
) => {
  const metadataService = {
    getAuthorizationEndpoint: jest
      .fn()
      .mockResolvedValue(authorizationEndpoint),
  };

  return {
    metadataService,
    signinPopup: jest.fn(() =>
      metadataService.getAuthorizationEndpoint().then(signIn)
    ),
  };
};

const configurationCheck = (passed: boolean, problems: string[] = []) =>
  jest.fn().mockResolvedValue({ passed, problems });

describe('useSsoTestLogin', () => {
  const originalOpen = globalThis.open;

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    globalThis.open = originalOpen;
  });

  describe('public-client OIDC (browser sign-in)', () => {
    it('should obtain an id_token in the popup and validate it on the backend', async () => {
      mockUserManager.mockImplementation(() =>
        userManagerWith(() => Promise.resolve({ id_token: 'id-token-123' }))
      );
      mockTestLoginValidateToken.mockResolvedValue(
        asResponse<TestLoginResult>({
          status: Status.Success,
          resolvedEmail: 'alice@example.com',
        })
      );

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(publicGoogle);
      });

      expect(mockTestLoginValidateToken).toHaveBeenCalledWith({
        securityConfiguration: publicGoogle,
        idToken: 'id-token-123',
      });
      expect(mockStartTestLogin).not.toHaveBeenCalled();

      await waitFor(() =>
        expect(result.current.result?.status).toBe(Status.Success)
      );
    });

    it('should request the same response type the live login requests', async () => {
      mockUserManager.mockImplementation(() =>
        userManagerWith(() => Promise.resolve({ id_token: 'id-token-123' }))
      );
      mockTestLoginValidateToken.mockResolvedValue(
        asResponse<TestLoginResult>({ status: Status.Success })
      );
      const { result } = renderHook(() => useSsoTestLogin());

      for (const config of [
        publicGoogle,
        configFor({ provider: 'google', responseType: 'code' }),
        configFor({ provider: 'okta' }),
      ]) {
        await act(async () => {
          await result.current.runTestLogin(config);
        });
      }

      const requested = mockCandidateConfig.mock.calls.map(
        ([candidate]) => candidate.responseType
      );

      // Google keeps its configured flow; Okta's SDK always uses the code flow with PKCE.
      expect(requested).toEqual(['id_token', 'code', 'code']);
    });

    it('should never write the application token storage (session isolation)', async () => {
      mockUserManager.mockImplementation(() =>
        userManagerWith(() => Promise.resolve({ id_token: 'id-token-123' }))
      );
      mockTestLoginValidateToken.mockResolvedValue(
        asResponse<TestLoginResult>({ status: Status.Success })
      );

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(publicGoogle);
      });

      expect(mockSetOidcToken).not.toHaveBeenCalled();
      // The transient candidate stash is cleaned up after the run.
      expect(
        globalThis.localStorage.getItem(SSO_TEST_LOGIN_CANDIDATE_KEY)
      ).toBeNull();
    });

    it('should surface a popup error when the sign-in is cancelled and not call the backend', async () => {
      mockUserManager.mockImplementation(() =>
        userManagerWith(() => Promise.reject(new Error('popup closed')))
      );

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(publicGoogle);
      });

      expect(result.current.error).toBe('message.sso-test-login-popup-failed');
      expect(mockTestLoginValidateToken).not.toHaveBeenCalled();
    });

    it('should hold the popup at the configuration check and never sign in when it fails', async () => {
      const signIn = jest.fn();
      mockUserManager.mockImplementation(() => userManagerWith(signIn));
      const check = configurationCheck(false, ['Client ID is required']);

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(publicGoogle, check);
      });

      expect(check).toHaveBeenCalledWith(publicGoogle);
      expect(signIn).not.toHaveBeenCalled();
      expect(mockTestLoginValidateToken).not.toHaveBeenCalled();
      expect(result.current.configurationCheck).toEqual({
        status: StageStatus.Failed,
        problems: ['Client ID is required'],
      });
      expect(result.current.error).toBe(
        'message.sso-test-login-configuration-invalid'
      );
    });

    it('should refuse an authorization endpoint that is not an http(s) address', async () => {
      const signIn = jest.fn();
      mockUserManager.mockImplementation(() =>
        userManagerWith(signIn, 'javascript:alert(document.domain)')
      );

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(publicGoogle);
      });

      expect(result.current.error).toBe(
        'message.sso-test-login-unsafe-redirect'
      );
      expect(signIn).not.toHaveBeenCalled();
      expect(mockTestLoginValidateToken).not.toHaveBeenCalled();
    });

    it('should surface a distinct error when the backend validation call fails', async () => {
      mockUserManager.mockImplementation(() =>
        userManagerWith(() => Promise.resolve({ id_token: 'id-token-123' }))
      );
      mockTestLoginValidateToken.mockRejectedValue(new Error('500'));

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(publicGoogle);
      });

      expect(result.current.error).toBe('message.sso-test-login-error');
    });
  });

  describe('server-driven sign-in (confidential OIDC, SAML)', () => {
    // The project enables fake timers globally; these tests poll with a zero interval, so they
    // need timers that actually fire.
    beforeEach(() => {
      jest.useRealTimers();
    });

    afterEach(() => {
      jest.useFakeTimers();
    });

    const session: TestLoginSession = {
      testSessionId: 'session-1',
      protocol: Protocol.Oidc,
      authorizationUrl:
        'https://idp.example.com/authorize?state=omtest:session-1',
    };

    it('should open the popup inside the click, send it to the provider and read the result back', async () => {
      const popup = fakePopup();
      globalThis.open = jest.fn(() => popup as unknown as Window);
      mockStartTestLogin.mockResolvedValue(asResponse(session));
      mockGetTestLoginResult
        .mockResolvedValueOnce(
          asResponse<TestLoginResult>({ status: Status.Pending })
        )
        .mockResolvedValueOnce(
          asResponse<TestLoginResult>({
            status: Status.Success,
            resolvedEmail: 'alice@example.com',
          })
        );

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(confidentialOidc);
      });

      expect(globalThis.open).toHaveBeenCalledWith(
        '',
        expect.any(String),
        expect.any(String)
      );
      expect(popup.location.href).toBe(session.authorizationUrl);
      expect(mockGetTestLoginResult).toHaveBeenCalledWith('session-1');
      expect(result.current.result?.status).toBe(Status.Success);
      expect(popup.close).toHaveBeenCalled();
      expect(mockUserManager).not.toHaveBeenCalled();
    });

    it("should cut the popup's link back to this page before the provider loads", async () => {
      const popup = fakePopup();
      globalThis.open = jest.fn(() => popup as unknown as Window);
      mockStartTestLogin.mockResolvedValue(asResponse(session));
      mockGetTestLoginResult.mockResolvedValue(
        asResponse<TestLoginResult>({ status: Status.Success })
      );

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(confidentialOidc);
      });

      expect(popup.opener).toBeNull();
    });

    it('should refuse to send the popup to a sign-in address that is not http(s)', async () => {
      const popup = fakePopup();
      globalThis.open = jest.fn(() => popup as unknown as Window);
      mockStartTestLogin.mockResolvedValue(
        asResponse({
          ...session,
          authorizationUrl: 'javascript:alert(document.domain)//',
        })
      );

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(confidentialOidc);
      });

      expect(popup.location.href).toBe('');
      expect(popup.close).toHaveBeenCalled();
      expect(result.current.error).toBe(
        'message.sso-test-login-unsafe-redirect'
      );
      expect(mockGetTestLoginResult).not.toHaveBeenCalled();
    });

    it('should close the popup and not start the test when the configuration check fails', async () => {
      const popup = fakePopup();
      globalThis.open = jest.fn(() => popup as unknown as Window);

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(
          confidentialOidc,
          configurationCheck(false, ['The discovery document is unreachable'])
        );
      });

      expect(mockStartTestLogin).not.toHaveBeenCalled();
      expect(popup.close).toHaveBeenCalled();
      expect(popup.location.href).toBe('');
      expect(result.current.configurationCheck?.status).toBe(
        StageStatus.Failed
      );
    });

    it('should start the test once the configuration check passes', async () => {
      globalThis.open = jest.fn(() => fakePopup() as unknown as Window);
      mockStartTestLogin.mockResolvedValue(asResponse(session));
      mockGetTestLoginResult.mockResolvedValue(
        asResponse<TestLoginResult>({ status: Status.Success })
      );
      const check = configurationCheck(true);

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(confidentialOidc, check);
      });

      expect(check.mock.invocationCallOrder[0]).toBeLessThan(
        mockStartTestLogin.mock.invocationCallOrder[0]
      );
      expect(result.current.configurationCheck?.status).toBe(
        StageStatus.Passed
      );
      expect(result.current.result?.status).toBe(Status.Success);
    });

    it('should report a blocked popup without starting the test', async () => {
      globalThis.open = jest.fn(() => null);

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(confidentialOidc);
      });

      expect(result.current.error).toBe('message.sso-test-login-popup-blocked');
      expect(mockStartTestLogin).not.toHaveBeenCalled();
    });

    it('should report a sign-in window the admin closed before finishing', async () => {
      globalThis.open = jest.fn(() => fakePopup(true) as unknown as Window);
      mockStartTestLogin.mockResolvedValue(asResponse(session));
      mockGetTestLoginResult.mockResolvedValue(
        asResponse<TestLoginResult>({ status: Status.Pending })
      );

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(confidentialOidc);
      });

      expect(result.current.error).toBe('message.sso-test-login-popup-closed');
    });

    it('should show why the server could not even start the sign-in', async () => {
      const popup = fakePopup();
      globalThis.open = jest.fn(() => popup as unknown as Window);
      mockStartTestLogin.mockResolvedValue(
        asResponse<TestLoginSession>({
          testSessionId: 'session-2',
          protocol: Protocol.Oidc,
        })
      );
      mockGetTestLoginResult.mockResolvedValue(
        asResponse<TestLoginResult>({
          status: Status.Failed,
          errors: ['Could not start a sign-in against the candidate provider'],
        })
      );

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(confidentialOidc);
      });

      expect(popup.close).toHaveBeenCalled();
      expect(result.current.result?.status).toBe(Status.Failed);
    });
  });

  describe('credential sign-in (LDAP, Basic)', () => {
    it('should wait for credentials instead of opening a popup, then submit them once', async () => {
      globalThis.open = jest.fn();
      mockStartTestLogin.mockResolvedValue(
        asResponse<TestLoginSession>({
          testSessionId: 'session-3',
          protocol: Protocol.LDAP,
          requiresCredentials: true,
        })
      );
      mockSubmitCredentials.mockResolvedValue(
        asResponse<TestLoginResult>({
          status: Status.Success,
          resolvedEmail: 'alice@example.com',
        })
      );

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(ldap);
      });

      expect(globalThis.open).not.toHaveBeenCalled();
      expect(result.current.isAwaitingCredentials).toBe(true);

      await act(async () => {
        await result.current.submitCredentials('alice@example.com', 's3cret');
      });

      expect(mockSubmitCredentials).toHaveBeenCalledWith({
        testSessionId: 'session-3',
        email: 'alice@example.com',
        password: 's3cret',
      });
      expect(result.current.result?.status).toBe(Status.Success);
      expect(result.current.isAwaitingCredentials).toBe(false);
    });

    it('should show the server’s reason when the credentials are refused', async () => {
      mockStartTestLogin.mockResolvedValue(
        asResponse<TestLoginSession>({
          testSessionId: 'session-4',
          protocol: Protocol.LDAP,
          requiresCredentials: true,
        })
      );
      mockSubmitCredentials.mockRejectedValue({
        response: { data: { message: 'Too many credential test logins.' } },
      });

      const { result } = renderHook(() => useSsoTestLogin());

      await act(async () => {
        await result.current.runTestLogin(ldap);
      });
      await act(async () => {
        await result.current.submitCredentials('alice@example.com', 'wrong');
      });

      expect(result.current.error).toBe('Too many credential test logins.');
      expect(result.current.isAwaitingCredentials).toBe(true);
    });
  });
});
