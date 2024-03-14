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
import { MemoryRouter } from 'react-router-dom';
import AppContainer from './AppContainer';

jest.mock('../../hooks/useApplicationStore', () => {
  return {
    useApplicationStore: jest.fn(() => ({
      currentUser: { id: '1', email: 'user@gamil.com' },
    })),
  };
});

jest.mock('../../components/MyData/LeftSidebar/LeftSidebar.component', () =>
  jest.fn().mockReturnValue(<p>Sidebar</p>)
);

jest.mock('../../components/AppBar/Appbar', () =>
  jest.fn().mockReturnValue(<p>Appbar</p>)
);

jest.mock('../../components/AppRouter/AuthenticatedAppRouter', () =>
  jest.fn().mockReturnValue(<p>AuthenticatedAppRouter</p>)
);

describe('AppContainer', () => {
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
