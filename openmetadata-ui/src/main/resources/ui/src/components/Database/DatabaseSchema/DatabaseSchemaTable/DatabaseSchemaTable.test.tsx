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
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { DatabaseSchema } from '../../../../generated/entity/data/databaseSchema';
import { Paging } from '../../../../generated/type/paging';
import { getUsagePercentile } from '../../../../utils/TablePureUtils';
import { DatabaseSchemaTable } from './DatabaseSchemaTable';

let mockPermissions: Partial<OperationPermission> = {};
let mockIsDatabaseDeleted = false;
let mockSchemasResponse: { data: DatabaseSchema[]; paging: Paging } = {
  data: [],
  paging: { total: 0 },
};

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: { databaseSchema: mockPermissions },
  })),
}));

jest.mock('../../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn().mockImplementation(() => ({
    data: { deleted: mockIsDatabaseDeleted },
  })),
}));

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'sample_data.ecommerce_db' }),
}));

jest.mock(
  '../../../../hooks/useCustomLocation/useCustomLocation',
  () => () => ({ search: '' })
);

jest.mock('../../../../rest/databaseAPI', () => ({
  getDatabaseSchemas: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockSchemasResponse)),
  patchDatabaseSchemaDetails: jest.fn(),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../../utils/TableColumn.util', () => ({
  certificationTableObject: jest.fn().mockReturnValue([]),
  dataProductTableObject: jest.fn().mockReturnValue([]),
  descriptionTableObject: jest.fn().mockReturnValue([]),
  domainTableObject: jest.fn().mockReturnValue([]),
  ownerTableObject: jest.fn().mockReturnValue([]),
  tagTableObject: jest.fn().mockReturnValue([]),
  tierTableObject: jest.fn().mockReturnValue([]),
}));

// Mock `getUsagePercentile` to a deterministic string. The real implementation
// reaches into `t(...)` keys ("0label.ordinal-suffix-th label.pctile-lowercase"
// under the global i18n mock) which is brittle to assert on; the bug under
// test is purely about which branch the render picks (placeholder vs. real
// value), not about ordinalize's suffix logic, so the mock keeps assertions
// stable. Other TablePureUtils exports are preserved so callers in the import
// graph (e.g. through `getDerivedPermissionFlags`-adjacent helpers) keep
// working — see DatabaseSchemaTable's only direct import from the module is
// `getUsagePercentile`, verified above.
jest.mock('../../../../utils/TablePureUtils', () => ({
  ...jest.requireActual('../../../../utils/TablePureUtils'),
  getUsagePercentile: jest.fn((pctRank: number) => `PCTILE:${pctRank}`),
}));

