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

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { User } from '../../../../../../generated/entity/teams/user';
import { renderWithQueryClient } from '../../../../../../test/unit/test-utils';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import type { MembersUserDetailView, UserDetailTab } from './Members.types';
import { useMembersUserDetailHeader } from './useMembersUserDetailHeader';

const mockGetTaskById = jest.fn();
const mockCounts: Record<string, number | undefined> = {};

jest.mock('../../../../../../rest/tasksAPI', () => ({
  getTaskById: (...args: unknown[]) => mockGetTaskById(...args),
}));
jest.mock('../../../InboxPage/useInboxActivity', () => ({
  useUserActivityCount: () => mockCounts.activity,
}));
jest.mock('../../../InboxPage/useUserTasks', () => ({
  useUserOpenTaskCount: () => mockCounts.tasks,
}));
let mockCurrentUserName = 'admin';

jest.mock('../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { name: mockCurrentUserName } }),
}));
jest.mock('../../../UserAssets/useUserAssetCount', () => ({
  useUserAssetCount: (_user: unknown, kind: string) => mockCounts[kind],
}));

const ALICE = {
  id: 'u-alice',
  name: 'alice',
  displayName: 'Alice Johnson',
  email: 'alice@acme.io',
} as User;

interface HarnessProps {
  user?: User;
  hasLoadFailed?: boolean;
  view?: Partial<MembersUserDetailView>;
  activeTab?: UserDetailTab;
  canDelete?: boolean;
  hiddenTabs?: ReadonlySet<UserDetailTab>;
  onTabChange?: jest.Mock;
  onDelete?: jest.Mock;
  onSetHeader?: jest.Mock;
}

// Renders the header slots the hook pushes up, like MembersPanel does. Props
// are frozen on mount: the hook re-pushes on every new view/callback ref, so
// fresh objects per render would loop through setHeader.
const Harness = (props: HarnessProps) => {
  const [header, setHeader] = useState<Partial<ProfileHeaderOverride>>();
  const [params] = useState(() => {
    const activeTab = props.activeTab ?? 'overview';

    return {
      user: 'user' in props ? props.user : ALICE,
      hasLoadFailed: props.hasLoadFailed ?? false,
      view: {
        type: 'user-detail' as const,
        name: 'alice',
        tab: activeTab,
        ...props.view,
      },
      activeTab,
      canDelete: props.canDelete ?? true,
      hiddenTabs: props.hiddenTabs ?? new Set<UserDetailTab>(),
      onTabChange: props.onTabChange ?? jest.fn(),
      onDelete: props.onDelete ?? jest.fn(),
      onSetHeader: props.onSetHeader ?? setHeader,
    };
  });

  useMembersUserDetailHeader(params);

  return (
    <>
      <div data-testid="header-title">{header?.title}</div>
      <div data-testid="header-description">{header?.description}</div>
      <div data-testid="header-compact">{String(Boolean(header?.compact))}</div>
      <div data-testid="header-crumbs">
        {header?.breadcrumbs?.map((crumb) => crumb.label).join(' > ')}
      </div>
      <div data-testid="header-suffix">{header?.titleSuffix}</div>
      {header?.iconNode}
      {header?.actions}
      {header?.tabs}
    </>
  );
};

const renderHeader = (props: HarnessProps = {}) =>
  renderWithQueryClient(<Harness {...props} />);

