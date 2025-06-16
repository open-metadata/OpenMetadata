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
import { getLimitConfig } from '../../rest/limitsAPI';
import applicationsClassBase from '../Settings/Applications/AppDetails/ApplicationsClassBase';
import AppContainer from './AppContainer';

jest.mock('../../hooks/useApplicationStore', () => {
  return {
    useApplicationStore: jest.fn(() => ({
      currentUser: { id: '1', email: 'user@gamil.com' },
      isAuthenticated: true,
    })),
  };
});

jest.mock(
  '../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => {
    return {
      useApplicationsProvider: jest.fn(() => ({
        applications: [],
      })),
    };
  }
);

jest.mock('../../components/MyData/LeftSidebar/LeftSidebar.component', () =>
  jest.fn().mockReturnValue(<p>Sidebar</p>)
);

jest.mock('../../components/AppRouter/AuthenticatedAppRouter', () =>
  jest.fn().mockReturnValue(<p>AuthenticatedAppRouter</p>)
);

jest.mock('../../rest/limitsAPI');

jest.mock('../../rest/domainAPI', () => ({
  getDomainList: jest.fn().mockResolvedValue({
    data: [{ id: 'test', name: 'testing' }],
    paging: { total: 10 },
  }),
}));

jest.mock('../../hooks/useDomainStore', () => ({
  useDomainStore: jest.fn().mockReturnValue({
    updateDomainLoading: jest.fn(),
    updateDomains: jest.fn(),
  }),
}));

describe.skip('AppContainer', () => {
  it('renders the Appbar, LeftSidebar, and AuthenticatedAppRouter components', () => {
    const ApplicationExtras = () => (
      <div data-testid="test-app">ApplicationExtras</div>
    );
    const spy = jest
      .spyOn(applicationsClassBase, 'getApplicationExtension')
      .mockImplementation(() => ApplicationExtras);

    render(
      <MemoryRouter>
        <AppContainer />
      </MemoryRouter>
    );

    expect(spy).toHaveBeenCalled();
    expect(screen.getByText('Navbar')).toBeInTheDocument();
    expect(screen.getByText('Sidebar')).toBeInTheDocument();
    expect(screen.getByText('AuthenticatedAppRouter')).toBeInTheDocument();
    expect(screen.getByTestId('test-app')).toBeInTheDocument();
  });

  it('should call limit api', () => {
    render(
      <MemoryRouter>
        <AppContainer />
      </MemoryRouter>
    );

    expect(getLimitConfig).toHaveBeenCalled();
  });
});
