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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import type { MembersUserDetailView, MembersView } from './Members.types';
import MembersUserDetail from './MembersUserDetail';

const mockGetUserByName = jest.fn();
const mockRestoreUser = jest.fn();
const mockSetHash = jest.fn();
const mockGetTaskById = jest.fn();

jest.mock('rest/userAPI', () => ({
  getUserByName: (...a: unknown[]) => mockGetUserByName(...a),
  restoreUser: (...a: unknown[]) => mockRestoreUser(...a),
  updateUserDetail: jest.fn(),
}));

jest.mock('rest/tasksAPI', () => ({
  getTaskById: (...a: unknown[]) => mockGetTaskById(...a),
}));

let mockIsAdmin = true;
jest.mock('hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'me', name: 'harsh' } }),
}));

jest.mock('hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({ setHash: mockSetHash }),
}));

const mockCustomPropertyAccess = {
  canView: true,
  canEdit: true,
  isLoading: false,
};

jest.mock('../../customProperties/useUserCustomPropertyAccess', () => ({
  useUserCustomPropertyAccess: () => mockCustomPropertyAccess,
}));
jest.mock('../../customProperties/UserCustomPropertiesList', () => () => (
  <div data-testid="tab-custom-properties" />
));
jest.mock('../../ProfileDetailsPanel', () => () => (
  <div data-testid="tab-overview" />
));
jest.mock('../PermissionsTab', () => () => <div data-testid="tab-access" />);
jest.mock('../../../InboxPage/tabs/ActivityTab', () => () => (
  <div data-testid="tab-activity" />
));
jest.mock(
  '../../../InboxPage/tabs/TasksTab',
  () =>
    ({ onOpenTask }: { onOpenTask: (id: string) => void }) =>
      (
        <button data-testid="tab-tasks" onClick={() => onOpenTask('task-uuid')}>
          tasks
        </button>
      )
);
jest.mock(
  '../../../InboxPage/components/TaskDetailPage',
  () =>
    ({ taskId }: { taskId: string }) =>
      <div data-testid="task-detail-page">{taskId}</div>
);
jest.mock(
  '../../../UserAssets/UserAssetsView',
  () =>
    ({ kind }: { kind: string }) =>
      <div data-testid={`tab-assets-${kind}`} />
);
jest.mock('../../../InboxPage/useInboxActivity', () => ({
  useUserActivityCount: () => 12,
}));
jest.mock('../../../InboxPage/useUserTasks', () => ({
  useUserOpenTaskCount: () => 6,
}));
jest.mock('../../../UserAssets/useUserAssetCount', () => ({
  useUserAssetCount: (_user: unknown, kind: string) =>
    kind === 'owned' ? 3 : 0,
}));
jest.mock(
  '../../../../../common/DeleteWidget/DeleteEntityModal',
  () =>
    ({
      allowSoftDelete,
      isRecursiveDelete,
    }: {
      allowSoftDelete: boolean;
      isRecursiveDelete?: boolean;
    }) =>
      (
        <div
          data-allow-soft-delete={String(allowSoftDelete)}
          data-recursive={String(Boolean(isRecursiveDelete))}
          data-testid="delete-entity-modal"
        />
      )
);

const mockNavigate = jest.fn();

// Renders the header slots the detail pushes up next to it, and follows its
// navigation like MembersPanel does through the hash.
const Harness = ({ initial }: { initial: MembersUserDetailView }) => {
  const [view, setView] = useState(initial);
  const [header, setHeader] = useState<Partial<ProfileHeaderOverride>>();

  // Stable, like MembersPanel's hash-backed onNavigate.
  const onNavigate = useCallback((next: MembersView) => {
    mockNavigate(next);
    if (next.type === 'user-detail') {
      setView(next);
    }
  }, []);

  return (
    <>
      <div data-testid="header-title">{header?.title}</div>
      <div data-testid="header-compact">{String(Boolean(header?.compact))}</div>
      <div data-testid="header-crumbs">
        {header?.breadcrumbs?.map((crumb) => crumb.label).join(' > ')}
      </div>
      {header?.actions}
      {header?.tabs}
      <MembersUserDetail
        view={view}
        onNavigate={onNavigate}
        onSetHeader={setHeader}
      />
    </>
  );
};

const renderDetail = (view: Partial<MembersUserDetailView> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness
        initial={{
          type: 'user-detail',
          name: 'alice',
          tab: 'overview',
          ...view,
        }}
      />
    </QueryClientProvider>
  );

const ALICE = {
  id: 'u-alice',
  name: 'alice',
  displayName: 'Alice Johnson',
  email: 'alice@acme.io',
};

