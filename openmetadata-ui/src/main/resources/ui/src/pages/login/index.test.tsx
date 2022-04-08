/*
 *  Copyright 2021 Collate
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

import { findByTestId, findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthContext } from '../../auth-provider/AuthProvider';
import SigninPage from './index';

const mockUseAuthContext = useAuthContext as jest.Mock;

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
}));

jest.mock('../../auth-provider/AuthProvider', () => ({
  useAuthContext: jest.fn(),
}));

jest.mock(
  '../../components/containers/PageContainer',
  () =>
    ({ children }: { children: React.ReactNode }) =>
      <div data-testid="PageContainer">{children}</div>
);

jest.mock('../../assets/img/login-bg.png', () => 'login-bg.png');

jest.mock('./LoginCarousel', () =>
  jest.fn().mockReturnValue(<p>LoginCarousel</p>)
);

describe('Test SigninPage Component', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('Component should render', async () => {
    mockUseAuthContext.mockReturnValue({
      isAuthDisabled: false,
      authConfig: { provider: 'google' },
      onLoginHandler: jest.fn(),
    });
    const { container } = render(<SigninPage />, {
      wrapper: MemoryRouter,
    });
    const signInPage = await findByTestId(container, 'signin-page');
    const bgImg = await findByTestId(container, 'bg-image');
    const LoginCarousel = await findByText(container, /LoginCarousel/i);

    expect(signInPage).toBeInTheDocument();
    expect(bgImg).toBeInTheDocument();
    expect(LoginCarousel).toBeInTheDocument();
  });

  it.each([
    ['google', 'Sign in with google'],
    ['okta', 'Sign in with okta'],
    ['auth0', 'Sign in with auth0'],
    ['azure', 'Sign in with azure'],
    ['custom-oidc', 'Sign in with sso'],
    ['unknown-provider', 'SSO Provider unknown-provider is not supported'],
  ])(
    'Sign in button should render correctly for %s',
    async (provider, buttonText) => {
      mockUseAuthContext.mockReturnValue({
        isAuthDisabled: false,
        authConfig: { provider },
        onLoginHandler: jest.fn(),
      });
      const { container } = render(<SigninPage />, {
        wrapper: MemoryRouter,
      });
      const signinButton = await findByText(
        container,
        new RegExp(buttonText, 'i')
      );

      expect(signinButton).toBeInTheDocument();
    }
  );

  it('Sign in button should render correctly with custom provider name', async () => {
    mockUseAuthContext.mockReturnValue({
      isAuthDisabled: false,
      authConfig: { provider: 'custom-oidc', providerName: 'Custom OIDC' },
      onLoginHandler: jest.fn(),
    });
    const { container } = render(<SigninPage />, {
      wrapper: MemoryRouter,
    });
    const signinButton = await findByText(
      container,
      /sign in with custom oidc/i
    );

    expect(signinButton).toBeInTheDocument();
  });
});
