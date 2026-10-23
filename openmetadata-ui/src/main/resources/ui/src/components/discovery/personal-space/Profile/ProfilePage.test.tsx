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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { getUserPath } from '../../../../utils/RouterUtils';

let mockHashState: { tab: string | null; subPath: string; params: object } = {
  tab: null,
  subPath: '',
  params: {},
};
const mockSetHash = jest.fn();
jest.mock('hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: mockHashState,
    setHash: mockSetHash,
    clearHash: jest.fn(),
    updateParams: jest.fn(),
  }),
}));

const mockGetUserByName = jest.fn();
const mockGetLoggedInUser = jest.fn();

jest.mock('rest/userAPI', () => ({
  getUserByName: (...a: unknown[]) => mockGetUserByName(...a),
  getLoggedInUser: (...a: unknown[]) => mockGetLoggedInUser(...a),
  updateUserDetail: jest.fn(),
}));

const mockShowErrorToast = jest.fn();

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: (...a: unknown[]) => mockShowErrorToast(...a),
  showSuccessToast: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

let mockIsAdmin = false;
let mockHasCurrentUser = true;
jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: mockHasCurrentUser
      ? { id: 'u1', name: 'harsh', isAdmin: mockIsAdmin }
      : undefined,
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
jest.mock('components/common/EmptyPlaceholder/PermissionPlaceholder', () => ({
  __esModule: true,
  default: () => <div data-testid="permission-error-placeholder" />,
}));

let mockPermissions: Record<string, unknown> = {};
let mockIsPermissionsLoading = false;
jest.mock('context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: mockPermissions,
    isPermissionsLoading: mockIsPermissionsLoading,
  }),
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
    mockIsPermissionsLoading = false;
    mockIsAdmin = false;
    mockHasCurrentUser = true;
    mockGetUserByName.mockResolvedValue({ id: 'u1', name: 'harsh' });
    mockGetLoggedInUser.mockResolvedValue({ id: 'u1', name: 'harsh' });
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

  it('refreshes your own data from the logged-in user endpoint, which never masks your email', async () => {
    await act(async () => {
      render(<ProfilePage />);
    });

    expect(mockGetLoggedInUser).toHaveBeenCalled();
    expect(mockGetUserByName).not.toHaveBeenCalled();
  });

  it('loads only the logged-in user even when the hash names someone else', async () => {
    mockHashState = { tab: 'profile', subPath: 'jane', params: {} };

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(mockGetLoggedInUser).toHaveBeenCalled();
    expect(mockGetUserByName).not.toHaveBeenCalled();
  });

  it("redirects an admin's legacy #profile/<other user> link to that user's edit form", async () => {
    mockIsAdmin = true;
    mockHashState = { tab: 'profile', subPath: 'jane%40acme.io', params: {} };

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(mockSetHash).toHaveBeenCalledWith(
      'members',
      `user/${encodeURIComponent('jane@acme.io')}`
    );
  });

  it("sends a non-admin's legacy #profile/<other user> link to the read-only user page, not Members", async () => {
    mockHashState = { tab: 'profile', subPath: 'jane%40acme.io', params: {} };

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(mockNavigate).toHaveBeenCalledWith(getUserPath('jane@acme.io'), {
      replace: true,
    });
    expect(mockSetHash).not.toHaveBeenCalledWith('members', expect.anything());
  });

  it('collapses a legacy #profile/<own name> link to #profile', async () => {
    mockHashState = { tab: 'profile', subPath: 'harsh', params: {} };

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(mockSetHash).toHaveBeenCalledWith('profile');
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

  it('waits for the current user before redirecting a legacy #profile/<name> link', async () => {
    mockHasCurrentUser = false;
    mockHashState = { tab: 'profile', subPath: 'jane', params: {} };

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSetHash).not.toHaveBeenCalledWith('members', expect.anything());
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

  it('waits on the loader while permissions are still loading', async () => {
    mockIsPermissionsLoading = true;
    mockHashState = { tab: 'members', subPath: '', params: {} };

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(
      screen.queryByTestId('permission-error-placeholder')
    ).not.toBeInTheDocument();
  });

  // PermissionProvider finishes loading even when its request fails, leaving
  // the map empty: that is a loaded result, so a non-admin opening `#members`
  // gets no-access instead of a loader that never finishes.
  it('shows no-access, not the loader, once a failed permissions load leaves them empty', async () => {
    mockHashState = { tab: 'members', subPath: '', params: {} };

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
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
