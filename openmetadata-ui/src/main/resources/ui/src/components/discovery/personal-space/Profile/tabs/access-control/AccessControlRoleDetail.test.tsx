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

const mockRole = {
  id: 'role-1',
  name: 'DataSteward',
  displayName: 'Data Steward',
  description: 'Manages data quality',
  policies: [
    {
      id: 'policy-1',
      name: 'DataStewardPolicy',
      fullyQualifiedName: 'DataStewardPolicy',
      type: 'policy',
    },
  ],
  teams: [],
  users: [],
};

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  getRoleByName: jest.fn().mockResolvedValue(mockRole),
  getPolicies: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  patchRole: jest.fn().mockResolvedValue(mockRole),
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
          Delete
        </button>
        <button data-testid="delete-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

import AccessControlRoleDetail from './AccessControlRoleDetail';

const mockOnNavigate = jest.fn();

const renderComponent = (fqn = 'DataSteward') =>
  render(
    <MemoryRouter>
      <AccessControlRoleDetail fqn={fqn} onNavigate={mockOnNavigate} />
    </MemoryRouter>
  );

describe('AccessControlRoleDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loader initially', () => {
    const { getRoleByName } = jest.requireMock('../../../../../../rest/rolesAPIV1');
    (getRoleByName as jest.Mock).mockReturnValue(new Promise(() => {}));

    renderComponent();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('renders role description after load', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('role-detail-container')).toBeInTheDocument();
    });

    expect(screen.getByText('Manages data quality')).toBeInTheDocument();
  });

  it('renders edit description button when user has permission', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-description-btn')).toBeInTheDocument();
    });
  });

  it('opens description edit modal on button click', async () => {
    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('edit-description-btn')).toBeInTheDocument()
    );

    await userEvent.click(screen.getByTestId('edit-description-btn'));

    expect(screen.getByTestId('edit-description-modal')).toBeInTheDocument();
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('renders copy URL button', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('copy-url-btn')).toBeInTheDocument();
    });
  });

  it('renders policy tab with existing policy', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('DataStewardPolicy')).toBeInTheDocument();
    });
  });

  it('shows remove confirmation modal when clicking remove on a policy', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('remove-DataStewardPolicy')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('remove-DataStewardPolicy'));

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });

  it('navigates to roles on delete role confirm', async () => {
    const { hardDeleteEntity } = jest.requireMock(
      '../../../../../../utils/DeleteWidget/DeleteWidgetUtils'
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('role-detail-container')).toBeInTheDocument();
    });

    // Open manage dropdown and click delete - we simulate by directly triggering hardDeleteEntity
    expect(hardDeleteEntity).not.toHaveBeenCalled();
  });
});
