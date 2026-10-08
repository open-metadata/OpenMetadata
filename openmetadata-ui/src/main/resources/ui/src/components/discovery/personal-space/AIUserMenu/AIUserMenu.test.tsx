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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import { ThemeProvider } from '../../../../context/UntitledUIThemeProvider/theme-provider';
import AIUserMenu from './AIUserMenu';

// ─── Module mocks ────────────────────────────────────────────────────────────

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockSetHash = jest.fn();
jest.mock('../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({ setHash: mockSetHash }),
}));

const mockOpenPanel = jest.fn();
jest.mock('../../../../hooks/usePersonalSpaceStore', () => ({
  usePersonalSpaceStore: (selector: (state: unknown) => unknown) =>
    selector({ open: mockOpenPanel }),
}));

let mockActiveDomain = 'Banking';

jest.mock('../../../../hooks/useDomainStore', () => ({
  useDomainStore: () => ({
    activeDomain: mockActiveDomain,
    activeDomainEntityRef: { id: 'domain-1', name: mockActiveDomain },
  }),
}));

const salesPersona = { id: 'persona-1', name: 'sales', type: 'persona' };
const mockSetSelectedPersona = jest.fn();
const mockSetAppVersion = jest.fn();
let mockAppVersion: string | undefined = '1.0.0';

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    appVersion: mockAppVersion,
    currentUser: {
      displayName: 'Test User',
      email: 'test@example.com',
      name: 'test-user',
      personas: [salesPersona],
    },
    selectedPersona: undefined,
    setAppVersion: mockSetAppVersion,
    setSelectedPersona: mockSetSelectedPersona,
  }),
}));

const mockGetVersion = jest.fn();

jest.mock('../../../../rest/miscAPI', () => ({
  getVersion: (...args: unknown[]) => mockGetVersion(...args),
}));

jest.mock('../../../../utils/i18next/i18nextUtil', () => ({
  languageSelectOptions: [],
}));

jest.mock('../../../../utils/i18next/LocalUtil', () => ({
  __esModule: true,
  t: (k: string) => k,
  default: {
    language: 'en-US',
    changeLanguage: jest.fn(),
    t: (k: string) => k,
  },
}));

jest.mock('../../../../utils/EntityNameUtils', () => ({
  getDomainDisplayName: (ref?: { name?: string }) => ref?.name,
  getEntityName: (
    entity: { displayName?: string; name?: string } | null | undefined
  ) => entity?.displayName ?? entity?.name ?? '',
}));

jest.mock('../../../../utils/i18next/LocalUtilClassBase', () => ({
  default: { loadLocales: jest.fn() },
}));

const mockGetHelpItems = jest.fn().mockReturnValue([]);

jest.mock('../../../../utils/NavbarUtilClassBase', () => ({
  __esModule: true,
  default: { getHelpItems: (...args: unknown[]) => mockGetHelpItems(...args) },
}));

const mockOnLogoutHandler = jest.fn();
jest.mock('../../../../components/Auth/AuthProviders/AuthProvider', () => ({
  useAuthProvider: () => ({ onLogoutHandler: mockOnLogoutHandler }),
}));

jest.mock(
  '../../../../components/common/ProfilePicture/ProfilePicture',
  () => ({
    __esModule: true,
    default: ({ displayName }: { displayName?: string }) => (
      <span data-testid="profile-picture">{displayName}</span>
    ),
  })
);

// Boundary: the domain picker owns its own store, API and lazy chunk.
jest.mock('../../../common/DomainScopeControl/DomainScopeControl', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => (
    <div data-testid="ask-domain-scope">{children}</div>
  ),
}));

// Stub react-aria-components to avoid react-aria collection complexity
jest.mock('react-aria-components', () => ({
  Button: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  ),
  SubmenuTrigger: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
}));

type MockItemProps = {
  children?:
    | React.ReactNode
    | ((state: { isSelected: boolean }) => React.ReactNode);
  label?: string;
  onAction?: () => void;
  'data-testid'?: string;
};

