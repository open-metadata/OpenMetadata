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
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { DatabaseSchemaTable } from './DatabaseSchemaTable';

let mockPermissions: Partial<OperationPermission> = {};
let mockIsDatabaseDeleted = false;

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

jest.mock('../../../../utils/TableColumn.util', () => ({
  certificationTableObject: jest.fn().mockReturnValue([]),
  dataProductTableObject: jest.fn().mockReturnValue([]),
  descriptionTableObject: jest.fn().mockReturnValue([]),
  domainTableObject: jest.fn().mockReturnValue([]),
  ownerTableObject: jest.fn().mockReturnValue([]),
  tagTableObject: jest.fn().mockReturnValue([]),
  tierTableObject: jest.fn().mockReturnValue([]),
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
});
