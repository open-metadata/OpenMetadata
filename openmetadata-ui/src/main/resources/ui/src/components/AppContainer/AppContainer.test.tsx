/*
 *  Copyright 2023 Collate.
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
import { MemoryRouter, Switch } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import AppContainer from './AppContainer';

jest.mock('../../AppState', () => ({
  getCurrentUserDetails: jest.fn().mockReturnValue({
    id: '2e424734-761a-443f-bf2a-a5b361823c80',
    type: 'user',
    name: 'aaron_johnson0',
    fullyQualifiedName: 'aaron_johnson0',
    displayName: 'Aaron Johnson',
    deleted: false,
  }),
  newUser: {
    name: 'Sample Name',
    email: 'sample123@sample.com',
    picture: 'Profile Picture',
  },
}));

jest.mock('../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      signingIn: false,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

jest.mock('../../hooks/authHooks', () => ({
  useAuth: () => {
    return {
      isSignedIn: true,
      isSignedOut: false,
      isAuthenticatedRoute: true,
      isAuthDisabled: true,
    };
  },
}));

jest.mock('../../components/MyData/LeftSidebar/LeftSidebar.component', () =>
  jest.fn().mockReturnValue(<p>Sidebar</p>)
);

jest.mock('../../components/AppBar/Appbar', () =>
  jest.fn().mockReturnValue(<p>Appbar</p>)
);

jest.mock('../../pages/SignUp/SignUpPage', () =>
  jest.fn().mockReturnValue(<p>SignUpPage</p>)
);

jest.mock('../../components/router/AuthenticatedAppRouter', () =>
  jest.fn().mockReturnValue(<p>AuthenticatedAppRouter</p>)
);

describe('AppContainer', () => {
  it('renders the SignupPage when on the signup route', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.SIGNUP]}>
        <Switch>
          <AppContainer />
        </Switch>
      </MemoryRouter>
    );

    expect(screen.getByText('SignUpPage')).toBeInTheDocument();
    expect(screen.queryByText('Sidebar')).not.toBeInTheDocument();
  });

  it('renders the Appbar, LeftSidebar, and AuthenticatedAppRouter components', () => {
    render(
      <MemoryRouter>
        <AppContainer />
      </MemoryRouter>
    );

    expect(screen.getByText('Appbar')).toBeInTheDocument();
    expect(screen.getByText('Sidebar')).toBeInTheDocument();
    expect(screen.getByText('AuthenticatedAppRouter')).toBeInTheDocument();
  });
});
