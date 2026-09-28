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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { ThemeProvider, useTheme } from './theme-provider';
import { BrandColors } from './theme-provider.interface';

const ThemeProbe = () => {
  const { setTheme, theme } = useTheme();

  return (
    <>
      <span data-testid="active-theme">{theme}</span>
      <span data-testid="theme-class-ready">
        {String(
          document.documentElement.classList.contains('dark-mode') ===
            (theme === 'dark')
        )}
      </span>
      <button type="button" onClick={() => setTheme('dark')}>
        Use dark theme
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        Use light theme
      </button>
    </>
  );
};

const PortalThemeProbe = () => {
  const { theme } = useTheme();

  return createPortal(
    <span data-testid="portal-theme">{theme}</span>,
    document.body
  );
};

const renderProvider = () =>
  render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>
  );

const setSystemTheme = (theme: 'light' | 'dark') => {
  let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
  const mediaQuery = {
    matches: theme === 'dark',
    addEventListener: jest.fn(
      (_event: string, listener: (event: MediaQueryListEvent) => void) => {
        changeListener = listener;
      }
    ),
    removeEventListener: jest.fn(),
  };

  window.matchMedia = jest
    .fn()
    .mockReturnValue(mediaQuery as unknown as MediaQueryList);

  return (nextTheme: 'light' | 'dark') => {
    mediaQuery.matches = nextTheme === 'dark';
    changeListener?.({ matches: mediaQuery.matches } as MediaQueryListEvent);
  };
};

