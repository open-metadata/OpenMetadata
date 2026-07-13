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

import { renderHook } from '@testing-library/react';
import { act } from 'react';
import {
  APP_MODE_STORAGE_KEY,
  DEFAULT_APP_MODE,
} from '../constants/appMode.constants';
import {
  clearAppMode,
  useAppMode,
  useAppModeStore,
  writeAppMode,
} from './useAppMode';

const resetStore = () => {
  act(() => {
    useAppModeStore.setState({ currentMode: DEFAULT_APP_MODE });
  });
  globalThis.window.localStorage.removeItem(APP_MODE_STORAGE_KEY);
};

describe('useAppMode hook', () => {
  beforeEach(resetStore);

  it('returns the DEFAULT_APP_MODE when no value is persisted', () => {
    const { result } = renderHook(() => useAppMode());

    expect(result.current).toBe(DEFAULT_APP_MODE);
  });

  it('returns the persisted value once writeAppMode has set one', () => {
    act(() => {
      writeAppMode('ai');
    });

    const { result } = renderHook(() => useAppMode());

    expect(result.current).toBe('ai');
  });

  it('re-renders subscribers when writeAppMode changes the mode', () => {
    const { result } = renderHook(() => useAppMode());

    expect(result.current).toBe(DEFAULT_APP_MODE);

    act(() => {
      writeAppMode('ai');
    });

    expect(result.current).toBe('ai');
  });

  it('reverts to default after clearAppMode', () => {
    act(() => {
      writeAppMode('ai');
    });

    const { result } = renderHook(() => useAppMode());

    expect(result.current).toBe('ai');

    act(() => {
      clearAppMode();
    });

    expect(result.current).toBe(DEFAULT_APP_MODE);
  });
});

describe('writeAppMode', () => {
  beforeEach(resetStore);

  it('updates the store state', () => {
    writeAppMode('ai');

    expect(useAppModeStore.getState().currentMode).toBe('ai');
  });

  it('persists the new mode to localStorage (wrapped by Zustand persist)', () => {
    writeAppMode('ai');

    const persisted =
      globalThis.window.localStorage.getItem(APP_MODE_STORAGE_KEY);

    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted ?? '').state.currentMode).toBe('ai');
  });
});

describe('clearAppMode', () => {
  beforeEach(resetStore);

  it('resets the store back to DEFAULT_APP_MODE', () => {
    writeAppMode('ai');
    clearAppMode();

    expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
  });
});
