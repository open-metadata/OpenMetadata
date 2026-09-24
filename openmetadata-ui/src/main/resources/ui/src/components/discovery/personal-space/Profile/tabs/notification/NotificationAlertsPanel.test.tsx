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

import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import NotificationAlertsPanel from './NotificationAlertsPanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Box: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  Button: jest
    .fn()
    .mockImplementation(({ children, onPress, ...props }) => (
      <button {...props} onClick={onPress}>
        {children}
      </button>
    )),
  ButtonUtility: jest.fn().mockImplementation(({ onPress, ...props }) => (
    <button {...props} onClick={onPress}>
      {props['data-testid']}
    </button>
  )),
  Typography: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
  Skeleton: jest.fn(() => <div data-testid="skeleton" />),
  EmptyPlaceholder: jest.fn(() => <div data-testid="empty-placeholder" />),
  PaginationCardWithControls: jest.fn(() => null),
  Table: Object.assign(
    jest.fn().mockImplementation(({ children, ...props }) => (
      <table {...props}>{children}</table>
    )),
    {
      Header: jest.fn().mockImplementation(({ children, columns }) => (
        <thead>
          <tr>{columns?.map((col: { id: string; label: string }) => children(col))}</tr>
        </thead>
      )),
      Head: jest.fn().mockImplementation(({ label, ...props }) => (
        <th {...props}>{label}</th>
      )),
      Body: jest
        .fn()
        .mockImplementation(({ children, items, renderEmptyState }) =>
          items?.length > 0 ? (
            <tbody>{items.map((item: Record<string, unknown>) => children(item))}</tbody>
          ) : (
            <tbody>
              <tr>
                <td>{renderEmptyState?.()}</td>
              </tr>
            </tbody>
          )
        ),
      Row: jest
        .fn()
        .mockImplementation(({ children, columns, ...props }) => (
          <tr {...props}>
            {columns?.map((col: { id: string }) => children(col))}
          </tr>
        )),
      Cell: jest
        .fn()
        .mockImplementation(({ children, ...props }) => (
          <td {...props}>{children}</td>
        )),
    }
  ),
  TableCard: {
    Root: jest
      .fn()
      .mockImplementation(({ children, ...props }) => (
        <div {...props}>{children}</div>
      )),
  },
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Delete: jest.fn(() => <span>delete-icon</span>),
  Edit: jest.fn(() => <span>edit-icon</span>),
}));

jest.mock('../../../../../../rest/alertsAPI', () => ({
  getAllAlerts: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'alert-1',
        name: 'user-alert',
        fullyQualifiedName: 'user-alert',
        provider: 'user',
        filteringRules: { resources: ['table'] },
        description: 'A user alert',
      },
    ],
    paging: { total: 1 },
  }),
  getAlertsFromName: jest.fn().mockResolvedValue({
    id: 'system-alert-id',
    name: 'ActivityFeedAlert',
    fullyQualifiedName: 'ActivityFeedAlert',
    provider: 'system',
    filteringRules: { resources: ['all'] },
    description: 'System alert',
  }),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: jest.fn().mockReturnValue({
      getEntityPermissionByFqn: jest.fn().mockResolvedValue({
        Delete: true,
        EditAll: true,
        ViewAll: true,
      }),
    }),
  })
);

jest.mock('../../../../../../utils/PermissionDerivation', () => ({
  getDerivedPermissionFlags: jest.fn().mockReturnValue({
    canEditAll: true,
  }),
}));

jest.mock('../../../../../../utils/DeleteWidget/DeleteWidgetUtils', () => ({
  hardDeleteEntity: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityName: (entity: { name?: string; displayName?: string }) =>
    entity?.displayName ?? entity?.name ?? '',
}));

jest.mock(
  '../../../../../common/DeleteModal/DeleteModal',
  () =>
    jest.fn(({ open, onDelete }) =>
      open ? (
        <div data-testid="delete-modal">
          <button data-testid="confirm-delete" onClick={onDelete}>
            confirm
          </button>
        </div>
      ) : null
    )
);

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () => jest.fn(({ markdown }) => <span>{markdown}</span>)
);

jest.mock('../../../../../../constants/constants', () => ({
  PAGE_SIZE_BASE: 10,
  PAGE_SIZE_MEDIUM: 25,
  PAGE_SIZE_LARGE: 50,
}));

describe('NotificationAlertsPanel', () => {
  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render alerts table after loading', async () => {
    await act(async () => {
      render(<NotificationAlertsPanel onNavigate={mockOnNavigate} />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('alerts-list-table')
      ).toBeInTheDocument();
    });
  });

  it('should show alert names in the table', async () => {
    await act(async () => {
      render(<NotificationAlertsPanel onNavigate={mockOnNavigate} />);
    });

    await waitFor(() => {
      expect(
        screen.getAllByTestId('alert-name').length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it('should show edit and delete buttons for user alerts', async () => {
    await act(async () => {
      render(<NotificationAlertsPanel onNavigate={mockOnNavigate} />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('alert-edit-user-alert')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('alert-delete-user-alert')
      ).toBeInTheDocument();
    });
  });

  it('should show placeholder for system alert actions', async () => {
    await act(async () => {
      render(<NotificationAlertsPanel onNavigate={mockOnNavigate} />);
    });

    await waitFor(() => {
      const dashes = screen.getAllByText('--');

      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should open delete modal when delete button is clicked', async () => {
    await act(async () => {
      render(<NotificationAlertsPanel onNavigate={mockOnNavigate} />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('alert-delete-user-alert')
      ).toBeInTheDocument();
    });

    act(() => {
      screen.getByTestId('alert-delete-user-alert').click();
    });

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });
});