describe('useMembersUserDetailHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUserName = 'admin';
    Object.assign(mockCounts, {
      activity: 12,
      tasks: 6,
      owned: 3,
      following: 0,
    });
  });

  it('renders the user title, handle line and every tab', () => {
    renderHeader();

    expect(screen.getByTestId('header-title')).toHaveTextContent(
      'Alice Johnson'
    );
    expect(screen.getByTestId('header-description')).toHaveTextContent(
      '@alice · alice@acme.io'
    );
    expect(screen.getByTestId('user-detail-avatar')).toBeInTheDocument();

    [
      ['overview', 'label.overview'],
      ['access', 'label.access'],
      ['activity', 'label.activity'],
      ['tasks', 'label.task-plural'],
      ['owned-assets', 'label.owned-asset-plural'],
      ['following', 'label.following'],
      ['custom-properties', 'label.custom-property-plural'],
    ].forEach(([id, label]) =>
      expect(screen.getByTestId(`user-detail-tab-${id}`)).toHaveTextContent(
        label
      )
    );
  });

  it('shows the counts from the count hooks and hides zero counts', () => {
    renderHeader();

    expect(screen.getByTestId('user-detail-tab-activity')).toHaveTextContent(
      '12'
    );
    expect(screen.getByTestId('user-detail-tab-tasks')).toHaveTextContent('6');
    expect(
      screen.getByTestId('user-detail-tab-owned-assets')
    ).toHaveTextContent('3');
    expect(screen.getByTestId('user-detail-tab-following')).toHaveTextContent(
      /^label\.following$/
    );
  });

  it('leaves out every hidden tab', () => {
    renderHeader({
      hiddenTabs: new Set<UserDetailTab>(['following', 'access']),
    });

    expect(
      screen.queryByTestId('user-detail-tab-following')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('user-detail-tab-access')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('user-detail-tab-owned-assets')
    ).toBeInTheDocument();
  });

  it('calls onTabChange with the clicked tab', () => {
    const onTabChange = jest.fn();
    renderHeader({ onTabChange });

    fireEvent.click(screen.getByTestId('user-detail-tab-access'));

    expect(onTabChange).toHaveBeenCalledWith('access');
  });

  it('hides the Custom Properties tab without view access', () => {
    renderHeader({ hiddenTabs: new Set<UserDetailTab>(['custom-properties']) });

    expect(
      screen.queryByTestId('user-detail-tab-custom-properties')
    ).not.toBeInTheDocument();
  });

  it('omits the delete button when the viewer cannot delete the user', () => {
    renderHeader({ canDelete: false });

    expect(
      screen.queryByTestId('user-detail-delete-button')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('user-detail-delete-permanently-button')
    ).not.toBeInTheDocument();
  });

  it('offers a Delete button for an active user', () => {
    const onDelete = jest.fn();
    renderHeader({ onDelete });

    expect(screen.queryByTestId('user-detail-kebab')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('user-detail-delete-permanently-button')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('user-detail-delete-button'));

    expect(onDelete).toHaveBeenCalled();
  });

  it('offers only Delete permanently for a deleted user', () => {
    const onDelete = jest.fn();
    renderHeader({ user: { ...ALICE, deleted: true }, onDelete });

    expect(
      screen.queryByTestId('user-detail-delete-button')
    ).not.toBeInTheDocument();

    const button = screen.getByTestId('user-detail-delete-permanently-button');

    expect(button).toHaveAccessibleName('label.delete-permanently');

    fireEvent.click(button);

    expect(onDelete).toHaveBeenCalled();
  });

  it('marks your own entry with a You badge', () => {
    mockCurrentUserName = 'alice';
    renderHeader();

    expect(screen.getByTestId('user-you-badge')).toHaveTextContent('label.you');
  });

  it('leaves a masked email out of the handle line', () => {
    renderHeader({ user: { ...ALICE, email: '********@masked.com' } });

    expect(screen.getByTestId('header-description')).toHaveTextContent(
      /^@alice$/
    );
  });

  it.each([
    [{ isAdmin: true }, ['label.admin'], ['label.bot', 'label.deleted']],
    [{ isAdmin: true, isBot: true }, ['label.bot'], ['label.admin']],
    [{ deleted: true }, ['label.deleted'], ['label.admin', 'label.bot']],
    [{}, [], ['label.admin', 'label.bot', 'label.deleted', 'label.you']],
  ])('shows the status badges for %j', (flags, shown, hidden) => {
    renderHeader({ user: { ...ALICE, ...flags } });
    const suffix = screen.getByTestId('header-suffix');

    shown.forEach((label) =>
      expect(within(suffix).getByText(label)).toBeInTheDocument()
    );
    hidden.forEach((label) =>
      expect(within(suffix).queryByText(label)).not.toBeInTheDocument()
    );
  });

  it.each([
    [2, 'label.online-now'],
    [30, 'label.active-recently'],
  ])(
    'shows the online status for activity %i minutes ago',
    (minutesAgo, label) => {
      renderHeader({
        user: { ...ALICE, lastActivityTime: Date.now() - minutesAgo * 60000 },
      });

      expect(screen.getByTestId('user-online-status')).toHaveTextContent(label);
    }
  );

  it('hides the online status after an hour of inactivity', () => {
    renderHeader({
      user: { ...ALICE, lastActivityTime: Date.now() - 2 * 3600000 },
    });

    expect(screen.queryByTestId('user-online-status')).not.toBeInTheDocument();
  });

  it('pushes a loading header while the user is undefined', () => {
    const onSetHeader = jest.fn();
    renderHeader({ user: undefined, onSetHeader });
    const header = onSetHeader.mock.calls.at(-1)[0];

    expect(header.title).toBeUndefined();
    expect(header.titleInput).toBeDefined();
    expect(header.tabs).toBeDefined();
  });

  it('pushes a title-only header when the user is not found', () => {
    const onSetHeader = jest.fn();
    renderHeader({
      user: undefined,
      hasLoadFailed: true,
      view: { name: 'ghost' },
      onSetHeader,
    });

    expect(onSetHeader).toHaveBeenLastCalledWith({ title: 'ghost' });
  });

  it('pushes a title-only header, not the loading skeleton, when the load fails', () => {
    const onSetHeader = jest.fn();
    renderHeader({ hasLoadFailed: true, onSetHeader });

    expect(onSetHeader).toHaveBeenLastCalledWith({ title: 'alice' });
  });

  it('collapses to breadcrumbs ending in the resolved readable task id', async () => {
    mockGetTaskById.mockResolvedValue({ data: { taskId: 'TASK-00170' } });
    renderHeader({ activeTab: 'tasks', view: { taskId: 'task-uuid' } });

    expect(screen.getByTestId('header-compact')).toHaveTextContent('true');
    expect(screen.queryByTestId('user-detail-tabs')).not.toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByTestId('header-crumbs')).toHaveTextContent(
        /alice > label\.task-plural > TASK-00170$/
      )
    );

    expect(mockGetTaskById).toHaveBeenCalledWith('task-uuid');
  });

  it('uses an already readable task id without fetching', () => {
    renderHeader({ activeTab: 'tasks', view: { taskId: 'TASK-00042' } });

    expect(screen.getByTestId('header-crumbs')).toHaveTextContent(
      /TASK-00042$/
    );
    expect(mockGetTaskById).not.toHaveBeenCalled();
  });

  it('clears the header on unmount', () => {
    const onSetHeader = jest.fn();
    const { unmount } = renderHeader({ onSetHeader });
    unmount();

    expect(onSetHeader).toHaveBeenLastCalledWith(undefined);
  });
});
