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

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BasicAuthProvider, { useBasicAuth } from './BasicAuthProvider';

const mockBasicAuthSignIn = jest.fn().mockResolvedValue({});

jest.mock('../../../rest/auth-API', () => ({
  basicAuthRegister: jest.fn(),
  basicAuthSignIn: (...args: unknown[]) => mockBasicAuthSignIn(...args),
  generatePasswordResetLink: jest.fn(),
  logoutUser: jest.fn(),
  resetPassword: jest.fn(),
}));

jest.mock('./AuthProvider', () => ({
  useAuthProvider: () => ({
    handleSuccessfulLogin: jest.fn(),
    handleFailedLogin: jest.fn(),
    handleSuccessfulLogout: jest.fn(),
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  getOidcToken: jest.fn().mockResolvedValue(''),
  getRefreshToken: jest.fn().mockResolvedValue(''),
  setOidcToken: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/WebAnalyticsUtils', () => ({
  resetWebAnalyticSession: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showInfoToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const LoginTrigger = ({ password }: { password: string }) => {
  const { handleLogin } = useBasicAuth();

  return (
    <button onClick={() => handleLogin('user@example.com', password)}>
      login
    </button>
  );
};

const login = async (password: string) => {
  render(
    <BasicAuthProvider>
      <LoginTrigger password={password} />
    </BasicAuthProvider>
  );

  await userEvent.click(screen.getByRole('button', { name: 'login' }), {
    advanceTimers: jest.advanceTimersByTime,
  });

  await waitFor(() => expect(mockBasicAuthSignIn).toHaveBeenCalled());

  return mockBasicAuthSignIn.mock.calls[0][0].password as string;
};

const decodeUtf8Base64 = (encoded: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
  );

describe('BasicAuthProvider handleLogin', () => {
  it('should base64 encode an ASCII password', async () => {
    expect(await login('plainAscii123')).toBe('cGxhaW5Bc2NpaTEyMw==');
  });

  // Regression for issue #28694: the password was encoded with `btoa`, which
  // maps each character to a single Latin-1 byte, so the server's UTF-8 decode
  // reconstructed a different password and basic/LDAP login failed.
  it.each(['Test§123£', 'Pässwörd1!', '密码2024', 'pw🔒key'])(
    'should send %j as base64 of its UTF-8 bytes',
    async (password) => {
      const sent = await login(password);

      expect(decodeUtf8Base64(sent)).toBe(password);
    }
  );

  it('should not send the Latin-1 encoding for a non-ASCII password', async () => {
    const password = 'Test§123£';

    expect(await login(password)).not.toBe(btoa(password));
  });
});
