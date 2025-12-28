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
import DomainRouter from './DomainRouter';

// Mock i18n to prevent 'add' method error
jest.mock('../../utils/i18next/LocalUtil', () => ({
  __esModule: true,
  default: {
    t: (key: string) => key,
  },
}));

jest.mock('../Domain/DomainDetailPage/DomainDetailPage.component', () => {
  return jest.fn().mockReturnValue(<div>DomainDetailPage</div>);
});

jest.mock('../DomainListing/DomainListPage', () => {
  return jest.fn().mockReturnValue(<div>DomainsListPage</div>);
});

jest.mock('./AdminProtectedRoute', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(() => ({
    permissions: {},
  })),
}));

jest.mock('../../utils/PermissionsUtils', () => {
  return {
    userPermissions: {
      hasViewPermissions: jest.fn(() => true),
    },
  };
});

describe('DomainRouter', () => {
  it('should render DomainPage component for the DOMAIN route when user has domain view permission', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <DomainRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('DomainsListPage')).toBeInTheDocument();
  });

  it('should render DomainDetailPage component for the DOMAIN_DETAILS and DOMAIN_DETAILS_WITH_TAB routes when user has domain view permission', async () => {
    render(
      <MemoryRouter initialEntries={['/testDomain']}>
        <DomainRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('DomainDetailPage')).toBeInTheDocument();
  });
});
