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

import { findByTestId, render } from '@testing-library/react';
import React from 'react';
import NonAdminAction from './NonAdminAction';

const mockAuth = {
  isAdminUser: true,
  isAuthDisabled: true,
  userPermissions: {
    UpdateOwner: true,
  },
};

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: jest.fn(() => mockAuth),
}));

jest.mock('../../../auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

jest.mock('../popover/PopOver', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="popover">{children}</p>
    ));
});

describe('Test AddUsersModal component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <NonAdminAction>
        <button data-testid="test-button">test</button>
      </NonAdminAction>
    );

    const testButton = await findByTestId(container, 'test-button');

    expect(testButton).toBeInTheDocument();
  });

  it('Should restrict user if criteria does not match', async () => {
    mockAuth.isAdminUser = false;
    mockAuth.isAuthDisabled = false;
    mockAuth.userPermissions.UpdateOwner = false;

    const { container } = render(
      <NonAdminAction title="test popup" trigger="click">
        <button data-testid="test-button">test</button>
      </NonAdminAction>
    );

    const popover = await findByTestId(container, 'popover');

    expect(popover).toBeInTheDocument();
  });
});
