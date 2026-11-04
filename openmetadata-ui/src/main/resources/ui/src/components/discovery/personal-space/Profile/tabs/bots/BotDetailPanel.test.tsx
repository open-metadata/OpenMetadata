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
  within,
} from '@testing-library/react';
import React, { useState } from 'react';
import {
  getBotByName,
  restoreBot,
  updateBotDetail,
} from '../../../../../../rest/botsAPI';
import { deleteEntity } from '../../../../../../rest/miscAPI';
import {
  getAuthMechanismForBotUser,
  getUserByName,
  updateUserDetail,
} from '../../../../../../rest/userAPI';
import BotDetailPanel from './BotDetailPanel';

jest.mock('react-i18next', () => {
  // A stable t identity — the header-injection effect depends on t, so a fresh
  // t per render would re-run the effect and loop when the harness re-renders.
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('react-aria', () => ({
  ...jest.requireActual('react-aria'),
  useFilter: () => ({ contains: () => true }),
}));

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true }),
}));

// Stable like the real zustand action: the header effect keys on it.
const mockGetResourceLimit = jest.fn();

jest.mock('../../../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: () => ({ getResourceLimit: mockGetResourceLimit }),
}));

const mockPermissions = { canEditAll: true, canDelete: true };

jest.mock(
  '../../../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: () => mockPermissions,
  })
);

jest.mock('../../../../../../rest/botsAPI', () => ({
  getBotByName: jest.fn(),
  restoreBot: jest.fn().mockResolvedValue({}),
  updateBotDetail: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../rest/userAPI', () => ({
  getUserByName: jest.fn(),
  getAuthMechanismForBotUser: jest.fn().mockResolvedValue({}),
  updateUserDetail: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  searchRoles: jest.fn().mockResolvedValue([]),
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
  './BotTokenSection',
  () =>
    ({ isDisabled }: { isDisabled?: boolean }) =>
      (
        <div
          data-disabled={String(Boolean(isDisabled))}
          data-testid="bot-token-section"
        />
      )
);

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () =>
  React.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      getEditorContent: () => 'new description',
      clearEditorContent: jest.fn(),
      setEditorContent: jest.fn(),
    }));

    return <div data-testid="rich-text-editor" />;
  })
);

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () => () => <div data-testid="rich-text-previewer" />
);

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Delete: () => <span />,
  Edit: () => <span />,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Card: Object.assign(
    ({
      children,
      className,
      'data-testid': testId,
    }: {
      children?: React.ReactNode;
      className?: string;
      'data-testid'?: string;
    }) => (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    ),
    {
      Content: ({
        children,
        className,
      }: {
        children?: React.ReactNode;
        className?: string;
      }) => <div className={className}>{children}</div>,
    }
  ),
  Autocomplete: ({ 'data-testid': testId }: { 'data-testid'?: string }) => (
    <div data-testid={testId} />
  ),
  Badge: ({
    children,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    'data-testid'?: string;
  }) => <span data-testid={testId}>{children}</span>,
  Box: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  ),
  // Real ones, so the delete and restore confirmations open from their triggers as in the app.
  Button: jest.requireActual('@openmetadata/ui-core-components').Button,
  ButtonUtility: jest.requireActual('@openmetadata/ui-core-components')
    .ButtonUtility,
  ConfirmPopover: jest.requireActual('@openmetadata/ui-core-components')
    .ConfirmPopover,
  RadioButton: jest.requireActual('@openmetadata/ui-core-components')
    .RadioButton,
  RadioGroup: jest.requireActual('@openmetadata/ui-core-components').RadioGroup,
  EmptyPlaceholder: ({ title }: { title?: string }) => (
    <div data-testid="empty-placeholder">{title}</div>
  ),
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
  SelectItemType: {},
  Skeleton: () => <div data-testid="skeleton" />,
  Typography: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

const BOT = {
  id: 'bot-1',
  name: 'ingest',
  displayName: 'Ingest',
  description: 'desc',
  botUser: { id: 'u1', name: 'ingest', fullyQualifiedName: 'ingest' },
};

const USER = {
  id: 'u1',
  name: 'ingest',
  fullyQualifiedName: 'ingest',
  roles: [],
  inheritedRoles: [],
  isAdmin: false,
};

const mockOnNavigate = jest.fn();

const renderPanel = () =>
  render(<BotDetailPanel fqn="ingest" onNavigate={mockOnNavigate} />);

// Renders BotDetailPanel together with the header nodes it injects, so the
// rename/delete controls (pushed up via the onSetHeader* callbacks) are testable.
const HeaderHarness = () => {
  const [suffix, setSuffix] = useState<React.ReactNode>(null);
  const [input, setInput] = useState<React.ReactNode>(null);
  const [actions, setActions] = useState<React.ReactNode>(null);

  return (
    <>
      <BotDetailPanel
        fqn="ingest"
        onNavigate={mockOnNavigate}
        onSetHeaderActions={setActions}
        onSetHeaderTitleInput={setInput}
        onSetHeaderTitleSuffix={setSuffix}
      />
      <div data-testid="header-slot">
        {input}
        {suffix}
        {actions}
      </div>
    </>
  );
};

