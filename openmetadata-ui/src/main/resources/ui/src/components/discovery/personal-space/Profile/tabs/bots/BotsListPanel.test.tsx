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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { ProviderType } from '../../../../../../generated/entity/bot';
import { Include } from '../../../../../../generated/type/include';
import { useAuth } from '../../../../../../hooks/authHooks';
import { getBots } from '../../../../../../rest/botsAPI';
import { deleteEntity } from '../../../../../../rest/miscAPI';
import { searchQuery } from '../../../../../../rest/searchAPI';
import BotsListPanel from './BotsListPanel';

const mockUpdateParams = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: { tab: 'bots', subPath: '', params: {} },
    updateParams: mockUpdateParams,
  }),
}));

jest.mock('../../../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: () => ({ getResourceLimit: jest.fn() }),
}));

jest.mock('../../../../../../rest/botsAPI', () => ({
  getBots: jest.fn(),
}));

jest.mock('../../../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
}));

jest.mock('../../../../../../utils/APIUtils', () => ({
  formatUsersResponse: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../../rest/miscAPI', () => ({
  deleteEntity: jest.fn().mockResolvedValue({ status: 200, data: {} }),
}));

jest.mock('../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({ currentUser: { name: 'admin' } })),
}));

jest.mock('../../../../../Auth/AuthProviders/AuthProvider', () => ({
  useAuthProvider: jest.fn(() => ({ onLogoutHandler: jest.fn() })),
}));

jest.mock(
  '../../../../../../context/AsyncDeleteProvider/AsyncDeleteProvider',
  () => ({
    useAsyncDeleteProvider: jest.fn(() => ({
      handleOnAsyncEntityDeleteConfirm: jest.fn(),
    })),
  })
);

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityName: (entity?: { displayName?: string; name?: string }) =>
    entity?.displayName ?? entity?.name ?? '',
}));

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () => () => <div data-testid="rich-text-previewer" />
);

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Delete: () => <span />,
  NoSearch: () => <span />,
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');
  const MockTable = ({
    children,
    'data-testid': testId,
  }: React.PropsWithChildren<{ 'data-testid'?: string }>) => (
    <table data-testid={testId}>
      <tbody>{children}</tbody>
    </table>
  );
  MockTable.Header = () => null;
  MockTable.Body = ({
    children,
    items,
    renderEmptyState,
  }: {
    children: (item: unknown) => React.ReactNode;
    items: unknown[];
    renderEmptyState?: () => React.ReactNode;
  }) =>
    items && items.length
      ? items.map((item) => children(item))
      : renderEmptyState?.() ?? null;
  MockTable.Row = ({
    children,
    columns,
    ...props
  }: {
    children: (col: { id: string }) => React.ReactNode;
    columns: { id: string }[];
  } & Record<string, unknown>) => (
    <tr {...props}>{columns.map((col) => children(col))}</tr>
  );
  MockTable.Cell = ({ children }: React.PropsWithChildren) => (
    <td>{children}</td>
  );
  MockTable.Head = () => null;

  return {
    Box: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    Button: ({
      children,
      onPress,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
      'data-testid'?: string;
    }) => (
      <button data-testid={testId} type="button" onClick={onPress}>
        {children}
      </button>
    ),
    // Real ones, so the delete confirmation opens from its trigger as in the app.
    ButtonUtility: actual.ButtonUtility,
    ConfirmPopover: actual.ConfirmPopover,
    Input: ({
      onChange,
      value,
      'data-testid': testId,
    }: {
      onChange?: (v: string) => void;
      value?: string;
      'data-testid'?: string;
    }) => (
      <input
        aria-label={testId}
        data-testid={testId}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ),
    Toggle: ({
      onChange,
      isSelected,
      'data-testid': testId,
    }: {
      onChange?: (v: boolean) => void;
      isSelected?: boolean;
      'data-testid'?: string;
    }) => (
      <input
        aria-label={testId}
        checked={isSelected}
        data-testid={testId}
        type="checkbox"
        onChange={(e) => onChange?.(e.target.checked)}
      />
    ),
    Typography: ({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ),
    Skeleton: () => <div data-testid="skeleton" />,
    EmptyPlaceholder: ({
      actions,
      title,
    }: {
      actions?: { key: string; label: string; onPress: () => void }[];
      title?: string;
    }) => (
      <div data-testid="empty-placeholder">
        <span>{title}</span>
        {actions?.map((a) => (
          <button
            data-testid={a.key}
            key={a.key}
            type="button"
            onClick={a.onPress}>
            {a.label}
          </button>
        ))}
      </div>
    ),
    PaginationCardWithControls: ({
      page,
      onPageChange,
    }: {
      page: number;
      onPageChange: (p: number) => void;
    }) => (
      <div data-testid="pagination">
        <button
          aria-label="next-page"
          data-testid="next-page"
          type="button"
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    ),
    Table: MockTable,
    TableCard: {
      Root: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    },
  };
});

