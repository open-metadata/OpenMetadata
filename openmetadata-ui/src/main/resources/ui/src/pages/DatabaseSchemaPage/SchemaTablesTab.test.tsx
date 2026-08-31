/*
 *  Copyright 2026 Collate.
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
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import SchemaTablesTab from './SchemaTablesTab';

// Regression coverage for the getDerivedPermissionFlags conversion (Task 8 Batch 10): the
// old raw `permissions.table.EditAll && !databaseSchemaDetails.deleted` read gates the
// bulk-edit-table button (getBulkEditButton). No prior test coverage existed for this file.

jest.mock('../../components/common/Table/Table', () =>
  jest.fn().mockImplementation(({ extraTableFilters }) => (
    <div data-testid="schema-tables-table">{extraTableFilters}</div>
  ))
);

jest.mock('../../components/common/DisplayName/DisplayName', () =>
  jest.fn().mockImplementation(() => <div>DisplayName</div>)
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test-service.test-schema' }),
}));

jest.mock('../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    paging: { total: 0 },
    pageSize: 15,
    showPagination: false,
    handlePagingChange: jest.fn(),
    currentPage: 1,
    handlePageSizeChange: jest.fn(),
    handlePageChange: jest.fn(),
    pagingCursor: {},
  }),
}));

jest.mock('../../hooks/useTableFilters', () => ({
  useTableFilters: jest.fn().mockReturnValue({
    filters: { showDeletedTables: false },
    setFilters: jest.fn(),
  }),
}));

jest.mock('../../rest/tableAPI', () => ({
  getTableList: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
  patchTableDetails: jest.fn(),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../utils/TableColumn.util', () => ({
  certificationTableObject: jest.fn().mockReturnValue([]),
  dataProductTableObject: jest.fn().mockReturnValue([]),
  descriptionTableObject: jest.fn().mockReturnValue([]),
  domainTableObject: jest.fn().mockReturnValue([]),
  ownerTableObject: jest.fn().mockReturnValue([]),
  tagTableObject: jest.fn().mockReturnValue([]),
  tierTableObject: jest.fn().mockReturnValue([]),
}));

// Mutable so individual tests can override without a fresh jest.mock factory — the mocked
// hooks are called more than once per render (and across re-renders), so mockReturnValueOnce
// is unreliable here (DatabaseSchemaTable.test.tsx precedent).
let mockPermissionsTable = { ViewAll: true, ViewBasic: true, EditAll: true };

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: { table: mockPermissionsTable },
  })),
}));

const baseDatabaseSchemaDetails: Partial<DatabaseSchema> = {
  id: 'schema-id',
  name: 'test-schema',
  fullyQualifiedName: 'test-service.test-schema',
  deleted: false,
};

let mockDatabaseSchemaDetails: Partial<DatabaseSchema> = {
  ...baseDatabaseSchemaDetails,
};

jest.mock(
  '../../components/Customization/GenericProvider/GenericContext',
  () => ({
    useGenericContext: jest.fn().mockImplementation(() => ({
      data: mockDatabaseSchemaDetails,
      permissions: { ViewAll: true, ViewBasic: true },
    })),
  })
);

const renderTab = () =>
  render(
    <MemoryRouter>
      <SchemaTablesTab />
    </MemoryRouter>
  );

describe('SchemaTablesTab — permissions', () => {
  beforeEach(() => {
    mockPermissionsTable = { ViewAll: true, ViewBasic: true, EditAll: true };
    mockDatabaseSchemaDetails = { ...baseDatabaseSchemaDetails };
  });

  it('shows the bulk-edit-table button when EditAll is granted and the schema is not deleted', async () => {
    renderTab();

    expect(
      await screen.findByTestId('bulk-edit-table')
    ).toBeInTheDocument();
  });

  it('hides the bulk-edit-table button when EditAll is not granted', async () => {
    mockPermissionsTable = { ViewAll: true, ViewBasic: true, EditAll: false };

    renderTab();

    expect(await screen.findByTestId('schema-tables-table')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-edit-table')).not.toBeInTheDocument();
  });

  it('hides the bulk-edit-table button when EditAll is granted but the schema is deleted', async () => {
    mockDatabaseSchemaDetails = { ...baseDatabaseSchemaDetails, deleted: true };

    renderTab();

    expect(await screen.findByTestId('schema-tables-table')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-edit-table')).not.toBeInTheDocument();
  });
});
