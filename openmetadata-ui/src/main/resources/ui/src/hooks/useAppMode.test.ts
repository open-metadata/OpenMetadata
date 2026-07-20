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
  APP_MODE_SESSION_KEY,
  DEFAULT_APP_MODE,
} from '../constants/appMode.constants';
import {
  clearAppMode,
  readAppModeSession,
  useAppMode,
  useAppModeStore,
  writeAppMode,
} from './useAppMode';

const resetStore = () => {
  act(() => {
    useAppModeStore.setState({ currentMode: DEFAULT_APP_MODE });
  });
  globalThis.window.sessionStorage.removeItem(APP_MODE_SESSION_KEY);
};

describe('useAppMode hook', () => {
  beforeEach(resetStore);

  it('returns DEFAULT_APP_MODE when no session tuple is present', () => {
    const { result } = renderHook(() => useAppMode());

    expect(result.current).toBe(DEFAULT_APP_MODE);
  });

  it('returns the mode set via writeAppMode', () => {
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

  it('updates the in-memory store', () => {
    writeAppMode('ai');

    expect(useAppModeStore.getState().currentMode).toBe('ai');
  });

  it('writes a session tuple to sessionStorage', () => {
    writeAppMode('ai', 'ai');

    const raw = globalThis.window.sessionStorage.getItem(APP_MODE_SESSION_KEY);

    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? '')).toEqual({
      personaAppMode: 'ai',
      mode: 'ai',
    });
  });

  it('preserves personaAppMode from the existing tuple when omitted', () => {
    writeAppMode('ai', 'ai');
    writeAppMode(DEFAULT_APP_MODE);

    const raw = globalThis.window.sessionStorage.getItem(APP_MODE_SESSION_KEY);

    expect(JSON.parse(raw ?? '')).toEqual({
      personaAppMode: 'ai',
      mode: DEFAULT_APP_MODE,
    });
  });

  it('defaults personaAppMode to null when no tuple exists and none is passed', () => {
    writeAppMode('ai');

    const raw = globalThis.window.sessionStorage.getItem(APP_MODE_SESSION_KEY);

    expect(JSON.parse(raw ?? '')).toEqual({
      personaAppMode: null,
      mode: 'ai',
    });
  });

  it('accepts an explicit null personaAppMode override', () => {
    writeAppMode('ai', 'ai');
    writeAppMode('ai', null);

    const raw = globalThis.window.sessionStorage.getItem(APP_MODE_SESSION_KEY);

    expect(JSON.parse(raw ?? '')).toEqual({
      personaAppMode: null,
      mode: 'ai',
    });
  });
});

describe('clearAppMode', () => {
  beforeEach(resetStore);

  it('resets the store back to DEFAULT_APP_MODE', () => {
    writeAppMode('ai');
    clearAppMode();

    expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
  });

  it('removes the session tuple from sessionStorage', () => {
    writeAppMode('ai');
    clearAppMode();

    expect(
      globalThis.window.sessionStorage.getItem(APP_MODE_SESSION_KEY)
    ).toBeNull();
  });
});

describe('readAppModeSession', () => {
  beforeEach(resetStore);

  it('returns null when no tuple is present', () => {
    expect(readAppModeSession()).toBeNull();
  });

  it('returns the parsed tuple when present', () => {
    globalThis.window.sessionStorage.setItem(
      APP_MODE_SESSION_KEY,
      JSON.stringify({ personaAppMode: 'ai', mode: 'ai' })
    );

    expect(readAppModeSession()).toEqual({
      personaAppMode: 'ai',
      mode: 'ai',
    });
  });

  it('normalises non-string personaAppMode to null', () => {
    globalThis.window.sessionStorage.setItem(
      APP_MODE_SESSION_KEY,
      JSON.stringify({ personaAppMode: 123, mode: 'ai' })
    );

    expect(readAppModeSession()).toEqual({
      personaAppMode: null,
      mode: 'ai',
    });
  });

  it('returns null when the payload is malformed JSON', () => {
    globalThis.window.sessionStorage.setItem(
      APP_MODE_SESSION_KEY,
      '{not valid'
    );

    expect(readAppModeSession()).toBeNull();
  });

  it('returns null when the payload is missing `mode`', () => {
    globalThis.window.sessionStorage.setItem(
      APP_MODE_SESSION_KEY,
      JSON.stringify({ personaAppMode: 'ai' })
    );

    expect(readAppModeSession()).toBeNull();
  });
});
