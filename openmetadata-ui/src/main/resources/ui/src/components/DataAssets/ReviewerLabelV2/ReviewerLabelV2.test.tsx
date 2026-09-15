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
import { ReviewerLabelV2 } from './ReviewerLabelV2';

// ReviewerLabelV2 has no prior test file. Minimal permission-focused characterization suite
// covering the one real behavior change the conversion introduces: the old raw OR
// (`permissions.EditAll || permissions.EditReviewers`) becomes `can(Operation.EditReviewers)`
// (explicit-deny-wins, same fix as the sanctioned canViewBasic precedent — Task 6 Finding 1).
// No named `canEdit*` flag exists for EditReviewers, so `can()` is the documented escape
// hatch, not an oversight.

let mockContext: {
  data: { id: string; reviewers: unknown[] };
  onUpdate: jest.Mock;
  permissions: OperationPermission;
  isVersionView: boolean;
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
    data: { id: 'entity-1', reviewers: [] },
    onUpdate: jest.fn(),
    permissions: permissionOverrides as OperationPermission,
    isVersionView: false,
  };
};

describe('ReviewerLabelV2 permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOwnerVersionLabel.mockReturnValue(null);
    setMockContext(ENTITY_PERMISSIONS);
  });

  it('shows the add-reviewer affordance when EditReviewers permission is granted', async () => {
    setMockContext({ ...ENTITY_PERMISSIONS, EditReviewers: true });

    render(<ReviewerLabelV2 />);

    await waitFor(() => {
      expect(screen.getByTestId('Add')).toBeInTheDocument();
    });
  });

  it('denies edit access when EditReviewers is explicitly false, even though EditAll is true (explicit-deny-wins, prioritized over the old raw OR)', async () => {
    setMockContext({
      ...ENTITY_PERMISSIONS,
      EditAll: true,
      EditReviewers: false,
    });

    render(<ReviewerLabelV2 />);

    expect(screen.queryByTestId('Add')).not.toBeInTheDocument();
  });
});
