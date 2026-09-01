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
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { OwnerLabelV2 } from './OwnerLabelV2';

// OwnerLabelV2 has no prior test file. Minimal permission-focused characterization suite
// covering the one real behavior change the conversion introduces: the old raw OR
// (`permissions?.EditOwners || permissions?.EditAll`) becomes the prioritized `canEditOwners`
// flag (explicit-deny-wins, same fix as the sanctioned canViewBasic precedent — Task 6 Finding
// 1 — and the same target flag DomainExpertWidget.tsx already converged on, Task 8 Batch 1).

let mockContext: {
  data: { id: string; owners: unknown[] };
  onUpdate: jest.Mock;
  permissions: OperationPermission;
  isVersionView: boolean;
  entityRules: {
    canAddMultipleUserOwners: boolean;
    canAddMultipleTeamOwner: boolean;
  };
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => mockContext,
}));

jest.mock(
  '../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: jest
      .fn()
      .mockImplementation(({ children }) => <>{children}</>),
  })
);

const mockGetOwnerVersionLabel = jest.fn().mockReturnValue(null);
jest.mock('../../../utils/EntityVersionUtils', () => ({
  getOwnerVersionLabel: (...args: unknown[]) =>
    mockGetOwnerVersionLabel(...args),
}));

const setMockContext = (permissionOverrides: Partial<OperationPermission>) => {
  mockContext = {
    data: { id: 'entity-1', owners: [] },
    onUpdate: jest.fn(),
    permissions: permissionOverrides as OperationPermission,
    isVersionView: false,
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  };
};

describe('OwnerLabelV2 permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOwnerVersionLabel.mockReturnValue(null);
    setMockContext(ENTITY_PERMISSIONS);
  });

  it('shows the add-owner affordance when EditOwners permission is granted', async () => {
    setMockContext({ ...ENTITY_PERMISSIONS, EditOwners: true });

    render(<OwnerLabelV2 />);

    await waitFor(() => {
      expect(screen.getByTestId('add-owner')).toBeInTheDocument();
    });
  });

  it('denies edit access when EditOwners is explicitly false, even though EditAll is true (explicit-deny-wins, prioritized over the old raw OR)', async () => {
    setMockContext({ ...ENTITY_PERMISSIONS, EditAll: true, EditOwners: false });

    render(<OwnerLabelV2 />);

    await waitFor(() => {
      expect(mockGetOwnerVersionLabel).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('add-owner')).not.toBeInTheDocument();
    expect(mockGetOwnerVersionLabel).toHaveBeenCalledWith(
      expect.anything(),
      false,
      'owners',
      false
    );
  });

  it('the explicit hasPermission prop overrides the context-derived flag', async () => {
    setMockContext({
      ...ENTITY_PERMISSIONS,
      EditOwners: false,
      EditAll: false,
    });

    render(<OwnerLabelV2 hasPermission />);

    await waitFor(() => {
      expect(screen.getByTestId('add-owner')).toBeInTheDocument();
    });
  });
});
