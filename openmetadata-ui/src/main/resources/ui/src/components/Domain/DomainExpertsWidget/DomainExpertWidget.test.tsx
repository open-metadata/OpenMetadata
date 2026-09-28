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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Domain } from '../../../generated/entity/domains/domain';
import { MOCK_DOMAIN } from '../../../mocks/Domains.mock';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { DomainExpertWidget } from './DomainExpertWidget';

const MOCK_EXPERTS: Domain['experts'] = [
  { id: 'expert-1', type: 'user', name: 'expert.one' },
];

// DomainExpertWidget has no prior test file (Task 8 Batch 1 — DomainDetails permission
// group). Characterization tests written directly against the converted
// (getDerivedPermissionFlags-based) component; RED/GREEN evidence against the pre-conversion
// `permissions && getPrioritizedEditPermission(...)` / raw `permissions?.EditAll` shape is
// recorded in task-8B1-report.md rather than re-derived here (this file did not exist before
// the conversion, so there is no pre-conversion version of this exact test to run).

const mockOnUpdate = jest.fn();

let mockContext: {
  data: Domain;
  permissions: OperationPermission;
  onUpdate: jest.Mock;
  isVersionView: boolean;
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => mockContext,
}));

jest.mock(
  '../../common/UserSelectableList/UserSelectableList.component',
  () => ({
    UserSelectableList: jest
      .fn()
      .mockImplementation(({ children }) => <>{children}</>),
  })
);

const mockGetOwnerVersionLabel = jest.fn().mockReturnValue(null);
jest.mock('../../../utils/EntityVersionUtils', () => ({
  getOwnerVersionLabel: (...args: unknown[]) =>
    mockGetOwnerVersionLabel(...args),
}));

const setMockContext = (
  permissionOverrides: Partial<OperationPermission>,
  domainOverrides: Partial<Domain> = {}
) => {
  mockContext = {
    data: { ...MOCK_DOMAIN, ...domainOverrides } as Domain,
    permissions: permissionOverrides as OperationPermission,
    onUpdate: mockOnUpdate,
    isVersionView: false,
  };
};

describe('DomainExpertWidget permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOwnerVersionLabel.mockReturnValue(null);
    setMockContext(ENTITY_PERMISSIONS);
  });

  it('shows the add-expert affordance when EditOwners permission is granted', async () => {
    setMockContext({ ...ENTITY_PERMISSIONS, EditOwners: true });

    render(<DomainExpertWidget />);

    await waitFor(() => {
      expect(screen.getByTestId('Add')).toBeInTheDocument();
    });
  });

  it('hides the add-expert affordance when EditOwners permission is denied', async () => {
    setMockContext({ ...ENTITY_PERMISSIONS, EditOwners: false });

    render(<DomainExpertWidget />);

    await waitFor(() => {
      expect(screen.queryByTestId('Add')).not.toBeInTheDocument();
    });
  });

  it('passes canEditAll (from raw EditAll) as hasPermission to getOwnerVersionLabel', async () => {
    setMockContext(
      { ...ENTITY_PERMISSIONS, EditAll: true },
      { experts: MOCK_EXPERTS }
    );

    render(<DomainExpertWidget />);

    await waitFor(() => {
      expect(mockGetOwnerVersionLabel).toHaveBeenCalledWith(
        expect.anything(),
        false,
        'experts',
        true
      );
    });
  });

  it('passes hasPermission=false to getOwnerVersionLabel when EditAll is denied', async () => {
    setMockContext(
      { ...ENTITY_PERMISSIONS, EditAll: false },
      { experts: MOCK_EXPERTS }
    );

    render(<DomainExpertWidget />);

    await waitFor(() => {
      expect(mockGetOwnerVersionLabel).toHaveBeenCalledWith(
        expect.anything(),
        false,
        'experts',
        false
      );
    });
  });
});