// Stub @openmetadata/ui-core-components to avoid complex setup
jest.mock('@openmetadata/ui-core-components', () => ({
  Avatar: ({ initials }: { initials: string }) => <span>{initials}</span>,
  Box: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Dropdown: {
    Root: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Popover: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Menu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Section: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    SectionHeader: ({ children }: React.PropsWithChildren) => (
      <div>{children}</div>
    ),
    Item: ({
      children,
      label,
      onAction,
      'data-testid': testId,
    }: MockItemProps) => (
      <button data-testid={testId} type="button" onClick={onAction}>
        {label ??
          (typeof children === 'function'
            ? children({ isSelected: false })
            : children)}
      </button>
    ),
    Separator: () => <hr />,
  },
  FeaturedIcon: () => <span />,
  Tooltip: ({
    children,
    isDisabled,
    title,
  }: React.PropsWithChildren<{
    isDisabled?: boolean;
    title?: React.ReactNode;
  }>) => (
    <div data-testid={isDisabled ? undefined : 'trigger-tooltip'}>
      {!isDisabled && title}
      {children}
    </div>
  ),
  Typography: ({ children }: React.PropsWithChildren) => (
    <span>{children}</span>
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const renderMenu = (collapsed?: boolean) =>
  render(
    <MemoryRouter>
      <ThemeProvider>
        <AIUserMenu collapsed={collapsed} />
      </ThemeProvider>
    </MemoryRouter>
  );

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AIUserMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    document.documentElement.classList.remove('dark-mode');
    mockAppVersion = '1.0.0';
    mockActiveDomain = 'Banking';
    mockGetHelpItems.mockReturnValue([]);
  });

  it('shows the user name and active domain on the expanded trigger', () => {
    renderMenu();

    const trigger = screen.getByTestId('ask-ai-user-menu-trigger');

    expect(trigger).toHaveTextContent('Test User');
    expect(trigger).toHaveTextContent('Banking');
  });

  it('shows only the avatar in the collapsed rail, with name and domain in a tooltip', () => {
    renderMenu(true);

    expect(
      screen.getByTestId('ask-ai-user-menu-trigger')
    ).not.toHaveTextContent('Banking');

    const tooltip = screen.getByTestId('trigger-tooltip');

    expect(tooltip).toHaveTextContent('Test User');
    expect(tooltip).toHaveTextContent('Banking');
  });

  it('badges the rail avatar only while a domain is scoped', () => {
    const { unmount } = renderMenu(true);

    expect(
      screen.getByTestId('ask-ai-user-menu-scope-badge')
    ).toBeInTheDocument();

    unmount();
    mockActiveDomain = DEFAULT_DOMAIN_VALUE;
    renderMenu(true);

    expect(
      screen.queryByTestId('ask-ai-user-menu-scope-badge')
    ).not.toBeInTheDocument();
  });

  it('shows no scope badge on the expanded trigger', () => {
    renderMenu();

    expect(
      screen.queryByTestId('ask-ai-user-menu-scope-badge')
    ).not.toBeInTheDocument();
  });

  it('routes to #profile/<username> when the profile item is clicked', () => {
    renderMenu();

    fireEvent.click(screen.getByTestId('ai-user-menu-profile'));

    expect(mockSetHash).toHaveBeenCalledWith('profile', 'test-user');
  });

  it('opens My Data in the personal-space modal', () => {
    renderMenu();

    fireEvent.click(screen.getByTestId('ai-user-menu-my-data'));

    expect(mockOpenPanel).toHaveBeenCalledWith('my-data');
  });

  it('renders the domain scope row with the active domain', () => {
    renderMenu();

    const row = screen.getByTestId('ask-domain-scope');

    expect(row).toHaveTextContent('label.domain-scope');
    expect(row).toHaveTextContent('Banking');
  });

  it('shows the default persona and switches to a picked persona', () => {
    renderMenu();

    expect(screen.getByTestId('ai-user-menu-persona')).toHaveTextContent(
      'label.default'
    );

    fireEvent.click(screen.getByTestId('ai-user-menu-persona-sales'));

    expect(mockSetSelectedPersona).toHaveBeenCalledWith(salesPersona);
  });

  it('shows the active language by name', () => {
    renderMenu();

    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('switches the theme from the appearance submenu', () => {
    renderMenu();

    expect(screen.getByTestId('ai-user-menu-appearance')).toHaveTextContent(
      'label.light'
    );

    fireEvent.click(screen.getByTestId('ai-user-menu-theme-dark'));

    expect(localStorage.getItem('ui-theme')).toBe('dark');
    expect(screen.getByTestId('ai-user-menu-appearance')).toHaveTextContent(
      'label.dark'
    );
  });

  it('navigates to /settings when the settings item is clicked', () => {
    renderMenu();

    fireEvent.click(screen.getByTestId('ask-user-menu-settings'));

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('calls onLogoutHandler when the logout item is clicked', () => {
    renderMenu();

    fireEvent.click(screen.getByTestId('ai-user-menu-logout'));

    expect(mockOnLogoutHandler).toHaveBeenCalledTimes(1);
  });

  it('does not offer an interface-mode switch', () => {
    renderMenu();

    expect(
      screen.queryByTestId('interface-mode-option-classic')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('interface-mode-option-ai')
    ).not.toBeInTheDocument();
  });

  describe('version fetch on mount', () => {
    it('calls getVersion and setAppVersion when appVersion is not in the store', async () => {
      mockAppVersion = undefined;
      mockGetVersion.mockResolvedValue({ version: '2.0.0-SNAPSHOT' });

      renderMenu();

      expect(mockGetVersion).toHaveBeenCalledTimes(1);

      await waitFor(() =>
        expect(mockSetAppVersion).toHaveBeenCalledWith('2.0.0')
      );
    });

    it('does not call getVersion when appVersion is already set', () => {
      mockAppVersion = '1.0.0';

      renderMenu();

      expect(mockGetVersion).not.toHaveBeenCalled();
    });

    it('renders the version number in the Help submenu when appVersion is set', () => {
      mockAppVersion = '2.0.0';
      mockGetHelpItems.mockReturnValue([
        {
          key: 'version',
          label: 'label.version',
          icon: null,
          isExternal: false,
          link: '',
        },
      ]);

      renderMenu();

      // t() stub returns the key; version items use 'label.version-number' key
      expect(screen.getByText('label.version-number')).toBeInTheDocument();
    });
  });
});
