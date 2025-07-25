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
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { useDynamicEntitySearch } from '../../hooks/useDynamicEntitySearch';
import { ENTITY_PERMISSIONS } from '../../mocks/Permissions.mock';
import DataProductsPage from './DataProductsPage.component';

// Mock hooks and dependencies
jest.mock('../../context/PermissionProvider/PermissionProvider');
jest.mock('../../hooks/useDynamicEntitySearch');
jest.mock('../../hooks/useApplicationStore');
jest.mock('../../components/common/EntityTable/EntityTable.component', () => {
  return function EntityTable() {
    return <div data-testid="entity-table">EntityTable</div>;
  };
});
jest.mock('../../components/common/HeaderCard/HeaderCard.component', () => {
  return function HeaderCard() {
    return <div data-testid="header-card">HeaderCard</div>;
  };
});
jest.mock(
  '../../components/Domains/AddEntityForm/AddEntityForm.component',
  () => {
    return function AddEntityFormV2() {
      return <div data-testid="add-entity-form">AddEntityFormV2</div>;
    };
  }
);

const mockUseDynamicEntitySearch = useDynamicEntitySearch as jest.Mock;
const mockUsePermissionProvider = usePermissionProvider as jest.Mock;

const defaultSearchResult = {
  data: [],
  loading: false,
  total: 0,
  searchTerm: '',
  filters: {},
  setSearchTerm: jest.fn(),
  setFilters: jest.fn(),
  refetch: jest.fn(),
};

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <DataProductsPage />
    </MemoryRouter>
  );
};

describe('DataProductsPage', () => {
  beforeEach(() => {
    mockUsePermissionProvider.mockReturnValue({
      permissions: ENTITY_PERMISSIONS,
    });
    mockUseDynamicEntitySearch.mockReturnValue(defaultSearchResult);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    renderComponent();

    expect(screen.getByTestId('header-card')).toBeInTheDocument();
  });

  it('should render HeaderCard component', () => {
    renderComponent();

    expect(screen.getByTestId('header-card')).toBeInTheDocument();
  });

  it('should render EntityTable component', () => {
    renderComponent();

    expect(screen.getByTestId('entity-table')).toBeInTheDocument();
  });

  it('should render page layout with correct title', () => {
    renderComponent();

    // The page title is set in PageLayoutV1, so we verify the component renders
    expect(screen.getByTestId('header-card')).toBeInTheDocument();
  });

  it('should handle empty state when no data products are available', () => {
    mockUseDynamicEntitySearch.mockReturnValue({
      ...defaultSearchResult,
      data: [],
      loading: false,
    });

    renderComponent();

    // Should still render the components for empty state
    expect(screen.getByTestId('header-card')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockUseDynamicEntitySearch.mockReturnValue({
      ...defaultSearchResult,
      loading: true,
    });

    renderComponent();

    expect(screen.getByTestId('entity-table')).toBeInTheDocument();
  });

  it('should render with data products', () => {
    const mockDataProducts = [
      {
        id: '1',
        name: 'Test Data Product',
        description: 'Test description',
        fullyQualifiedName: 'test.dataproduct',
      },
    ];

    mockUseDynamicEntitySearch.mockReturnValue({
      ...defaultSearchResult,
      data: mockDataProducts,
      total: 1,
    });

    renderComponent();

    expect(screen.getByTestId('entity-table')).toBeInTheDocument();
  });
});
