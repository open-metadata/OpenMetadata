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
import React, { ReactNode, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

const mockPolicy = {
  id: 'policy-1',
  name: 'TestPolicy',
  displayName: 'Test Policy',
  description: 'Policy for testing',
  rules: [
    {
      name: 'AllowViewRule',
      description: 'Allow view',
      resources: ['Table'],
      operations: ['ViewAll'],
      effect: 'Allow',
    },
  ],
  roles: [
    {
      id: 'role-1',
      name: 'DataSteward',
      fullyQualifiedName: 'DataSteward',
      type: 'role',
      description: 'Data steward role',
    },
  ],
  teams: [
    {
      id: 'team-1',
      name: 'Engineering',
      fullyQualifiedName: 'Engineering',
      type: 'team',
      description: 'Engineering team',
    },
  ],
};

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  getPolicyByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockPolicy)),
  patchPolicy: jest.fn().mockImplementation(() => Promise.resolve(mockPolicy)),
  getRoleByName: jest.fn().mockResolvedValue({
    id: 'role-1',
    name: 'DataSteward',
    policies: [{ id: 'policy-1', type: 'policy' }],
  }),
  patchRole: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true }),
}));

jest.mock('../../../../../../rest/miscAPI', () => ({
  deleteEntity: jest.fn().mockResolvedValue({ status: 200, data: {} }),
}));

jest.mock('../../../../../Auth/AuthProviders/AuthProvider', () => ({
  useAuthProvider: () => ({ onLogoutHandler: jest.fn() }),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => {
    // Stable reference — a new jest.fn() on every render would change the dep
    // on every render, triggering the useEffect on every cycle (infinite loop).
    const mockGetEntityPermissionByFqn = jest.fn().mockResolvedValue({
      EditAll: true,
      Delete: true,
      ViewAll: true,
    });

    return {
      usePermissionProvider: () => ({
        getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
      }),
    };
  }
);

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/Loader/Loader', () => () => (
  <div data-testid="loader" />
));

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () =>
  React.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      getEditorContent: () => 'updated description',
      clearEditorContent: jest.fn(),
      setEditorContent: jest.fn(),
    }));

    return <div data-testid="rich-text-editor" />;
  })
);

jest.mock('./AccessControlRuleForm', () => () => (
  <div data-testid="rule-form" />
));

import AccessControlPolicyDetail from './AccessControlPolicyDetail';

const mockOnNavigate = jest.fn();

// Renders the header actions the detail injects, as the settings modal does.
const PolicyDetailWithHeader = ({ fqn }: { fqn: string }) => {
  const [actions, setActions] = useState<ReactNode>();

  return (
    <>
      {actions}
      <AccessControlPolicyDetail
        fqn={fqn}
        onNavigate={mockOnNavigate}
        onSetHeaderActions={setActions}
      />
    </>
  );
};

const renderComponent = (fqn = 'TestPolicy') =>
  render(
    <MemoryRouter>
      <PolicyDetailWithHeader fqn={fqn} />
    </MemoryRouter>
  );

describe('AccessControlPolicyDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loader initially', () => {
    const { getPolicyByName } = jest.requireMock(
      '../../../../../../rest/rolesAPIV1'
    );
    (getPolicyByName as jest.Mock).mockReturnValueOnce(new Promise(() => {}));

    renderComponent();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('renders policy description after load', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('policy-detail-container')).toBeInTheDocument();
    });

    expect(screen.getByText('Policy for testing')).toBeInTheDocument();
  });

  it('renders edit description button', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-description-btn')).toBeInTheDocument();
    });
  });

  it('renders rule in rules tab', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('rule-AllowViewRule')).toBeInTheDocument();
    });

    expect(screen.getByText('AllowViewRule')).toBeInTheDocument();
  });

  it('opens the rule page to add or edit a rule instead of an inline form', async () => {
    renderComponent();

    fireEvent.click(await screen.findByTestId('add-rule'));

    expect(mockOnNavigate).toHaveBeenLastCalledWith({
      type: 'policies-rule',
      fqn: 'TestPolicy',
      name: 'Test Policy',
    });

    fireEvent.click(screen.getByTestId('edit-rule-AllowViewRule'));

    expect(mockOnNavigate).toHaveBeenLastCalledWith({
      type: 'policies-rule',
      fqn: 'TestPolicy',
      name: 'Test Policy',
      ruleName: 'AllowViewRule',
    });
    expect(screen.queryByTestId('rule-form')).not.toBeInTheDocument();
  });

  it('permanently deletes the policy and returns to the list once the popover is confirmed', async () => {
    const { deleteEntity } = jest.requireMock('../../../../../../rest/miscAPI');
    renderComponent();

    fireEvent.click(await screen.findByTestId('delete-policy-btn'));

    expect(
      await screen.findByTestId('delete-policy-popover-title')
    ).toHaveTextContent('label.delete-entity');
    expect(
      screen.queryByTestId('delete-policy-popover-hard-delete')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('delete-policy-popover-confirm'));

    await waitFor(() =>
      expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'policies' })
    );

    expect(deleteEntity).toHaveBeenCalledWith(
      'policies',
      'policy-1',
      false,
      true
    );
  });

  it('keeps the delete popover open and stays on the policy when the delete fails', async () => {
    const { deleteEntity } = jest.requireMock('../../../../../../rest/miscAPI');
    (deleteEntity as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    renderComponent();

    fireEvent.click(await screen.findByTestId('delete-policy-btn'));
    fireEvent.click(await screen.findByTestId('delete-policy-popover-confirm'));

    await waitFor(() => expect(deleteEntity).toHaveBeenCalled());

    expect(screen.getByTestId('delete-policy-popover')).toBeInTheDocument();
    expect(mockOnNavigate).not.toHaveBeenCalled();
  });

  it('removes a role from the policy only once the popover is confirmed', async () => {
    const { patchRole } = jest.requireMock('../../../../../../rest/rolesAPIV1');
    renderComponent();

    fireEvent.click(
      await screen.findByRole('tab', { name: /label.role-plural/ })
    );
    fireEvent.click(await screen.findByTestId('remove-DataSteward'));
    fireEvent.click(await screen.findByTestId('remove-entity-popover-cancel'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('remove-entity-popover')
      ).not.toBeInTheDocument()
    );

    expect(patchRole).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('remove-DataSteward'));

    expect(
      await screen.findByTestId('remove-entity-popover-confirm')
    ).toHaveTextContent('label.remove');

    fireEvent.click(screen.getByTestId('remove-entity-popover-confirm'));

    await waitFor(() =>
      expect(patchRole).toHaveBeenCalledWith(
        [{ op: 'remove', path: '/policies/0' }],
        'role-1'
      )
    );
    await waitFor(() =>
      expect(screen.queryByTestId('remove-DataSteward')).not.toBeInTheDocument()
    );
  });

  it('keeps the remove popover open and the role listed when the removal fails', async () => {
    const { patchRole } = jest.requireMock('../../../../../../rest/rolesAPIV1');
    (patchRole as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    renderComponent();

    fireEvent.click(
      await screen.findByRole('tab', { name: /label.role-plural/ })
    );
    fireEvent.click(await screen.findByTestId('remove-DataSteward'));
    fireEvent.click(await screen.findByTestId('remove-entity-popover-confirm'));

    await waitFor(() => expect(patchRole).toHaveBeenCalled());

    expect(screen.getByTestId('remove-entity-popover')).toBeInTheDocument();
    expect(screen.getByTestId('remove-DataSteward')).toBeInTheDocument();
  });
});