describe('ThemeProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    document.documentElement.classList.remove('dark-mode');
    document.documentElement.style.removeProperty('color-scheme');
    // Branding expands one input into several aliases, so clear the family to
    // prevent one test's root styles from affecting another test's assertions.
    Array.from(document.documentElement.style)
      .filter((property) => property.startsWith('--tw-'))
      .forEach((property) =>
        document.documentElement.style.removeProperty(property)
      );
  });

  it('uses light mode when no preference is stored', () => {
    setSystemTheme('dark');

    renderProvider();

    expect(screen.getByTestId('active-theme')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark-mode');
    expect(document.documentElement).toHaveStyle({ colorScheme: 'light' });
    expect(localStorage.getItem('ui-theme')).toBeNull();
  });

  it('uses a stored preference instead of the default light mode', () => {
    setSystemTheme('light');
    localStorage.setItem('ui-theme', 'dark');

    renderProvider();

    expect(screen.getByTestId('active-theme')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark-mode');
    expect(document.documentElement).toHaveStyle({ colorScheme: 'dark' });
  });

  it('restores a stored light preference when the system theme is dark', () => {
    setSystemTheme('dark');
    localStorage.setItem('ui-theme', 'light');

    renderProvider();

    expect(screen.getByTestId('active-theme')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark-mode');
    expect(document.documentElement).toHaveStyle({ colorScheme: 'light' });
  });

  it('treats an invalid stored value as no preference', () => {
    setSystemTheme('dark');
    localStorage.setItem('ui-theme', 'invalid');

    renderProvider();

    expect(screen.getByTestId('active-theme')).toHaveTextContent('light');
    expect(localStorage.getItem('ui-theme')).toBeNull();
  });

  it('keeps light mode when the system color scheme changes', () => {
    const changeSystemTheme = setSystemTheme('light');
    renderProvider();

    act(() => changeSystemTheme('dark'));

    expect(screen.getByTestId('active-theme')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark-mode');
  });

  it('uses light mode when the stored preference cannot be read', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage is unavailable');
    });

    expect(() => renderProvider()).not.toThrow();
    expect(screen.getByTestId('active-theme')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark-mode');
    expect(document.documentElement).toHaveStyle({ colorScheme: 'light' });
  });

  it('updates the theme when the preference cannot be persisted', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage is unavailable');
    });
    renderProvider();

    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }))
    ).not.toThrow();
    expect(screen.getByTestId('active-theme')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark-mode');
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

  it('applies the root class before theme consumers render', () => {
    setSystemTheme('light');
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }));

    expect(screen.getByTestId('theme-class-ready')).toHaveTextContent('true');
  });

  it('applies a stored theme before consumers initially render', () => {
    localStorage.setItem('ui-theme', 'dark');

    renderProvider();

    expect(screen.getByTestId('theme-class-ready')).toHaveTextContent('true');
  });

  it('does not rewrite a root class that already matches the stored theme', () => {
    localStorage.setItem('ui-theme', 'dark');
    document.documentElement.classList.add('dark-mode');
    const toggleSpy = jest.spyOn(document.documentElement.classList, 'toggle');

    renderProvider();

    expect(toggleSpy).not.toHaveBeenCalled();
  });

  it('governs a body-mounted portal through the root theme', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
        <PortalThemeProbe />
      </ThemeProvider>
    );

    const portal = screen.getByTestId('portal-theme');

    expect(portal.parentElement).toBe(document.body);
    expect(portal).toHaveTextContent('light');

    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }));

    expect(portal).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark-mode');
    expect(document.body).not.toHaveClass('dark-mode');
    expect(portal).not.toHaveClass('dark-mode');
  });

  it('preserves customer brand variables across theme switches', () => {
    const brandColors: BrandColors = {
      errorColor: '#a10000',
      primaryColor: '#123456',
    };

    render(
      <ThemeProvider brandColors={brandColors}>
        <ThemeProbe />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }));

    expect(
      document.documentElement.style.getPropertyValue('--tw-color-brand-600')
    ).toBe('#123456');
    expect(
      document.documentElement.style.getPropertyValue('--tw-color-error-600')
    ).toBe('#a10000');

    fireEvent.click(screen.getByRole('button', { name: 'Use light theme' }));

    expect(
      document.documentElement.style.getPropertyValue('--tw-color-brand-600')
    ).toBe('#123456');
    expect(
      document.documentElement.style.getPropertyValue('--tw-color-error-600')
    ).toBe('#a10000');
  });

  it('drops light-only brand shades in dark so the dark palette applies', () => {
    const brandColors: BrandColors = {
      hoverColor: '#d1e9ff',
      primaryColor: '#1570ef',
      selectedColor: '#175cd3',
    };
    const inlineVar = (name: string) =>
      document.documentElement.style.getPropertyValue(name);

    render(
      <ThemeProvider brandColors={brandColors}>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(inlineVar('--tw-background-color-brand-secondary')).toBe('#d1e9ff');
    expect(inlineVar('--tw-color-utility-brand-700')).toBe('#175cd3');

    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }));

    expect(inlineVar('--tw-background-color-brand-secondary')).toBe('');
    expect(inlineVar('--tw-color-utility-brand-700')).toBe('');
    expect(inlineVar('--tw-color-brand-600')).toBe('#1570ef');

    fireEvent.click(screen.getByRole('button', { name: 'Use light theme' }));

    expect(inlineVar('--tw-background-color-brand-secondary')).toBe('#d1e9ff');
  });

  it('replaces customer branding without retaining stale variables', () => {
    const { rerender } = render(
      <ThemeProvider
        brandColors={{ errorColor: '#a10000', primaryColor: '#123456' }}>
        <ThemeProbe />
      </ThemeProvider>
    );

    rerender(
      <ThemeProvider brandColors={{ primaryColor: '#654321' }}>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(
      document.documentElement.style.getPropertyValue('--tw-color-brand-600')
    ).toBe('#654321');
    expect(
      document.documentElement.style.getPropertyValue('--tw-color-error-600')
    ).toBe('');
  });

  it('clears customer brand variables when branding is removed', () => {
    const { rerender } = render(
      <ThemeProvider brandColors={{ primaryColor: '#123456' }}>
        <ThemeProbe />
      </ThemeProvider>
    );

    rerender(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(
      document.documentElement.style.getPropertyValue('--tw-color-brand-600')
    ).toBe('');
  });
});
