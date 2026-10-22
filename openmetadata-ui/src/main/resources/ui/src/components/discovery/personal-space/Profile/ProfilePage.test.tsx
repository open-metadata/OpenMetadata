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

// Content leaf components mounted by the nav registry. The profile tab echoes
// the resolved user's display name so tests can assert which user loaded.
jest.mock('./ProfileTabPanel', () => ({
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
jest.mock('./tabs/notification/NotificationPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="content-notification" />,
}));
// "My Connections" is no longer built in — a plugin contributes it through the
// `profile.tabs` extension point, so the page is exercised with one such tab.
const mockGetContributions = jest.fn();

jest.mock(
  '../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      extensionRegistry: { getContributions: mockGetContributions },
    }),
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
    mockGetUserByName.mockResolvedValue({ id: 'u1', name: 'harsh' });
    mockGetContributions.mockReturnValue([myConnectionsContribution]);
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

  it('shows a toast on a non-404 profile fetch error', async () => {
    mockGetUserByName.mockRejectedValue({ response: { status: 500 } });

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(mockShowErrorToast).toHaveBeenCalled();
    expect(screen.queryByTestId('empty-placeholder')).not.toBeInTheDocument();
  });

  it('loads the signed-in user for the nav even when the hash names another user', async () => {
    mockHashState = { tab: 'profile', subPath: 'jane', params: {} };

    await act(async () => {
      render(<ProfilePage />);
    });

    expect(mockGetUserByName).toHaveBeenCalledTimes(1);
    expect(mockGetUserByName).toHaveBeenCalledWith('harsh', expect.any(Object));
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

    expect(mockSetHash).toHaveBeenCalledWith('profile', 'harsh');
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
});
