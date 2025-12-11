/*
 *  Copyright 2025 Collate.
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
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import DataProductsDetailsPage from './DataProductsDetailsPage.component';

// Mock i18n to prevent 'add' method error
jest.mock('../../../utils/i18next/LocalUtil', () => ({
  __esModule: true,
  default: {
    t: (key: string) => key,
  },
  t: (key: string) => key,
  detectBrowserLanguage: () => 'en-US',
}));

// Mock react-helmet-async
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  HelmetProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock hooks
jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { id: '1' },
  }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({ fqn: 'test-data-product' })),
}));

jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: () => ({
    customizedPage: undefined,
    isLoading: false,
  }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getEntityPermission: jest.fn(),
    permissions: {},
  }),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: () => ({
    tab: 'documentation',
    version: undefined,
  }),
}));

jest.mock('../../../rest/feedsAPI', () => ({
  getActiveAnnouncement: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { total: { value: 0 } } }),
}));

const mockDataProduct: DataProduct = {
  id: 'test-data-product-id',
  name: 'Test Data Product',
  displayName: 'Test Data Product',
  fullyQualifiedName: 'test.dataProduct',
  description: 'Test description',
  version: 0.1,
  updatedAt: Date.now(),
  updatedBy: 'admin',
  owners: [],
  domains: [],
  href: '',
};

describe('DataProductsDetailsPage', () => {
  it('should render data product detail page', () => {
    const { container } = render(
      <MemoryRouter>
        <DataProductsDetailsPage
          dataProduct={mockDataProduct}
          handleFollowingClick={jest.fn()}
          isFollowing={false}
          isFollowingLoading={false}
          onDelete={jest.fn()}
          onUpdate={jest.fn()}
        />
      </MemoryRouter>
    );

    // Check that the component renders without throwing
    expect(container).toBeInTheDocument();
  });

  it('should display correct tabs with proper labels', () => {
    render(
      <MemoryRouter>
        <DataProductsDetailsPage
          dataProduct={mockDataProduct}
          handleFollowingClick={jest.fn()}
          isFollowing={false}
          isFollowingLoading={false}
          onDelete={jest.fn()}
          onUpdate={jest.fn()}
        />
      </MemoryRouter>
    );

    // Check for tab labels using translation keys
    expect(screen.getByText('label.documentation')).toBeInTheDocument();
  });

  it('should handle version view correctly', () => {
    const { container } = render(
      <MemoryRouter>
        <DataProductsDetailsPage
          dataProduct={mockDataProduct}
          handleFollowingClick={jest.fn()}
          isFollowing={false}
          isFollowingLoading={false}
          isVersionsView
          onDelete={jest.fn()}
          onUpdate={jest.fn()}
        />
      </MemoryRouter>
    );

    // Component should render in version view
    expect(container).toBeInTheDocument();
  });
});
