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
  const rootMatchesTheme =
    document.documentElement.classList.contains('dark-mode') ===
    (theme === 'dark');

  return (
    <>
      <span data-testid="active-theme">{theme}</span>
      <span data-testid="theme-class-ready">{String(rootMatchesTheme)}</span>
      <button type="button" onClick={() => setTheme('dark')}>
        Use dark theme
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

describe('ThemeProvider canvas synchronization', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark-mode');
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies the root class before theme consumers render', () => {
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }));

    expect(screen.getByTestId('active-theme')).toHaveTextContent('dark');
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
});