const NORMAL_BOT = {
  id: 'b1',
  name: 'ingest',
  displayName: 'Ingest',
  provider: ProviderType.User,
  fullyQualifiedName: 'ingest',
};

const SYSTEM_BOT = {
  id: 'b2',
  name: 'system-bot',
  provider: ProviderType.System,
  fullyQualifiedName: 'system-bot',
};

const mockOnNavigate = jest.fn();

const renderPanel = () => render(<BotsListPanel onNavigate={mockOnNavigate} />);

describe('BotsListPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ isAdminUser: true });
    (getBots as jest.Mock).mockResolvedValue({
      data: [NORMAL_BOT, SYSTEM_BOT],
      paging: { total: 2 },
    });
  });

  it('should render bots returned by getBots', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('bot-row-ingest')).toBeInTheDocument()
    );

    expect(screen.getByTestId('bot-row-system-bot')).toBeInTheDocument();
  });

  it('should navigate to detail when a bot name is clicked', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('bot-link-Ingest')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('bot-link-Ingest'));

    expect(mockOnNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'detail', fqn: 'ingest' })
    );
  });

  it('should disable delete for system bots', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('bot-delete-system-bot')).toBeInTheDocument()
    );

    expect(screen.getByTestId('bot-delete-system-bot')).toBeDisabled();
    expect(screen.getByTestId('bot-delete-ingest')).not.toBeDisabled();
  });

  it('should disable delete for non-admin users', async () => {
    (useAuth as jest.Mock).mockReturnValue({ isAdminUser: false });
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('bot-delete-ingest')).toBeInTheDocument()
    );

    expect(screen.getByTestId('bot-delete-ingest')).toBeDisabled();
  });

  it('should refetch with deleted included when the toggle is switched', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('bot-row-ingest')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('switch-deleted'));

    await waitFor(() =>
      expect(getBots).toHaveBeenCalledWith(
        expect.objectContaining({ include: Include.Deleted })
      )
    );
  });

  it('should call searchQuery when searching', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('bot-row-ingest')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: 'ingest' },
    });

    await waitFor(() => expect(searchQuery).toHaveBeenCalled());
  });

  it('should restore the bot list after clearing an in-flight search', async () => {
    let resolveSearch: (value: unknown) => void = jest.fn();
    (searchQuery as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
    );

    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('bot-row-ingest')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: 'ingest' },
    });

    await waitFor(() =>
      expect(screen.queryAllByTestId('skeleton').length).toBeGreaterThan(0)
    );

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: '' },
    });

    await act(async () => {
      resolveSearch({ hits: { hits: [] } });
    });

    await waitFor(() =>
      expect(screen.getByTestId('bot-row-ingest')).toBeInTheDocument()
    );

    expect(screen.queryAllByTestId('skeleton')).toHaveLength(0);
  });

  it('should restore the bot list after clearing a completed search', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('bot-row-ingest')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: 'ingest' },
    });

    await waitFor(() => expect(searchQuery).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: '' },
    });

    await waitFor(() =>
      expect(screen.getByTestId('bot-row-ingest')).toBeInTheDocument()
    );

    expect(screen.queryAllByTestId('skeleton')).toHaveLength(0);
  });

  it('hard-deletes a bot from the row popover and reloads the list', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('bot-delete-ingest')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('bot-delete-ingest'));

    expect(screen.getByTestId('delete-bot-popover-title')).toHaveTextContent(
      'label.delete-entity'
    );

    (getBots as jest.Mock).mockClear();
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-bot-popover-hard-delete'));
    });

    expect(deleteEntity).toHaveBeenCalledWith('bots', 'b1', false, true);

    await waitFor(() => expect(getBots).toHaveBeenCalled());

    expect(screen.queryByTestId('delete-bot-popover')).not.toBeInTheDocument();
  });

  it('keeps the row popover open when the delete fails', async () => {
    (deleteEntity as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    renderPanel();

    fireEvent.click(await screen.findByTestId('bot-delete-ingest'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-bot-popover-confirm'));
    });

    expect(deleteEntity).toHaveBeenCalledWith('bots', 'b1', false, false);
    expect(screen.getByTestId('delete-bot-popover')).toBeInTheDocument();
  });

  it('does not delete when the row popover is cancelled', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('bot-delete-ingest')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('bot-delete-ingest'));
    fireEvent.click(screen.getByTestId('delete-bot-popover-cancel'));

    expect(screen.queryByTestId('delete-bot-popover')).not.toBeInTheDocument();
    expect(deleteEntity).not.toHaveBeenCalled();
  });

  it('should show an add-bot action in the empty state', async () => {
    (getBots as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('add-bot')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('add-bot'));

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'add' });
  });

  it('clears a search with no results from the empty state', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({ hits: { hits: [] } });
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('bot-row-ingest')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: 'missing' },
    });

    await waitFor(() =>
      expect(screen.getByTestId('clear-filters')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('clear-filters'));

    await waitFor(() =>
      expect(screen.getByTestId('bot-row-ingest')).toBeInTheDocument()
    );

    expect(screen.getByTestId('searchbar')).toHaveValue('');
  });
});
