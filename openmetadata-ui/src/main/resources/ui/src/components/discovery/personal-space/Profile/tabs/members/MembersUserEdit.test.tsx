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
import { act, render, screen } from '@testing-library/react';
import { OperationPermission } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../../../generated/entity/policies/policy';
import { getDerivedPermissionFlags } from '../../../../../../utils/PermissionDerivation';
import MembersUserEdit from './MembersUserEdit';

const mockGetUserByName = jest.fn();
const mockUseEntityPermissions = jest.fn();
let mockIsAdminUser = false;

jest.mock('../../../../../../rest/userAPI', () => ({
  getUserByName: (...args: unknown[]) => mockGetUserByName(...args),
  updateUserDetail: jest.fn(),
}));

jest.mock(
  '../../../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: (...args: unknown[]) =>
      mockUseEntityPermissions(...args),
  })
);

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdminUser }),
}));

jest.mock('../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { name: 'admin' } }),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/Loader/Loader', () => () => (
  <div data-testid="loader" />
));

// Each row is stubbed to expose the edit flag it receives, which is what the
// view decides; the rows' own behaviour has its own tests.
function mockRow(testId: string) {
  return (props: { canEdit?: boolean }) => (
    <div data-can-edit={String(props.canEdit)} data-testid={testId} />
  );
}

jest.mock('../../components/PreferredNameRow', () => mockRow('row-name'));
jest.mock('../../components/UserDescriptionRow', () =>
  mockRow('row-description')
);
jest.mock('../../components/UserAdminRow', () => mockRow('row-admin'));
jest.mock('../../components/DomainsRow', () => mockRow('row-domains'));
jest.mock('../../components/TeamsRow', () => mockRow('row-teams'));
jest.mock('../../components/RolesRow', () => mockRow('row-roles'));
jest.mock('../../components/PersonaRow', () => mockRow('row-persona'));

const permissionsWith = (granted: Operation[], deleted = false) => {
  const permissions = Object.fromEntries(
    granted.map((operation) => [operation, true])
  ) as unknown as OperationPermission;

  return {
    permissions,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, deleted),
  };
};

const renderView = async () => {
  await act(async () => {
    render(<MembersUserEdit name="jane" onResolveName={jest.fn()} />);
  });
};

const canEditOf = (testId: string) =>
  screen.getByTestId(testId).getAttribute('data-can-edit');

describe('MembersUserEdit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminUser = false;
    mockGetUserByName.mockResolvedValue({
      id: 'u2',
      name: 'jane',
      displayName: 'Jane Doe',
      email: 'jane@acme.io',
    });
  });

  it('shows every field as a card, editable for an admin with EditAll', async () => {
    mockIsAdminUser = true;
    mockUseEntityPermissions.mockReturnValue(
      permissionsWith([Operation.ViewAll, Operation.EditAll])
    );

    await renderView();

    expect(screen.getByTestId('user-email')).toHaveTextContent('jane@acme.io');

    [
      'row-name',
      'row-description',
      'row-admin',
      'row-domains',
      'row-teams',
      'row-roles',
      'row-persona',
    ].forEach((row) => expect(canEditOf(row)).toBe('true'));
  });

  it('lets a non-admin with EditAll edit details but not admin status or roles', async () => {
    mockUseEntityPermissions.mockReturnValue(
      permissionsWith([Operation.ViewAll, Operation.EditAll])
    );

    await renderView();

    expect(canEditOf('row-name')).toBe('true');
    expect(canEditOf('row-teams')).toBe('true');
    expect(canEditOf('row-admin')).toBe('false');
    expect(canEditOf('row-roles')).toBe('false');
  });

  it('is read-only with view access only', async () => {
    mockUseEntityPermissions.mockReturnValue(
      permissionsWith([Operation.ViewBasic])
    );

    await renderView();

    expect(canEditOf('row-name')).toBe('false');
    expect(canEditOf('row-persona')).toBe('false');
  });

  it('shows a lock placeholder without view access', async () => {
    mockUseEntityPermissions.mockReturnValue(permissionsWith([]));

    await renderView();

    expect(screen.getByTestId('user-no-access')).toBeInTheDocument();
    expect(screen.queryByTestId('members-user-edit')).not.toBeInTheDocument();
  });

  it('keeps a soft-deleted user read-only, even for an admin', async () => {
    mockIsAdminUser = true;
    mockGetUserByName.mockResolvedValue({
      id: 'u3',
      name: 'gone',
      email: 'gone@acme.io',
      deleted: true,
    });
    mockUseEntityPermissions.mockImplementation(
      (_resource: unknown, _name: unknown, options: { deleted?: boolean }) =>
        permissionsWith(
          [Operation.ViewAll, Operation.EditAll],
          Boolean(options?.deleted)
        )
    );

    await renderView();

    expect(canEditOf('row-name')).toBe('false');
    expect(canEditOf('row-admin')).toBe('false');
    expect(canEditOf('row-roles')).toBe('false');
  });

  it('shows a not-found placeholder for an unknown user', async () => {
    mockGetUserByName.mockRejectedValue({ response: { status: 404 } });
    mockUseEntityPermissions.mockReturnValue(permissionsWith([]));

    await renderView();

    expect(screen.getByTestId('user-not-found')).toBeInTheDocument();
  });

  it("keeps an admin's own admin toggle read-only so they can't demote themselves", async () => {
    mockIsAdminUser = true;
    mockGetUserByName.mockResolvedValue({
      id: 'u0',
      name: 'admin',
      email: 'admin@acme.io',
      isAdmin: true,
    });
    mockUseEntityPermissions.mockReturnValue(
      permissionsWith([Operation.ViewAll, Operation.EditAll])
    );

    await renderView();

    expect(canEditOf('row-admin')).toBe('false');
    expect(canEditOf('row-roles')).toBe('true');
  });
});
