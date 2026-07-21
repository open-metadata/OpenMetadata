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
  APP_MODE_HINT_STORAGE_KEY,
  APP_MODE_HINT_TTL_MS,
  APP_MODE_SESSION_KEY,
  DEFAULT_APP_MODE,
} from '../constants/appMode.constants';
import {
  clearAppMode,
  isAppModeHintFresh,
  readAppModeHint,
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
  globalThis.window.localStorage.removeItem(APP_MODE_HINT_STORAGE_KEY);
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

  it('writes the cross-tab hint to localStorage', () => {
    writeAppMode('ai');

    const raw = globalThis.window.localStorage.getItem(
      APP_MODE_HINT_STORAGE_KEY
    );

    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw ?? '') as { mode: string; ts: number };

    expect(parsed.mode).toBe('ai');
    expect(typeof parsed.ts).toBe('number');
  });

  it('overwrites the hint with DEFAULT when explicitly switching AI → Classic', () => {
    // Explicit switches update the hint for both modes so a sibling
    // tab picks up the user's most-recent intent. Only the passive
    // heartbeat is guarded against DEFAULT-mode writes.
    writeAppMode('ai');
    writeAppMode(DEFAULT_APP_MODE);

    const raw = globalThis.window.localStorage.getItem(
      APP_MODE_HINT_STORAGE_KEY
    );
    const parsed = JSON.parse(raw ?? '') as { mode: string; ts: number };

    expect(parsed.mode).toBe(DEFAULT_APP_MODE);
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

  it('removes the cross-tab hint from localStorage', () => {
    writeAppMode('ai');
    clearAppMode();

    expect(
      globalThis.window.localStorage.getItem(APP_MODE_HINT_STORAGE_KEY)
    ).toBeNull();
  });
});

describe('heartbeat (visibility / focus refresh)', () => {
  beforeEach(resetStore);

  it('does NOT overwrite a fresh AI hint when this tab is in DEFAULT mode', () => {
    // Simulate a sibling AI tab having written a fresh hint.
    const siblingWriteTs = Date.now();
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      JSON.stringify({ mode: 'ai', ts: siblingWriteTs })
    );
    // This tab is in DEFAULT mode.
    useAppModeStore.setState({ currentMode: DEFAULT_APP_MODE });

    // Fire a visibility change — the heartbeat listener runs.
    globalThis.window.dispatchEvent(new Event('visibilitychange'));

    // Hint is unchanged: still `'ai'` with the sibling's timestamp.
    const raw = globalThis.window.localStorage.getItem(
      APP_MODE_HINT_STORAGE_KEY
    );
    const parsed = JSON.parse(raw ?? '') as { mode: string; ts: number };

    expect(parsed.mode).toBe('ai');
    expect(parsed.ts).toBe(siblingWriteTs);
  });

  it('refreshes the hint when this tab is in a non-default mode', () => {
    const oldTs = Date.now() - 30_000;
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      JSON.stringify({ mode: 'ai', ts: oldTs })
    );
    useAppModeStore.setState({ currentMode: 'ai' });

    globalThis.window.dispatchEvent(new Event('visibilitychange'));

    const raw = globalThis.window.localStorage.getItem(
      APP_MODE_HINT_STORAGE_KEY
    );
    const parsed = JSON.parse(raw ?? '') as { mode: string; ts: number };

    expect(parsed.mode).toBe('ai');
    expect(parsed.ts).toBeGreaterThan(oldTs);
  });
});

describe('readAppModeHint / isAppModeHintFresh', () => {
  beforeEach(resetStore);

  it('returns null when no hint is present', () => {
    expect(readAppModeHint()).toBeNull();
    expect(isAppModeHintFresh(null)).toBe(false);
  });

  it('returns the hint written by writeAppMode', () => {
    writeAppMode('ai');
    const hint = readAppModeHint();

    expect(hint?.mode).toBe('ai');
    expect(typeof hint?.ts).toBe('number');
    expect(isAppModeHintFresh(hint)).toBe(true);
  });

  it('treats a hint older than the TTL as stale', () => {
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      JSON.stringify({ mode: 'ai', ts: Date.now() - APP_MODE_HINT_TTL_MS - 1 })
    );
    const hint = readAppModeHint();

    expect(hint?.mode).toBe('ai');
    expect(isAppModeHintFresh(hint)).toBe(false);
  });

  it('rejects a malformed hint payload', () => {
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      '{not valid'
    );

    expect(readAppModeHint()).toBeNull();
  });

  it('rejects a hint missing the ts field', () => {
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      JSON.stringify({ mode: 'ai' })
    );

    expect(readAppModeHint()).toBeNull();
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
