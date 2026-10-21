/*
 *  Copyright 2025 Collate.
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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';

let mockHashState: { tab: string | null; subPath: string; params: object } = {
  tab: null,
  subPath: '',
  params: {},
};
jest.mock('hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: mockHashState,
    setHash: jest.fn(),
    clearHash: jest.fn(),
    updateParams: jest.fn(),
  }),
}));

const mockGetUserByName = jest.fn();

jest.mock('rest/userAPI', () => ({
  getUserByName: (...a: unknown[]) => mockGetUserByName(...a),
  updateUserDetail: jest.fn(),
}));

const mockShowErrorToast = jest.fn();

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: (...a: unknown[]) => mockShowErrorToast(...a),
  showSuccessToast: jest.fn(),
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { id: 'u1', name: 'harsh' },
    updateCurrentUser: jest.fn(),
  }),
}));

jest.mock('components/common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock('components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: () => <div data-testid="avatar" />,
}));

// Content leaf components mounted by the nav registry. ProfileDetailsPanel
// echoes the resolved user's display name so tests can assert which user loaded
// (the header title is static and never shows the name).
jest.mock('./ProfileDetailsPanel', () => ({
  __esModule: true,
  default: ({ userData }: { userData?: { displayName?: string } }) => (
    <div data-testid="content-profile">{userData?.displayName}</div>
  ),
}));
jest.mock('./components/AccessTokenPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="content-access-token" />,
}));
jest.mock('./tabs/PermissionsTab', () => ({
  __esModule: true,
  default: () => <div data-testid="content-permissions" />,
}));
jest.mock('./tabs/members/MembersPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="content-members" />,
}));
jest.mock('components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () => ({
  __esModule: true,
  default: () => <div data-testid="permission-error-placeholder" />,
}));

let mockPermissions: Record<string, unknown> = {};
jest.mock('context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: mockPermissions }),
}));

jest.mock('./tabs/notification/NotificationPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="content-notification" />,
}));
// "My Connections" is no longer built in — a plugin contributes it through the
// `profile.tabs` extension point, so the page is exercised with one such tab.
const mockGetContributions = jest.fn();
// The provider hands out a new `getContributions` each time plugins register
// (its `contributionsVersion` bump); tests replace this to simulate that.
let mockApplicationsProvider = {
  getContributions: (id: string) => mockGetContributions(id),
  contributionsReady: true,
};

jest.mock(
  '../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => mockApplicationsProvider,
  })
);

const myConnectionsContribution = {
  key: 'my-connections',
  label: 'label.my-connection-plural',
  component: () => <div data-testid="content-my-connections" />,
};

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    className,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    className?: string;
    'data-testid'?: string;
  }) => (
    <div className={className} data-testid={testId}>
      {children}
    </div>
  ),
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  EmptyPlaceholder: ({ title }: { title?: ReactNode }) => (
    <div data-testid="empty-placeholder">{title}</div>
  ),
  FeaturedIcon: () => <span data-testid="featured-icon" />,
  Breadcrumbs: ({ items }: { items?: { id: string; label: ReactNode }[] }) => (
    <nav>
      {items?.map((i) => (
        <span key={i.id}>{i.label}</span>
      ))}
    </nav>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import ProfilePage from './ProfilePage';

describe('ProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHashState = { tab: null, subPath: '', params: {} };
    mockPermissions = {};
    mockGetUserByName.mockResolvedValue({ id: 'u1', name: 'harsh' });
    mockGetContributions.mockReturnValue([myConnectionsContribution]);
    mockApplicationsProvider = {
      getContributions: (id: string) => mockGetContributions(id),
      contributionsReady: true,
    };
  });

  it('renders the built-in and contributed nav items with the default profile content', async () => {
    await act(async () => {
      render(<ProfilePage />);
    });

    ['profile', 'permissions', 'access-token', 'my-connections'].forEach((id) =>
      expect(screen.getByTestId(`profile-nav-${id}`)).toBeInTheDocument()
    );

    // Default selection = profile content + header.
    expect(screen.getByTestId('content-profile')).toBeInTheDocument();
    expect(screen.getByTestId('profile-content-header')).toBeInTheDocument();
  });

  it('renders only the built-in nav items when nothing is contributed', async () => {
    mockGetContributions.mockReturnValue([]);

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(
      screen.queryByTestId('profile-nav-my-connections')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('profile-nav-profile')).toBeInTheDocument();
  });

  it('skips a contributed tab whose condition rejects the user', async () => {
    mockGetContributions.mockReturnValue([
      { ...myConnectionsContribution, condition: () => false },
    ]);

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(
      screen.queryByTestId('profile-nav-my-connections')
    ).not.toBeInTheDocument();
  });

  it('refreshes user data on mount', async () => {
    await act(async () => {
      render(<ProfilePage />);
    });

    expect(mockGetUserByName).toHaveBeenCalledWith('harsh', expect.any(Object));
  });

  it('shows an empty placeholder (no loader) when the profile username is unknown', async () => {
    mockHashState = { tab: 'profile', subPath: 'does-not-exist', params: {} };
    mockGetUserByName.mockRejectedValue({ response: { status: 404 } });

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    expect(screen.getByText('label.no-entity-found')).toBeInTheDocument();
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });

  it('shows a toast (not the empty placeholder) on a non-404 profile fetch error', async () => {
    mockHashState = { tab: 'profile', subPath: 'jane', params: {} };
    mockGetUserByName.mockRejectedValue({ response: { status: 500 } });

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(mockShowErrorToast).toHaveBeenCalled();
    expect(screen.queryByTestId('empty-placeholder')).not.toBeInTheDocument();
  });

  it('ignores a stale profile response when the target changes mid-flight', async () => {
    let resolveBob!: (value: unknown) => void;
    const bobPromise = new Promise((resolve) => {
      resolveBob = resolve;
    });
    mockGetUserByName.mockImplementation((name: string) =>
      name === 'bob'
        ? bobPromise
        : Promise.resolve({
            id: 'u-alice',
            name: 'alice',
            displayName: 'Alice',
          })
    );

    mockHashState = { tab: 'profile', subPath: 'bob', params: {} };
    const { rerender } = render(<ProfilePage />);

    // Switch to alice before bob's (slower) request resolves.
    mockHashState = { tab: 'profile', subPath: 'alice', params: {} };
    await act(async () => {
      rerender(<ProfilePage />);
    });

    // Now let bob resolve late — it must be discarded as stale.
    await act(async () => {
      resolveBob({ id: 'u-bob', name: 'bob', displayName: 'Bob' });
      await bobPromise;
    });

    // Alice (the later target) wins; the stale Bob response is discarded.
    const content = screen.getByTestId('content-profile');

    expect(content).toHaveTextContent('Alice');
    expect(content).not.toHaveTextContent('Bob');
  });

  it('always shows the static "Profile" header, never the user name, when viewing another user', async () => {
    mockHashState = { tab: 'profile', subPath: 'jane', params: {} };
    mockGetUserByName.mockResolvedValue({
      id: 'u2',
      name: 'jane',
      displayName: 'Jane Doe',
    });

    await act(async () => {
      render(<ProfilePage />);
    });

    const header = screen.getByTestId('profile-content-header');

    // Header title + breadcrumb stay the static nav label; the user name never
    // appears there.
    expect(within(header).getAllByText('label.profile').length).toBeGreaterThan(
      0
    );
    expect(within(header).queryByText('Jane Doe')).not.toBeInTheDocument();

    // ...but the other user's data still loaded into the content panel.
    expect(screen.getByTestId('content-profile')).toHaveTextContent('Jane Doe');
  });

  it('swaps the content panel when a nav item is clicked', async () => {
    await act(async () => {
      render(<ProfilePage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('profile-nav-permissions'));
    });

    expect(screen.getByTestId('content-permissions')).toBeInTheDocument();
    expect(screen.queryByTestId('content-profile')).not.toBeInTheDocument();
  });

  // A settings link to a team opens `#members/teams/<fqn>`; Members is
  // admin-only, so a non-admin gets no-access even with team view permission.
  it('shows no-access, not the profile, for a tab the user cannot see', async () => {
    mockPermissions = { team: { ViewAll: true }, user: { ViewAll: true } };
    mockHashState = {
      tab: 'members',
      subPath: 'teams/Engineering',
      params: {},
    };

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('content-members')).not.toBeInTheDocument();
    expect(screen.queryByTestId('content-profile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-nav-members')).not.toBeInTheDocument();
  });

  it('waits on the loader while permissions are still empty', async () => {
    mockHashState = { tab: 'members', subPath: '', params: {} };

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(
      screen.queryByTestId('permission-error-placeholder')
    ).not.toBeInTheDocument();
  });

  // A refresh on `#my-connections` (or Collate's `#billing/...`) resolves the
  // hash before plugins have registered their tabs.
  it('shows the loader, not no-access, until a deep-linked contributed tab is registered', async () => {
    mockPermissions = { table: { ViewBasic: true } };
    mockHashState = { tab: 'my-connections', subPath: '', params: {} };
    mockGetContributions.mockReturnValue([]);
    mockApplicationsProvider = {
      getContributions: (id: string) => mockGetContributions(id),
      contributionsReady: false,
    };
    const { rerender } = render(<ProfilePage />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(
      screen.queryByTestId('permission-error-placeholder')
    ).not.toBeInTheDocument();

    // Plugins register: the provider bumps its version, so `getContributions`
    // gets a new identity and the flag turns ready.
    mockGetContributions.mockReturnValue([myConnectionsContribution]);
    mockApplicationsProvider = {
      getContributions: (id: string) => mockGetContributions(id),
      contributionsReady: true,
    };
    await act(async () => {
      rerender(<ProfilePage />);
    });

    expect(screen.getByTestId('content-my-connections')).toBeInTheDocument();
    expect(
      screen.getByTestId('profile-nav-my-connections')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });
});
