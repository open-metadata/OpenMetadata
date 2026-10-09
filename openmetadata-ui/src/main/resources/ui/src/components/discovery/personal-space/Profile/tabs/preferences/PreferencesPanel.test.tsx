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
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../../../../../context/UntitledUIThemeProvider/theme-provider';
import localUtilClassBase from '../../../../../../utils/i18next/LocalUtilClassBase';
import { readCompactSidebarPreference } from '../../../../../platform/ai-shell/Sidebar/useSidebarState';
import PreferencesPanel from './PreferencesPanel';

const mockNavigate = jest.fn();
const mockChangeLanguage = jest.fn().mockResolvedValue(undefined);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US', changeLanguage: mockChangeLanguage },
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../../../../utils/i18next/LocalUtilClassBase', () => ({
  __esModule: true,
  default: { loadLocales: jest.fn().mockResolvedValue(undefined) },
}));

const setSystemScheme = (prefersDark: boolean) => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: prefersDark,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
};

const renderPanel = () =>
  render(
    <ThemeProvider>
      <PreferencesPanel />
    </ThemeProvider>
  );

const isPressed = (id: string) =>
  screen.getByTestId(`theme-preference-${id}`).getAttribute('aria-pressed') ===
    'true' ||
  screen.getByTestId(`theme-preference-${id}`).hasAttribute('data-selected');

describe('PreferencesPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    document.documentElement.classList.remove('dark-mode');
    setSystemScheme(true);
  });

  it('starts on Light when nothing is stored, even if the system is dark', () => {
    renderPanel();

    expect(isPressed('light')).toBe(true);
    expect(document.documentElement).not.toHaveClass('dark-mode');
  });

  it('follows the system theme once System is chosen, and remembers it', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('theme-preference-system'));

    expect(localStorage.getItem('ui-theme')).toBe('system');
    expect(isPressed('system')).toBe(true);
    expect(document.documentElement).toHaveClass('dark-mode');

    fireEvent.click(screen.getByTestId('theme-preference-light'));

    expect(localStorage.getItem('ui-theme')).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark-mode');
  });

  it('shows and saves the compact sidebar preference', () => {
    localStorage.setItem('aiShell.sidebar.mainCollapsed', 'true');
    renderPanel();
    const toggle = screen
      .getByTestId('compact-sidebar-toggle')
      .querySelector('input') as HTMLInputElement;

    expect(toggle).toBeChecked();

    fireEvent.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(readCompactSidebarPreference()).toBe(false);
  });

  it('switches the language the same way the user menu does', async () => {
    renderPanel();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await act(async () => {
      await user.click(
        within(screen.getByTestId('language-preference')).getByRole('button')
      );
    });
    await act(async () => {
      await user.click(await screen.findByRole('option', { name: /FR$/ }));
    });

    expect(localUtilClassBase.loadLocales).toHaveBeenCalledWith('fr-FR');
    expect(mockChangeLanguage).toHaveBeenCalledWith('fr-FR');
    expect(mockNavigate).toHaveBeenCalledWith(0);
  });
});
