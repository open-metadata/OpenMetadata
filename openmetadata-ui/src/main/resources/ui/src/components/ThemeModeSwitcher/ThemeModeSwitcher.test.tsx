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
import { ThemeProvider } from '../../context/UntitledUIThemeProvider/theme-provider';
import ThemeModeSwitcher from './ThemeModeSwitcher';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ThemeModeSwitcher', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark-mode');
  });

  it('shows and updates the active theme', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeModeSwitcher />
      </ThemeProvider>
    );

    const switcher = screen.getByRole('switch', { name: 'label.dark-mode' });

    expect(switcher).not.toBeChecked();

    fireEvent.click(switcher);

    expect(switcher).toBeChecked();
    expect(localStorage.getItem('ui-theme')).toBe('dark');
    expect(document.documentElement).toHaveClass('dark-mode');

    fireEvent.click(switcher);

    expect(switcher).not.toBeChecked();
    expect(localStorage.getItem('ui-theme')).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark-mode');
  });
});
