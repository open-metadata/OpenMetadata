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
import {
  SecurityConfiguration,
  TestLoginResult,
  testLoginValidateToken,
} from '../../../rest/securityConfigAPI';
import { setOidcToken } from '../../../utils/SwTokenStorageUtils';
import { SSO_TEST_LOGIN_CANDIDATE_KEY } from './ssoTestCallbackBootstrap';
import { useSsoTestLogin } from './useSsoTestLogin';

jest.mock('oidc-client', () => ({
  UserManager: jest.fn(),
  WebStorageStateStore: jest.fn(),
}));

jest.mock('../../../rest/securityConfigAPI', () => ({
  testLoginValidateToken: jest.fn(),
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

const mockUserManager = UserManager as unknown as jest.Mock;
const mockTestLoginValidateToken =
  testLoginValidateToken as jest.MockedFunction<typeof testLoginValidateToken>;
const mockSetOidcToken = setOidcToken as jest.MockedFunction<
  typeof setOidcToken
>;

const securityConfiguration = {
  authenticationConfiguration: {
    authority: 'https://accounts.google.com',
    clientId: 'client-1',
  },
  authorizerConfiguration: {},
} as unknown as SecurityConfiguration;

const asResponse = (data: TestLoginResult) =>
  ({ data } as AxiosResponse<TestLoginResult>);

describe('useSsoTestLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.localStorage.clear();
  });

  it('should obtain an id_token in the popup and validate it on the backend', async () => {
    mockUserManager.mockImplementation(() => ({
      signinPopup: jest.fn().mockResolvedValue({ id_token: 'id-token-123' }),
    }));
    mockTestLoginValidateToken.mockResolvedValue(
      asResponse({ status: 'success', resolvedEmail: 'alice@example.com' })
    );

    const { result } = renderHook(() => useSsoTestLogin());

    await act(async () => {
      await result.current.runTestLogin(securityConfiguration);
    });

    expect(mockTestLoginValidateToken).toHaveBeenCalledWith({
      securityConfiguration,
      idToken: 'id-token-123',
    });

    await waitFor(() => expect(result.current.result?.status).toBe('success'));
  });

  it('should never write the application token storage (session isolation)', async () => {
    mockUserManager.mockImplementation(() => ({
      signinPopup: jest.fn().mockResolvedValue({ id_token: 'id-token-123' }),
    }));
    mockTestLoginValidateToken.mockResolvedValue(
      asResponse({ status: 'success' })
    );

    const { result } = renderHook(() => useSsoTestLogin());

    await act(async () => {
      await result.current.runTestLogin(securityConfiguration);
    });

    expect(mockSetOidcToken).not.toHaveBeenCalled();
    // The transient candidate stash is cleaned up after the run.
    expect(
      globalThis.localStorage.getItem(SSO_TEST_LOGIN_CANDIDATE_KEY)
    ).toBeNull();
  });

  it('should surface an error when the popup is cancelled and not call the backend', async () => {
    mockUserManager.mockImplementation(() => ({
      signinPopup: jest.fn().mockRejectedValue(new Error('popup closed')),
    }));

    const { result } = renderHook(() => useSsoTestLogin());

    await act(async () => {
      await result.current.runTestLogin(securityConfiguration);
    });

    expect(result.current.error).toBe('message.sso-test-login-popup-failed');
    expect(mockTestLoginValidateToken).not.toHaveBeenCalled();
  });
});
