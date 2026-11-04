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
import { getPolicies } from '../../../../../../rest/rolesAPIV1';
import AccessControlPoliciesPanel from './AccessControlPoliciesPanel';

const POLICIES = [
  { id: 'policy-1', name: 'DataConsumerPolicy', roles: [] },
  { id: 'policy-2', name: 'OrgPolicy', roles: [] },
];

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  getPolicies: jest.fn(),
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

const mockList = (policies: typeof POLICIES) =>
  (getPolicies as jest.Mock).mockResolvedValueOnce({
    data: policies,
    paging: { total: policies.length },
  });

const openDeletePopover = async () => {
  render(<AccessControlPoliciesPanel onNavigate={jest.fn()} />);
  fireEvent.click(
    await screen.findByTestId('delete-action-DataConsumerPolicy')
  );

  return screen.findByTestId('delete-policy-popover');
};

describe('AccessControlPoliciesPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList(POLICIES);
  });

  it('renders the policies list', async () => {
    render(<AccessControlPoliciesPanel onNavigate={jest.fn()} />);

    expect(
      await screen.findByTestId('policy-DataConsumerPolicy')
    ).toBeInTheDocument();
    expect(screen.getByTestId('policy-OrgPolicy')).toBeInTheDocument();
  });

  it('opens a permanent-delete popover from the row trash button', async () => {
    const popover = await openDeletePopover();

    expect(popover).toBeInTheDocument();
    expect(screen.getByTestId('delete-policy-popover-title')).toHaveTextContent(
      'label.delete-entity'
    );
    expect(
      screen.queryByTestId('delete-policy-popover-hard-delete')
    ).not.toBeInTheDocument();
  });

  it('hard-deletes the policy and drops its row once confirmed', async () => {
    (deleteEntity as jest.Mock).mockResolvedValueOnce({
      status: 200,
      data: {},
    });
    mockList([POLICIES[1]]);
    await openDeletePopover();

    fireEvent.click(screen.getByTestId('delete-policy-popover-confirm'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('policy-DataConsumerPolicy')
      ).not.toBeInTheDocument()
    );

    expect(deleteEntity).toHaveBeenCalledWith(
      'policies',
      'policy-1',
      false,
      true
    );
    expect(screen.getByTestId('policy-OrgPolicy')).toBeInTheDocument();
    expect(
      screen.queryByTestId('delete-policy-popover')
    ).not.toBeInTheDocument();
  });

  it('does not delete when the popover is cancelled', async () => {
    await openDeletePopover();

    fireEvent.click(screen.getByTestId('delete-policy-popover-cancel'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('delete-policy-popover')
      ).not.toBeInTheDocument()
    );

    expect(deleteEntity).not.toHaveBeenCalled();
    expect(screen.getByTestId('policy-DataConsumerPolicy')).toBeInTheDocument();
  });

  it('keeps the popover open and the row listed when the delete fails', async () => {
    (deleteEntity as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await openDeletePopover();

    fireEvent.click(screen.getByTestId('delete-policy-popover-confirm'));

    await waitFor(() => expect(deleteEntity).toHaveBeenCalled());

    expect(screen.getByTestId('delete-policy-popover')).toBeInTheDocument();
    expect(screen.getByTestId('policy-DataConsumerPolicy')).toBeInTheDocument();
    expect(getPolicies).toHaveBeenCalledTimes(1);
  });
});
