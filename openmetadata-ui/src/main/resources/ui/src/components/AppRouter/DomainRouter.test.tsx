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
import { MemoryRouter } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import DomainRouter from './DomainRouter';

jest.mock('../Domain/AddDomain/AddDomain.component', () => {
  return jest.fn().mockReturnValue(<div>AddDomain</div>);
});

jest.mock('../Domain/DomainPage.component', () => {
  return jest.fn().mockReturnValue(<div>DomainPage</div>);
});

jest.mock('./AdminProtectedRoute', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('../../utils/PermissionsUtils', () => {
  return {
    userPermissions: {
      hasViewPermissions: jest.fn(() => true),
    },
  };
});

describe('DomainRouter', () => {
  it('should render AddDomain component for the ADD_DOMAIN route', async () => {
    render(
      <MemoryRouter initialEntries={['/add']}>
        <DomainRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('AddDomain')).toBeInTheDocument();
  });

  it('should render DomainPage component for the DOMAIN route when user has domain view permission', async () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.DOMAIN]}>
        <DomainRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('DomainPage')).toBeInTheDocument();
  });

  it('should render DomainPage component for the DOMAIN_DETAILS and DOMAIN_DETAILS_WITH_TAB routes when user has domain view permission', async () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.DOMAIN_DETAILS]}>
        <DomainRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('DomainPage')).toBeInTheDocument();
  });
});