describe('BotDetailPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions.canEditAll = true;
    mockPermissions.canDelete = true;
    (getBotByName as jest.Mock).mockResolvedValue(BOT);
    (getUserByName as jest.Mock).mockResolvedValue(USER);
    (getAuthMechanismForBotUser as jest.Mock).mockResolvedValue({});
  });

  it('should load the bot, user and auth mechanism', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('bot-detail-container')).toBeInTheDocument()
    );

    expect(getBotByName).toHaveBeenCalledWith('ingest', expect.anything());
    expect(getUserByName).toHaveBeenCalled();
    expect(getAuthMechanismForBotUser).toHaveBeenCalledWith('u1');
    expect(screen.getByTestId('bot-token-section')).toBeInTheDocument();
  });

  it('should show an empty state when the bot cannot be loaded', async () => {
    (getBotByName as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument()
    );
  });

  it('should save the description via updateBotDetail', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('edit-description-btn')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('edit-description-btn'));

    const modal = screen.getByTestId('edit-description-modal');
    fireEvent.click(within(modal).getByText('label.save'));

    await waitFor(() =>
      expect(updateBotDetail).toHaveBeenCalledWith('bot-1', expect.anything())
    );
  });

  it('should save roles via updateUserDetail', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('edit-roles')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('edit-roles'));
    fireEvent.click(screen.getByTestId('save-roles'));

    await waitFor(() =>
      expect(updateUserDetail).toHaveBeenCalledWith('u1', expect.anything())
    );
  });

  it('should rename the bot via the injected header control', async () => {
    render(<HeaderHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('rename-bot-btn')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('rename-bot-btn'));

    const slot = screen.getByTestId('header-slot');
    await waitFor(() =>
      expect(within(slot).getByTestId('rename-input')).toBeInTheDocument()
    );

    fireEvent.click(within(slot).getByText('label.save'));

    await waitFor(() =>
      expect(updateBotDetail).toHaveBeenCalledWith('bot-1', expect.anything())
    );
  });

  it('hard-deletes the bot from the header popover and returns to the list', async () => {
    render(<HeaderHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('delete-bot-btn')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('delete-bot-btn'));
    // Choose "Delete permanently", then confirm.
    fireEvent.click(screen.getByTestId('delete-bot-popover-hard-delete'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-bot-popover-confirm'));
    });

    expect(deleteEntity).toHaveBeenCalledWith('bots', 'bot-1', false, true);
    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'list' });
  });

  it('keeps the header delete popover open and stays on the bot when the delete fails', async () => {
    (deleteEntity as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    render(<HeaderHarness />);

    fireEvent.click(await screen.findByTestId('delete-bot-btn'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-bot-popover-confirm'));
    });

    expect(deleteEntity).toHaveBeenCalledWith('bots', 'bot-1', false, false);
    expect(screen.getByTestId('delete-bot-popover')).toBeInTheDocument();
    expect(mockOnNavigate).not.toHaveBeenCalled();
  });

  it('does not offer delete for a system bot', async () => {
    (getBotByName as jest.Mock).mockResolvedValue({
      ...BOT,
      provider: 'system',
    });
    render(<HeaderHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('rename-bot-btn')).toBeInTheDocument()
    );

    expect(screen.queryByTestId('delete-bot-btn')).not.toBeInTheDocument();
  });

  it('shows the impersonation badge only when the bot user allows it', async () => {
    (getUserByName as jest.Mock).mockResolvedValue({
      ...USER,
      allowImpersonation: true,
    });
    render(<HeaderHarness />);

    expect(
      await screen.findByTestId('impersonation-enabled-badge')
    ).toHaveTextContent('label.impersonation-enabled');
  });

  it('restores a soft-deleted bot after confirmation', async () => {
    (getBotByName as jest.Mock).mockResolvedValue({ ...BOT, deleted: true });
    render(<HeaderHarness />);

    fireEvent.click(await screen.findByTestId('restore-bot-btn'));

    expect(screen.queryByTestId('delete-bot-btn')).not.toBeInTheDocument();
    expect(restoreBot).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('restore-bot-popover-confirm'));
    });

    expect(restoreBot).toHaveBeenCalledWith('bot-1');
    expect(getBotByName).toHaveBeenLastCalledWith(
      'ingest',
      expect.objectContaining({ include: 'all' })
    );
  });

  it('gates restore on EditAll (what PUT /bots/restore checks), not Delete', async () => {
    (getBotByName as jest.Mock).mockResolvedValue({ ...BOT, deleted: true });
    mockPermissions.canEditAll = false;
    mockPermissions.canDelete = true;
    const { unmount } = render(<HeaderHarness />);

    expect(await screen.findByTestId('restore-bot-btn')).toBeDisabled();

    unmount();
    mockPermissions.canEditAll = true;
    mockPermissions.canDelete = false;
    render(<HeaderHarness />);

    expect(await screen.findByTestId('restore-bot-btn')).toBeEnabled();
  });

  it('makes a soft-deleted bot read-only until it is restored', async () => {
    (getBotByName as jest.Mock).mockResolvedValue({ ...BOT, deleted: true });
    render(<HeaderHarness />);

    expect(await screen.findByTestId('restore-bot-btn')).toBeEnabled();
    expect(screen.queryByTestId('rename-bot-btn')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('edit-description-btn')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-roles')).not.toBeInTheDocument();
    expect(screen.getByTestId('bot-token-section')).toHaveAttribute(
      'data-disabled',
      'true'
    );
  });

  it('keeps the bot when the header delete popover is cancelled', async () => {
    render(<HeaderHarness />);

    await waitFor(() =>
      expect(screen.getByTestId('delete-bot-btn')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('delete-bot-btn'));
    fireEvent.click(screen.getByTestId('delete-bot-popover-cancel'));

    expect(screen.queryByTestId('delete-bot-popover')).not.toBeInTheDocument();
    expect(deleteEntity).not.toHaveBeenCalled();
    expect(mockOnNavigate).not.toHaveBeenCalled();
  });
});
