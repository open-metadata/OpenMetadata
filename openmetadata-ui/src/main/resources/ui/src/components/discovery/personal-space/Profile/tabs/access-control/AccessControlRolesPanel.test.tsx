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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { deleteEntity } from '../../../../../../rest/miscAPI';
import { getRoles } from '../../../../../../rest/rolesAPIV1';
import AccessControlRolesPanel from './AccessControlRolesPanel';

const ROLES = [
  { id: 'role-1', name: 'DataConsumer', policies: [] },
  { id: 'role-2', name: 'DataSteward', policies: [] },
];

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  getRoles: jest.fn(),
}));

jest.mock('../../../../../../rest/miscAPI', () => ({
  deleteEntity: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => {
    const permissions = { all: { All: true } };

    return { usePermissionProvider: () => ({ permissions }) };
  }
);

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useHashPagingParams: () => ({
    page: 1,
    pageSize: 10,
    cursor: undefined,
    cursorType: undefined,
    setPage: jest.fn(),
  }),
}));

jest.mock('../../../../../Auth/AuthProviders/AuthProvider', () => ({
  useAuthProvider: () => ({ onLogoutHandler: jest.fn() }),
}));

const mockList = (roles: typeof ROLES) =>
  (getRoles as jest.Mock).mockResolvedValueOnce({
    data: roles,
    paging: { total: roles.length },
  });

const openDeletePopover = async () => {
  render(<AccessControlRolesPanel onNavigate={jest.fn()} />);
  fireEvent.click(await screen.findByTestId('delete-action-DataConsumer'));

  return screen.findByTestId('delete-role-popover');
};

describe('AccessControlRolesPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList(ROLES);
  });

  it('renders the roles list', async () => {
    render(<AccessControlRolesPanel onNavigate={jest.fn()} />);

    expect(await screen.findByTestId('role-DataConsumer')).toBeInTheDocument();
    expect(screen.getByTestId('role-DataSteward')).toBeInTheDocument();
  });

  it('opens a permanent-delete popover from the row trash button', async () => {
    const popover = await openDeletePopover();

    expect(popover).toBeInTheDocument();
    expect(screen.getByTestId('delete-role-popover-title')).toHaveTextContent(
      'label.delete-entity'
    );
    expect(
      screen.queryByTestId('delete-role-popover-hard-delete')
    ).not.toBeInTheDocument();
  });

  it('hard-deletes the role and drops its row once confirmed', async () => {
    (deleteEntity as jest.Mock).mockResolvedValueOnce({
      status: 200,
      data: {},
    });
    mockList([ROLES[1]]);
    await openDeletePopover();

    fireEvent.click(screen.getByTestId('delete-role-popover-confirm'));

    await waitFor(() =>
      expect(screen.queryByTestId('role-DataConsumer')).not.toBeInTheDocument()
    );

    expect(deleteEntity).toHaveBeenCalledWith('roles', 'role-1', false, true);
    expect(screen.getByTestId('role-DataSteward')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-role-popover')).not.toBeInTheDocument();
  });

  it('does not delete when the popover is cancelled', async () => {
    await openDeletePopover();

    fireEvent.click(screen.getByTestId('delete-role-popover-cancel'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('delete-role-popover')
      ).not.toBeInTheDocument()
    );

    expect(deleteEntity).not.toHaveBeenCalled();
    expect(screen.getByTestId('role-DataConsumer')).toBeInTheDocument();
  });

  it('keeps the popover open and the row listed when the delete fails', async () => {
    (deleteEntity as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await openDeletePopover();

    fireEvent.click(screen.getByTestId('delete-role-popover-confirm'));

    await waitFor(() => expect(deleteEntity).toHaveBeenCalled());

    expect(screen.getByTestId('delete-role-popover')).toBeInTheDocument();
    expect(screen.getByTestId('role-DataConsumer')).toBeInTheDocument();
    expect(getRoles).toHaveBeenCalledTimes(1);
  });
});
