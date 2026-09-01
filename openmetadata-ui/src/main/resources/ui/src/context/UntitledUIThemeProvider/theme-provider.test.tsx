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
import { ThemeProvider, useTheme } from './theme-provider';

const ThemeProbe = () => {
  const { setTheme, theme } = useTheme();

  return (
    <>
      <span data-testid="active-theme">{theme}</span>
      <button type="button" onClick={() => setTheme('dark')}>
        Use dark theme
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        Use light theme
      </button>
    </>
  );
};

const renderProvider = () =>
  render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>
  );

const setSystemTheme = (theme: 'light' | 'dark') => {
  window.matchMedia = jest
    .fn()
    .mockReturnValue({ matches: theme === 'dark' } as MediaQueryList);
};

describe('ThemeProvider', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark-mode');
    document.documentElement.style.removeProperty('color-scheme');
  });

  it('uses the system color scheme when no preference is stored', () => {
    setSystemTheme('dark');

    renderProvider();

    expect(screen.getByTestId('active-theme')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark-mode');
    expect(document.documentElement).toHaveStyle({ colorScheme: 'dark' });
    expect(localStorage.getItem('ui-theme')).toBeNull();
  });

  it('uses a stored preference instead of the system color scheme', () => {
    setSystemTheme('dark');
    localStorage.setItem('ui-theme', 'light');

    renderProvider();

    expect(screen.getByTestId('active-theme')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark-mode');
    expect(document.documentElement).toHaveStyle({ colorScheme: 'light' });
  });

  it('persists explicit dark and light selections', () => {
    setSystemTheme('light');
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }));

    expect(localStorage.getItem('ui-theme')).toBe('dark');
    expect(document.documentElement).toHaveClass('dark-mode');

    fireEvent.click(screen.getByRole('button', { name: 'Use light theme' }));

    expect(localStorage.getItem('ui-theme')).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark-mode');
  });
});
