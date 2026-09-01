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

const mockGetUserByName = jest.fn();

jest.mock('rest/userAPI', () => ({
  getUserByName: (...a: unknown[]) => mockGetUserByName(...a),
  updateUserDetail: jest.fn(),
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

// Content leaf components mounted by the nav registry.
jest.mock('./ProfileDetailsPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="content-profile" />,
}));
jest.mock('./components/AccessTokenPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="content-access-token" />,
}));
jest.mock('./tabs/PermissionsTab', () => ({
  __esModule: true,
  default: () => <div data-testid="content-permissions" />,
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
