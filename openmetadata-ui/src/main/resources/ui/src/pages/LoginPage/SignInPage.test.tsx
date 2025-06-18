/*
 *  Copyright 2022 Collate.
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

import {
  findByTestId,
  findByText,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { CarouselLayout } from '../../components/Layout/CarouselLayout/CarouselLayout';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import SignInPage from './SignInPage';

const mockuseApplicationStore = useApplicationStore as unknown as jest.Mock;

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    applicationConfig: {
      customLogoConfig: {
        customLogoUrlPath: 'https://custom-logo.png',
        customMonogramUrlPath: 'https://custom-monogram.png',
      },
    },
    getOidcToken: jest.fn(),
  })),
}));

jest.mock('./LoginCarousel', () =>
  jest.fn().mockReturnValue(<p>LoginCarousel</p>)
);

jest.mock('../../components/common/BrandImage/BrandImage', () => {
  return jest.fn().mockReturnValue(<p>testBrandLogo</p>);
});

jest.mock('../../components/common/DocumentTitle/DocumentTitle', () => {
  return jest.fn().mockReturnValue(<p>DocumentTitle</p>);
});

jest.mock('../../components/Layout/CarouselLayout/CarouselLayout', () => ({
  CarouselLayout: jest.fn().mockImplementation(({ children }) => children),
}));

describe('Test SignInPage Component', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('Component should render', async () => {
    mockuseApplicationStore.mockReturnValue({
      isAuthDisabled: false,
      authConfig: { provider: 'google' },
      onLoginHandler: jest.fn(),
      onLogoutHandler: jest.fn(),
      getOidcToken: jest.fn(),
    });
    const { container } = render(<SignInPage />, {
      wrapper: MemoryRouter,
    });
    const signInPage = await findByTestId(container, 'login-form-container');

    expect(signInPage).toBeInTheDocument();
    expect(CarouselLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        pageTitle: 'label.sign-in',
      }),
      {}
    );
  });

  it.each([
    ['google', 'Sign in with google'],
    ['okta', 'Sign in with okta'],
    ['auth0', 'Sign in with auth0'],
    ['azure', 'Sign in with azure'],
    ['custom-oidc', 'Sign in with sso'],
    ['aws-cognito', 'Sign in with aws cognito'],
    ['unknown-provider', 'SSO Provider unknown-provider is not supported'],
  ])('Sign in button should render correctly for %s', async (provider) => {
    mockuseApplicationStore.mockReturnValue({
      isAuthDisabled: false,
      authConfig: { provider },
      onLoginHandler: jest.fn(),
      onLogoutHandler: jest.fn(),
      getOidcToken: jest.fn(),
    });
    const { container } = render(<SignInPage />, {
      wrapper: MemoryRouter,
    });
    const isUnknow = provider === 'unknown-provider';

    const signinButton = await findByText(
      container,
      isUnknow
        ? /message.sso-provider-not-supported/i
        : /label.sign-in-with-sso/i
    );

    expect(signinButton).toBeInTheDocument();
  });

  it('Sign in button should render correctly with custom provider name', async () => {
    mockuseApplicationStore.mockReturnValue({
      isAuthDisabled: false,
      authConfig: { provider: 'custom-oidc', providerName: 'Custom OIDC' },
      onLoginHandler: jest.fn(),
      onLogoutHandler: jest.fn(),
      getOidcToken: jest.fn(),
    });
    const { container } = render(<SignInPage />, {
      wrapper: MemoryRouter,
    });
    const signinButton = await findByText(container, /label.sign-in-with-sso/i);

    expect(signinButton).toBeInTheDocument();
  });

  it('Page should render the correct logo image', async () => {
    mockuseApplicationStore.mockReturnValue({
      isAuthDisabled: false,
      authConfig: { provider: 'custom-oidc', providerName: 'Custom OIDC' },
      onLoginHandler: jest.fn(),
      onLogoutHandler: jest.fn(),
      getOidcToken: jest.fn(),
      applicationConfig: {
        customLogoConfig: {
          customLogoUrlPath: 'https://custom-logo.png',
          customMonogramUrlPath: 'https://custom-monogram.png',
        },
      },
    });
    render(<SignInPage />, {
      wrapper: MemoryRouter,
    });

    const brandLogoImage = await screen.findByText('testBrandLogo');

    expect(brandLogoImage).toBeInTheDocument();
  });
});
