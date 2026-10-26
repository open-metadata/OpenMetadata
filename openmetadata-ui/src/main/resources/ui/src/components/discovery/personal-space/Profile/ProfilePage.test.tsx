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
  getLoggedInUser: (...a: unknown[]) => mockGetLoggedInUser(...a),
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

// Content leaf components mounted by the nav registry. The profile tab echoes
// the resolved user's display name so tests can assert which user loaded.
jest.mock('./ProfileTabPanel', () => ({
  __esModule: true,
  default: ({
    userData,
    loadError,
  }: {
    userData?: { displayName?: string };
    loadError?: boolean;
  }) => (
    <div
      data-load-error={String(Boolean(loadError))}
      data-testid="content-profile">
      {userData?.displayName}
    </div>
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

  it('shows a toast on a non-404 profile fetch error', async () => {
    mockGetLoggedInUser.mockRejectedValue({ response: { status: 500 } });

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(mockShowErrorToast).toHaveBeenCalled();
    expect(screen.queryByTestId('empty-placeholder')).not.toBeInTheDocument();
    // The panel gets the failure, so it won't edit the partial store copy.
    expect(screen.getByTestId('content-profile')).toHaveAttribute(
      'data-load-error',
      'true'
    );
  });

  it('loads the signed-in user for the nav even when the hash names another user', async () => {
    mockHashState = { tab: 'profile', subPath: 'jane', params: {} };

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(mockGetLoggedInUser).toHaveBeenCalledTimes(1);
    expect(mockGetUserByName).not.toHaveBeenCalled();
  });

  it('passes the username and logged-in flag to contributed tabs', async () => {
    const condition = jest.fn().mockReturnValue(true);
    mockGetContributions.mockReturnValue([
      { ...myConnectionsContribution, condition },
    ]);

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(condition).toHaveBeenLastCalledWith(
      expect.objectContaining({ isLoggedInUser: true, username: 'harsh' })
    );
  });

  it('returns to your own profile when Profile is clicked on another user', async () => {
    mockHashState = { tab: 'profile', subPath: 'jane', params: {} };

    await act(async () => {
      render(<ProfilePage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('profile-nav-profile'));
    });

    expect(mockSetHash).toHaveBeenCalledWith('profile');
  });

  it('ignores a click on Profile while already on your own profile', async () => {
    mockHashState = { tab: 'profile', subPath: 'harsh', params: {} };

    await act(async () => {
      render(<ProfilePage />);
    });

    fireEvent.click(screen.getByTestId('profile-nav-profile'));

    expect(mockSetHash).not.toHaveBeenCalled();
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

  // Your entry in a user detail (Members, or #profile/<you>/<tab>) saves through
  // its own copy; coming back to Profile must show what was saved there.
  it('re-reads your profile when you come back to it, without a reload state', async () => {
    mockGetLoggedInUser.mockResolvedValueOnce({
      id: 'u1',
      name: 'harsh',
      displayName: 'Before',
    });
    await act(async () => {
      render(<ProfilePage />);
    });

    expect(screen.getByTestId('content-profile')).toHaveTextContent('Before');

    await act(async () => {
      fireEvent.click(screen.getByTestId('profile-nav-permissions'));
    });
    mockGetLoggedInUser.mockResolvedValueOnce({
      id: 'u1',
      name: 'harsh',
      displayName: 'After',
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('profile-nav-profile'));
    });

    expect(mockGetLoggedInUser).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('content-profile')).toHaveTextContent('After');
  });

  // A settings link to a role opens `#access-control/roles/<fqn>`; Access
  // Control is admin-only, so a non-admin gets no-access even with role view.
  it('shows no-access, not the profile, for a tab the user cannot see', async () => {
    mockPermissions = { role: { ViewAll: true } };
    mockHashState = {
      tab: 'access-control',
      subPath: 'roles/DataSteward',
      params: {},
    };

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('content-profile')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('profile-nav-access-control')
    ).not.toBeInTheDocument();
  });

  // User links open `#members/user/<name>`; a viewer who can see teams but not
  // users is sent on to the read-only `#profile/<name>` detail.
  it.each([
    [{ team: { ViewAll: true } }, true],
    [{ user: { ViewAll: true } }, false],
  ])(
    'redirects a Members user link for permissions %j: %s',
    async (permissions, redirects) => {
      mockPermissions = permissions;
      mockHashState = {
        tab: 'members',
        subPath: 'user/alice/tasks',
        params: {},
      };

      await act(async () => {
        render(<ProfilePage />);
      });

      if (redirects) {
        expect(mockSetHash).toHaveBeenCalledWith('profile', 'alice/tasks');
      } else {
        expect(mockSetHash).not.toHaveBeenCalled();
        expect(screen.getByTestId('content-members')).toBeInTheDocument();
      }
    }
  );

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
