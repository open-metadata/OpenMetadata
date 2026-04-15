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

import { render, screen, waitFor } from '@testing-library/react';
import { searchQuery } from '../../../rest/searchAPI';
import ServiceEntityTable from './ServiceEntityTable';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    serviceCategory: 'databaseServices',
  }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test-service' }),
}));

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () =>
  jest.fn().mockReturnValue({
    pathname: '/databaseServices/test-service/details',
    search: '',
  })
);

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      databaseService: { ViewAll: true, EditAll: true, EditDisplayName: true },
    },
  }),
}));

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    paging: { total: 0 },
    pageSize: 10,
    currentPage: 1,
    showPagination: false,
    handlePageChange: jest.fn(),
    handlePagingChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useTableFilters', () => ({
  useTableFilters: jest.fn().mockReturnValue({
    filters: { showDeletedTables: false },
    setFilters: jest.fn(),
  }),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: {
      total: { value: 2 },
      hits: [
        {
          _source: {
            id: 'db-1',
            name: 'test_db',
            displayName: 'Test DB',
            fullyQualifiedName: 'test-service.test_db',
          },
        },
        {
          _source: {
            id: 'db-2',
            name: 'prod_db',
            displayName: 'Prod DB',
            fullyQualifiedName: 'test-service.prod_db',
          },
        },
      ],
    },
  }),
}));

jest.mock('../../../utils/ServiceMainTabContentUtils', () => ({
  callServicePatchAPI: jest.fn(),
  getServiceMainTabColumns: jest.fn().mockReturnValue([
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
  ]),
}));

jest.mock('../../../utils/DatabaseSchemaDetailsUtils', () => ({
  buildSchemaQueryFilter: jest
    .fn()
    .mockReturnValue('{"query":{"bool":{"must":[]}}}'),
}));

jest.mock('../../../utils/ServiceUtils', () => ({
  getCountLabel: jest.fn().mockReturnValue('Databases'),
  getSearchIndexForService: jest.fn().mockReturnValue('database_search_index'),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/i18next/LocalUtil', () => ({
  t: jest.fn().mockImplementation((key: string) => key),
  detectBrowserLanguage: jest.fn().mockReturnValue('en-US'),
}));

describe('ServiceEntityTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render and fetch entities on mount', async () => {
    render(<ServiceEntityTable />);

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          pageNumber: 1,
          pageSize: 10,
          query: '',
          trackTotalHits: true,
          includeDeleted: false,
        })
      );
    });
  });

  it('should render the table element', async () => {
    render(<ServiceEntityTable />);

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalled();
    });

    expect(screen.getByTestId('service-children-table')).toBeInTheDocument();
  });

  it('should not fetch entities when isCustomizationPage is true', async () => {
    render(<ServiceEntityTable isCustomizationPage />);

    await waitFor(() => {
      expect(searchQuery).not.toHaveBeenCalled();
    });
  });

  it('should show deleted toggle', async () => {
    render(<ServiceEntityTable />);

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalled();
    });

    expect(screen.getByTestId('show-deleted')).toBeInTheDocument();
  });
});
