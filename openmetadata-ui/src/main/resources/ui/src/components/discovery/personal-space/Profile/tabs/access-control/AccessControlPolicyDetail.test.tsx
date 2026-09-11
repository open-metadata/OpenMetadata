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
import userEvent from '@testing-library/user-event';
import React from 'react';
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
  getPolicyByName: jest.fn().mockResolvedValue(mockPolicy),
  patchPolicy: jest.fn().mockResolvedValue(mockPolicy),
}));

jest.mock('../../../../../../utils/DeleteWidget/DeleteWidgetUtils', () => ({
  hardDeleteEntity: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({
      EditAll: true,
      Delete: true,
      ViewAll: true,
    }),
  }),
}));

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

jest.mock('../../../../../common/DeleteModal/DeleteModal', () => ({
  __esModule: true,
  default: ({
    open,
    onCancel,
    onDelete,
    entityTitle,
  }: {
    open: boolean;
    onCancel: () => void;
    onDelete: () => void;
    entityTitle: string;
  }) =>
    open ? (
      <div data-testid="delete-modal">
        <span>{entityTitle}</span>
        <button data-testid="delete-confirm" onClick={onDelete}>
          Confirm
        </button>
        <button data-testid="delete-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

jest.mock('./AccessControlRuleForm', () => () => (
  <div data-testid="rule-form" />
));

import AccessControlPolicyDetail from './AccessControlPolicyDetail';

const mockOnNavigate = jest.fn();

const renderComponent = (fqn = 'TestPolicy') =>
  render(
    <MemoryRouter>
      <AccessControlPolicyDetail fqn={fqn} onNavigate={mockOnNavigate} />
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
    (getPolicyByName as jest.Mock).mockReturnValue(new Promise(() => {}));

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

  it('opens description edit modal', async () => {
    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('edit-description-btn')).toBeInTheDocument()
    );

    await userEvent.click(screen.getByTestId('edit-description-btn'));

    expect(screen.getByTestId('edit-description-modal')).toBeInTheDocument();
  });

  it('renders copy URL button', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('copy-url-btn')).toBeInTheDocument();
    });
  });

  it('renders rule in rules tab', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('rule-AllowViewRule')).toBeInTheDocument();
    });

    expect(screen.getByText('AllowViewRule')).toBeInTheDocument();
  });

  it('renders roles tab with delete action', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('policy-detail-container')).toBeInTheDocument();
    });

    // Switch to Roles tab
    await userEvent.click(screen.getByText(/Roles/i));

    await waitFor(() => {
      expect(screen.getByText('DataSteward')).toBeInTheDocument();
    });

    expect(screen.getByTestId('remove-DataSteward')).toBeInTheDocument();
  });

  it('renders teams tab with delete action', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('policy-detail-container')).toBeInTheDocument();
    });

    // Switch to Teams tab
    await userEvent.click(screen.getByText(/Teams/i));

    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    expect(screen.getByTestId('remove-Engineering')).toBeInTheDocument();
  });

  it('shows remove confirmation modal when clicking remove on a role', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('policy-detail-container')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText(/Roles/i));

    await waitFor(() => {
      expect(screen.getByTestId('remove-DataSteward')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('remove-DataSteward'));

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });
});