describe('MembersUserDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdmin = true;
    mockGetUserByName.mockResolvedValue(ALICE);
    Object.assign(mockCustomPropertyAccess, {
      canView: true,
      isLoading: false,
    });
  });

  it('shows the user in the header and switches tabs through navigation', async () => {
    renderDetail();

    expect(await screen.findByTestId('tab-overview')).toBeInTheDocument();
    expect(screen.getByTestId('header-title')).toHaveTextContent(
      'Alice Johnson'
    );
    expect(screen.getByTestId('user-detail-tab-activity')).toHaveTextContent(
      '12'
    );
    // A zero count stays hidden.
    expect(
      screen.getByTestId('user-detail-tab-following')
    ).not.toHaveTextContent('0');

    fireEvent.click(screen.getByTestId('user-detail-tab-access'));

    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'user-detail', tab: 'access' })
    );
    expect(await screen.findByTestId('tab-access')).toBeInTheDocument();
  });

  it('opens a soft-or-hard, recursive delete from the Delete button', async () => {
    renderDetail();
    await screen.findByTestId('tab-overview');

    expect(screen.queryByTestId('user-detail-kebab')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('user-detail-delete-button'));

    const modal = await screen.findByTestId('delete-entity-modal');

    expect(modal).toHaveAttribute('data-allow-soft-delete', 'true');
    expect(modal).toHaveAttribute('data-recursive', 'true');
  });

  it('offers permanent delete in the header and restore in the banner for a deleted user', async () => {
    mockGetUserByName.mockResolvedValue({ ...ALICE, deleted: true });
    mockRestoreUser.mockResolvedValue({ ...ALICE, deleted: false });
    renderDetail();

    expect(
      await screen.findByTestId('user-deleted-banner')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('user-detail-delete-button')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId('user-detail-delete-permanently-button')
    );

    expect(await screen.findByTestId('delete-entity-modal')).toHaveAttribute(
      'data-allow-soft-delete',
      'false'
    );

    fireEvent.click(screen.getByTestId('banner-restore-user'));

    await waitFor(() =>
      expect(mockRestoreUser).toHaveBeenCalledWith('u-alice')
    );
  });

  it('renders the Custom Properties tab when the viewer can see custom fields', async () => {
    renderDetail({ tab: 'custom-properties' });

    expect(
      await screen.findByTestId('tab-custom-properties')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('user-detail-tab-custom-properties')
    ).toBeInTheDocument();
  });

  it('hides Custom Properties and falls back to Overview without view access', async () => {
    mockCustomPropertyAccess.canView = false;
    renderDetail({ tab: 'custom-properties' });

    expect(await screen.findByTestId('tab-overview')).toBeInTheDocument();
    expect(
      screen.queryByTestId('user-detail-tab-custom-properties')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('tab-custom-properties')
    ).not.toBeInTheDocument();
  });

  it('keeps a non-admin off another user’s Access tab, whose debug info is admin-only', async () => {
    mockIsAdmin = false;
    renderDetail({ tab: 'access' });

    expect(await screen.findByTestId('tab-overview')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-access')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('user-detail-tab-access')
    ).not.toBeInTheDocument();
  });

  it('shows a non-admin their own Access tab', async () => {
    mockIsAdmin = false;
    mockGetUserByName.mockResolvedValue({ ...ALICE, name: 'harsh' });
    renderDetail({ name: 'harsh', tab: 'access' });

    expect(await screen.findByTestId('tab-access')).toBeInTheDocument();
  });

  it('hides the Following tab for a bot', async () => {
    mockGetUserByName.mockResolvedValue({ ...ALICE, isBot: true });
    renderDetail();

    expect(await screen.findByTestId('user-bot-banner')).toBeInTheDocument();
    expect(
      screen.queryByTestId('user-detail-tab-following')
    ).not.toBeInTheDocument();
  });

  it('lets an admin delete their own entry (legacy parity)', async () => {
    mockGetUserByName.mockResolvedValue({ ...ALICE, name: 'harsh' });
    renderDetail({ name: 'harsh' });

    expect(await screen.findByTestId('tab-overview')).toBeInTheDocument();
    expect(mockGetUserByName).toHaveBeenCalledWith('harsh', expect.anything());
    expect(screen.getByTestId('user-detail-delete-button')).toBeInTheDocument();
  });

  it('opens a task full page with a compact header ending in its readable id', async () => {
    mockGetTaskById.mockResolvedValue({ data: { taskId: 'TASK-00170' } });
    renderDetail({ tab: 'tasks' });

    fireEvent.click(await screen.findByTestId('tab-tasks'));

    expect(await screen.findByTestId('task-detail-page')).toHaveTextContent(
      'task-uuid'
    );
    expect(screen.getByTestId('header-compact')).toHaveTextContent('true');

    await waitFor(() =>
      expect(screen.getByTestId('header-crumbs')).toHaveTextContent(
        'alice > label.task-plural > TASK-00170'
      )
    );
  });
});
