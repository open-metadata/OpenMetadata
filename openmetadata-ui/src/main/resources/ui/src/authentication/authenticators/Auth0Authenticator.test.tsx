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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Auth0Authenticator from './Auth0Authenticator';

jest.mock('../auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      authConfig: {},
      setIsAuthenticated: jest.fn(),
      onLogoutHandler: jest.fn(),
    })),
  };
});

describe('Test Auth0Authenticator component', () => {
  it('Checks if the Auth0Authenticator renders', async () => {
    const onLogoutMock = jest.fn();
    const authenticatorRef = null;
    render(
      <Auth0Authenticator ref={authenticatorRef} onLogoutSuccess={onLogoutMock}>
        <p data-testid="children" />
      </Auth0Authenticator>,
      {
        wrapper: MemoryRouter,
      }
    );
    const children = screen.getByTestId('children');

    expect(children).toBeInTheDocument();
  });
});