// Task 8 Batch 3: this test suite is new (no prior coverage). RED evidence is documented
// per file in the batch report rather than committed as a separate step.
describe('DatabaseSchemaTable permission derivation', () => {
  beforeEach(() => {
    mockPermissions = {};
    mockIsDatabaseDeleted = false;
  });

  // allowEditDisplayNamePermission's raw `EditAll || EditDisplayName` -> canEditDisplayName
  // (getDerivedPermissionFlags). Documented explicit-deny-wins behavior change (Task 6
  // Finding 1 / Task 8 Batch 2 precedent): an explicit `EditDisplayName: false` now wins over
  // a bare `EditAll: true` grant, where the old raw OR granted regardless.
  describe('allowEditDisplayNamePermission (explicit-deny-wins)', () => {
    it('grants the edit-displayName affordance via EditAll when EditDisplayName is not present', async () => {
      mockPermissions = { EditAll: true };

      render(
        <MemoryRouter>
          <DatabaseSchemaTable isCustomizationPage />
        </MemoryRouter>
      );

      expect(
        await screen.findByTestId('edit-displayName-button')
      ).toBeInTheDocument();
    });

    it('denies the edit-displayName affordance when EditDisplayName is explicitly false, even with EditAll true', async () => {
      mockPermissions = { EditAll: true, EditDisplayName: false };

      render(
        <MemoryRouter>
          <DatabaseSchemaTable isCustomizationPage />
        </MemoryRouter>
      );

      await screen.findByTestId('database-databaseSchemas');

      expect(
        screen.queryByTestId('edit-displayName-button')
      ).not.toBeInTheDocument();
    });
  });

  // The bulk-edit button's raw `permissions.databaseSchema.EditAll && !isDatabaseDeleted` ->
  // canEditAll (identical mapping — deleted-gating already present in the old expression,
  // now applied via getDerivedPermissionFlags's second argument instead of a separate `&&`).
  describe('bulk-edit button (canEditAll, deleted-gated)', () => {
    it('shows the bulk-edit button when EditAll is granted and the database is not deleted', async () => {
      mockPermissions = { EditAll: true };
      mockIsDatabaseDeleted = false;

      render(
        <MemoryRouter>
          <DatabaseSchemaTable isCustomizationPage />
        </MemoryRouter>
      );

      expect(await screen.findByTestId('bulk-edit-table')).toBeInTheDocument();
    });

    it('hides the bulk-edit button when EditAll is granted but the database is deleted', async () => {
      mockPermissions = { EditAll: true };
      mockIsDatabaseDeleted = true;

      render(
        <MemoryRouter>
          <DatabaseSchemaTable isCustomizationPage />
        </MemoryRouter>
      );

      await screen.findByTestId('database-databaseSchemas');

      expect(screen.queryByTestId('bulk-edit-table')).not.toBeInTheDocument();
    });
  });

  // Regression coverage for the second buggy site: the schema-table Usage
  // column previously coerced a missing `weeklyStats.percentileRank` to 0 via
  // `?? 0` and rendered `getUsagePercentile(0)` ("0th pctile") for every row
  // whose `usageSummary` was absent. The column is already gated on
  // `viewUsagePermission` (DatabaseSchemaTable.tsx:298-318); these tests verify
  // the nil-check fix at the component level.
  describe('Usage column rendering (nil-check fix)', () => {
    const schemaNoUsage: DatabaseSchema = {
      id: 'schema-no-usage',
      name: 'schema_no_usage',
      fullyQualifiedName: 'sample_data.ecommerce_db.schema_no_usage',
    } as DatabaseSchema;

    const schemaWithRealZero: DatabaseSchema = {
      id: 'schema-real-zero',
      name: 'schema_real_zero',
      fullyQualifiedName: 'sample_data.ecommerce_db.schema_real_zero',
      usageSummary: {
        weeklyStats: { percentileRank: 0 },
        dailyStats: { percentileRank: 0 },
        monthlyStats: { percentileRank: 0 },
        date: new Date('2025-03-18'),
      },
    } as DatabaseSchema;

    beforeEach(() => {
      mockPermissions = { ViewAll: true } as Partial<OperationPermission>;
      mockIsDatabaseDeleted = false;
      mockSchemasResponse = { data: [], paging: { total: 0 } };
      (
        getUsagePercentile as jest.MockedFunction<typeof getUsagePercentile>
      ).mockClear();
    });

    it('renders NO_DATA_PLACEHOLDER (not "0th pctile") when usageSummary is undefined', async () => {
      mockSchemasResponse = {
        data: [schemaNoUsage],
        paging: { total: 1 },
      };

      render(
        <MemoryRouter>
          <DatabaseSchemaTable />
        </MemoryRouter>
      );

      await waitFor(() =>
        expect(screen.getByText(NO_DATA_PLACEHOLDER)).toBeInTheDocument()
      );

      expect(getUsagePercentile).not.toHaveBeenCalled();
    });

    it('renders PCTILE:0 (a legitimate 0th percentile) when percentileRank is 0, not the placeholder', async () => {
      mockSchemasResponse = {
        data: [schemaWithRealZero],
        paging: { total: 1 },
      };

      render(
        <MemoryRouter>
          <DatabaseSchemaTable />
        </MemoryRouter>
      );

      await waitFor(() =>
        expect(screen.getByText('PCTILE:0')).toBeInTheDocument()
      );

      expect(screen.queryByText(NO_DATA_PLACEHOLDER)).not.toBeInTheDocument();
      expect(getUsagePercentile).toHaveBeenCalledWith(0);
    });
  });
});
