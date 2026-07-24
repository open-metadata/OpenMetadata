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
import { usePersistentStorage } from './currentUserStore/useCurrentUserStore';
import {
  clearAppMode,
  isAppModeHintFresh,
  readAppModeHint,
  readAppModeSession,
  resolveInitialAppMode,
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

describe('resolveInitialAppMode', () => {
  const TEST_USER = 'test-user';

  beforeEach(() => {
    resetStore();
    // Persistent user-prefs store is not cleared by resetStore — clear
    // any lingering preference so tests are hermetic.
    usePersistentStorage.getState().clearUserPreference(TEST_USER);
  });

  it('returns DEFAULT_APP_MODE when no signal is present', () => {
    expect(resolveInitialAppMode(TEST_USER)).toBe(DEFAULT_APP_MODE);
  });

  it('returns the session tuple mode when present (mid-session re-auth in AI tab)', () => {
    act(() => {
      writeAppMode('ai');
    });

    expect(resolveInitialAppMode(TEST_USER)).toBe('ai');
  });

  it('returns the hint mode when session is empty and hint is fresh (sibling AI tab)', () => {
    // Simulate a sibling AI tab having written the hint — but this tab
    // has no session tuple yet (fresh open).
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      JSON.stringify({ mode: 'ai', ts: Date.now() })
    );

    expect(resolveInitialAppMode(TEST_USER)).toBe('ai');
  });

  it('ignores a stale hint (past TTL) and falls through', () => {
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      JSON.stringify({
        mode: 'ai',
        ts: Date.now() - APP_MODE_HINT_TTL_MS - 1_000,
      })
    );

    expect(resolveInitialAppMode(TEST_USER)).toBe(DEFAULT_APP_MODE);
  });

  it('ignores a fresh DEFAULT-mode hint (no positive AI signal)', () => {
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      JSON.stringify({ mode: DEFAULT_APP_MODE, ts: Date.now() })
    );

    expect(resolveInitialAppMode(TEST_USER)).toBe(DEFAULT_APP_MODE);
  });

  it('returns the stored user preference when no session and no fresh hint', () => {
    usePersistentStorage
      .getState()
      .setUserPreference(TEST_USER, { appMode: 'ai' });

    expect(resolveInitialAppMode(TEST_USER)).toBe('ai');
  });

  it('ignores a DEFAULT-valued preference (falls through to default)', () => {
    usePersistentStorage
      .getState()
      .setUserPreference(TEST_USER, { appMode: DEFAULT_APP_MODE });

    expect(resolveInitialAppMode(TEST_USER)).toBe(DEFAULT_APP_MODE);
  });

  it('ignores a null-valued preference', () => {
    usePersistentStorage
      .getState()
      .setUserPreference(TEST_USER, { appMode: null });

    expect(resolveInitialAppMode(TEST_USER)).toBe(DEFAULT_APP_MODE);
  });

  it('returns default when userName is undefined (skips the preference lookup)', () => {
    usePersistentStorage
      .getState()
      .setUserPreference(TEST_USER, { appMode: 'ai' });

    expect(resolveInitialAppMode(undefined)).toBe(DEFAULT_APP_MODE);
  });

  it('session tuple wins over a conflicting hint', () => {
    act(() => {
      writeAppMode('ai');
    });
    // Force-overwrite the hint written by writeAppMode with a conflict.
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      JSON.stringify({ mode: DEFAULT_APP_MODE, ts: Date.now() })
    );

    expect(resolveInitialAppMode(TEST_USER)).toBe('ai');
  });

  // Regression: an explicit Classic session tuple must win over a
  // fresh AI hint from a sibling tab. Reading only in-memory
  // `currentMode` conflates "no session" with "explicit Classic
  // session" (both return DEFAULT_APP_MODE), which used to let a
  // stray AI hint reroute a Classic re-auth to `/`.
  it('explicit Classic session tuple wins over a fresh AI hint', () => {
    act(() => {
      writeAppMode(DEFAULT_APP_MODE);
    });
    // Overwrite the hint that writeAppMode just wrote (also DEFAULT)
    // with a conflicting AI hint from a hypothetical sibling tab.
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      JSON.stringify({ mode: 'ai', ts: Date.now() })
    );

    expect(resolveInitialAppMode(TEST_USER)).toBe(DEFAULT_APP_MODE);
  });

  it('explicit Classic session tuple wins over a conflicting stored AI preference', () => {
    act(() => {
      writeAppMode(DEFAULT_APP_MODE);
    });
    usePersistentStorage
      .getState()
      .setUserPreference(TEST_USER, { appMode: 'ai' });

    expect(resolveInitialAppMode(TEST_USER)).toBe(DEFAULT_APP_MODE);
  });

  it('fresh hint wins over a conflicting stored user preference', () => {
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      JSON.stringify({ mode: 'ai', ts: Date.now() })
    );
    usePersistentStorage
      .getState()
      .setUserPreference(TEST_USER, { appMode: DEFAULT_APP_MODE });

    expect(resolveInitialAppMode(TEST_USER)).toBe('ai');
  });
});
