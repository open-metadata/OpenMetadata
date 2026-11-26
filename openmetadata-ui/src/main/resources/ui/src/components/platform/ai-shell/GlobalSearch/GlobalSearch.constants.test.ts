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
const loadConstants = (isApple: boolean) => {
  let constants: typeof import('./GlobalSearch.constants') | undefined;
  jest.isolateModules(() => {
    jest.doMock('@react-aria/utils', () => ({
      ...jest.requireActual('@react-aria/utils'),
      isAppleDevice: () => isApple,
    }));
    constants = jest.requireActual('./GlobalSearch.constants');
  });

  return constants as typeof import('./GlobalSearch.constants');
};

describe('GlobalSearch shortcut labels', () => {
  afterEach(() => {
    jest.dontMock('@react-aria/utils');
  });

  it('names the command key on Apple devices', () => {
    const { KEY_HINT, OPEN_SEARCH_SHORTCUT, OPEN_SCOPED_SEARCH_SHORTCUT } =
      loadConstants(true);

    expect(KEY_HINT.mod).toBe('⌘');
    expect(OPEN_SEARCH_SHORTCUT).toBe('⌘K');
    expect(OPEN_SCOPED_SEARCH_SHORTCUT).toBe('⌥⌘K');
  });

  it('names Ctrl everywhere else', () => {
    const { KEY_HINT, OPEN_SEARCH_SHORTCUT, OPEN_SCOPED_SEARCH_SHORTCUT } =
      loadConstants(false);

    expect(KEY_HINT.mod).toBe('Ctrl');
    expect(OPEN_SEARCH_SHORTCUT).toBe('Ctrl+K');
    expect(OPEN_SCOPED_SEARCH_SHORTCUT).toBe('Ctrl+Alt+K');
  });
});
