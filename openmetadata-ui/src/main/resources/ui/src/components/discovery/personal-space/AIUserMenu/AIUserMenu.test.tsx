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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
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

const mockOpenPanel = jest.fn();
jest.mock('../../../../hooks/usePersonalSpaceStore', () => ({
  usePersonalSpaceStore: (selector: (s: { open: jest.Mock }) => unknown) =>
    selector({ open: mockOpenPanel }),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    appVersion: '1.0.0',
    currentUser: {
      displayName: 'Test User',
      email: 'test@example.com',
    },
    selectedPersona: null,
    setSelectedPersona: jest.fn(),
  }),
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
  getEntityName: (
    entity: { displayName?: string; name?: string } | null | undefined
  ) => entity?.displayName ?? entity?.name ?? '',
}));

jest.mock('../../../../utils/i18next/LocalUtilClassBase', () => ({
  default: { loadLocales: jest.fn() },
}));

jest.mock('../../../../utils/NavbarUtilClassBase', () => ({
  __esModule: true,
  default: { getHelpItems: () => [] },
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
  Menu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  MenuItem: ({
    children,
    onAction,
    textValue: _textValue,
    ...rest
  }: React.PropsWithChildren<
    Record<string, unknown> & { onAction?: () => void; textValue?: string }
  >) => (
    <button
      type="button"
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      onClick={onAction}>
      {children}
    </button>
  ),
  Popover: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SubmenuTrigger: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
}));

// Stub @openmetadata/ui-core-components to avoid complex setup
jest.mock('@openmetadata/ui-core-components', () => ({
  Avatar: ({ initials }: { initials: string }) => <span>{initials}</span>,
  Box: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Dropdown: {
    Root: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Popover: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Menu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Item: ({
      children,
      onAction,
    }: React.PropsWithChildren<{ onAction?: () => void }>) => (
      <button type="button" onClick={onAction}>
        {children}
      </button>
    ),
    Separator: () => <hr />,
  },
  Toggle: ({
    isSelected,
    label,
    onChange,
  }: {
    isSelected: boolean;
    label: string;
    onChange: (isSelected: boolean) => void;
  }) => (
    <button
      aria-checked={isSelected}
      aria-label={label}
      role="switch"
      type="button"
      onClick={() => onChange(!isSelected)}
    />
  ),
  Typography: ({ children }: React.PropsWithChildren) => (
    <span>{children}</span>
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const renderMenu = () =>
  render(
    <MemoryRouter>
      <ThemeProvider defaultTheme="light">
        <AIUserMenu />
      </ThemeProvider>
    </MemoryRouter>
  );

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AIUserMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    document.documentElement.classList.remove('dark-mode');
  });

  it('renders the trigger button with the user display name', () => {
    renderMenu();

    expect(screen.getByTestId('ask-ai-user-menu-trigger')).toBeInTheDocument();
    expect(screen.getAllByText('Test User').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Default" as the persona name when no persona is selected', () => {
    renderMenu();

    expect(screen.getAllByText('Default').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the profile header menu item', () => {
    renderMenu();

    expect(screen.getByTestId('ai-user-menu-profile')).toBeInTheDocument();
  });

  it('renders all standard menu items: persona, help, language, settings, logout', () => {
    renderMenu();

    expect(screen.getByText('label.persona')).toBeInTheDocument();
    expect(screen.getByText('label.help')).toBeInTheDocument();
    expect(screen.getByText('label.language')).toBeInTheDocument();
    expect(screen.getByText('label.setting-plural')).toBeInTheDocument();
    expect(screen.getByText('label.logout')).toBeInTheDocument();
  });

  it('updates the theme without removing the user menu', () => {
    renderMenu();

    const switcher = screen.getByRole('switch', { name: 'label.dark-mode' });

    fireEvent.click(switcher);

    expect(switcher).toBeChecked();
    expect(screen.getByText('label.logout')).toBeInTheDocument();
    expect(localStorage.getItem('ui-theme')).toBe('dark');
  });

  it('navigates to /settings when the settings item is clicked', () => {
    renderMenu();

    fireEvent.click(screen.getByText('label.setting-plural'));

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('calls onLogoutHandler when the logout item is clicked', () => {
    renderMenu();

    fireEvent.click(screen.getByText('label.logout'));

    expect(mockOnLogoutHandler).toHaveBeenCalledTimes(1);
  });

  it('does not render a mode switcher submenu (interface items moved to AppModeSwitcher)', () => {
    renderMenu();

    expect(screen.queryByTestId('interface-mode-menu')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('interface-mode-option-classic')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('interface-mode-option-ai')
    ).not.toBeInTheDocument();
  });
});
