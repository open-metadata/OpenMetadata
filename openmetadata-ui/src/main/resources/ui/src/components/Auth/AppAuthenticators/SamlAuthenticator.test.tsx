/*
 *  Copyright 2024 Collate.
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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';
import SamlAuthenticator from './SamlAuthenticator';

jest.mock('../../../hooks/useApplicationStore', () => {
  return {
    useApplicationStore: jest.fn(() => ({
      authConfig: {},
    })),
  };
});

jest.mock('../AuthProviders/AuthProvider', () => ({
  useAuthProvider: jest.fn().mockImplementation(() => ({
    handleSuccessfulLogout: jest.fn(),
    handleFailedLogin: jest.fn(),
    handleSuccessfulLogin: jest.fn(),
    updateAxiosInterceptors: jest.fn(),
  })),
}));

jest.mock('../../../rest/auth-API', () => {
  return {
    refreshSAMLToken: jest.fn().mockResolvedValue({
      accessToken: 'test_token',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiryDuration: 1000,
      email: 'test@test.com',
    }),
  };
});

describe('Test SamlAuthenticator component', () => {
  it('Checks if the SamlAuthenticator renders', async () => {
    const authenticatorRef = null;
    render(
      <SamlAuthenticator ref={authenticatorRef}>
        <p data-testid="children" />
      </SamlAuthenticator>,
      {
        wrapper: MemoryRouter,
      }
    );
    const children = screen.getByTestId('children');

    expect(children).toBeInTheDocument();
  });

  it('Rejects promise when renew id token is called', async () => {
    const authenticatorRef = React.createRef<AuthenticatorRef>();

    render(
      <SamlAuthenticator ref={authenticatorRef}>
        <p data-testid="children" />
      </SamlAuthenticator>,
      {
        wrapper: MemoryRouter,
      }
    );

    await expect(authenticatorRef.current?.renewIdToken()).resolves.toEqual({
      accessToken: 'test_token',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiryDuration: 1000,
      email: 'test@test.com',
    });
  });
});
