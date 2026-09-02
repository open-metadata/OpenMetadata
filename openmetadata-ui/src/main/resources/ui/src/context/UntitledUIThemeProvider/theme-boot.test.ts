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

import { readFileSync } from 'fs';

const getThemeRestoreScript = () => {
  const indexHtml = readFileSync('index.html', 'utf8');
  const parsedHtml = new DOMParser().parseFromString(indexHtml, 'text/html');
  const script = parsedHtml.querySelector<HTMLScriptElement>('#theme-restore');

  if (!script?.textContent) {
    throw new Error('Theme restore script is missing from index.html');
  }

  return script.textContent;
};

const executeThemeRestore = () => {
  const restoreTheme = new Function(getThemeRestoreScript());
  restoreTheme();
};

describe('theme restore boot script', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark-mode');
    document.documentElement.style.removeProperty('color-scheme');
  });

  it('uses the OS dark theme before the application bundle loads', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });

    executeThemeRestore();

    expect(document.documentElement).toHaveClass('dark-mode');
    expect(document.documentElement).toHaveStyle({ colorScheme: 'dark' });
  });

  it('keeps an explicit light preference when the OS theme is dark', () => {
    localStorage.setItem('ui-theme', 'light');
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });

    executeThemeRestore();

    expect(document.documentElement).not.toHaveClass('dark-mode');
    expect(document.documentElement).toHaveStyle({ colorScheme: 'light' });
  });
});
