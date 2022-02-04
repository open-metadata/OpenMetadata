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
import appState from '../../AppState';
import SigninPage from './index';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
}));

jest.mock(
  '../../components/containers/PageContainer',
  () =>
    ({ children }: { children: React.ReactNode }) =>
      <div data-testid="PageContainer">{children}</div>
);

jest.mock('../../assets/img/login-bg.jpeg', () => 'login-bg.jpeg');

jest.mock('./LoginCarousel', () =>
  jest.fn().mockReturnValue(<p>LoginCarousel</p>)
);

describe('Test SigninPage Component', () => {
  it('Component should render', async () => {
    const { container } = render(<SigninPage />, {
      wrapper: MemoryRouter,
    });
    const servicePage = await findByTestId(container, 'signin-page');
    const bgImg = await findByTestId(container, 'bg-image');
    const LoginCarousel = await findByText(container, /LoginCarousel/i);

    expect(servicePage).toBeInTheDocument();
    expect(bgImg).toBeInTheDocument();
    expect(LoginCarousel).toBeInTheDocument();
  });

  it('Sign in button should render', async () => {
    const { container } = render(<SigninPage />, {
      wrapper: MemoryRouter,
    });
    const store = appState;
    store.authProvider.provider = 'google';
    const signinButton = await findByText(container, /Sign in with google/i);

    expect(store.authProvider.provider).toBe('google');
    expect(signinButton).toBeInTheDocument();
  });
});
