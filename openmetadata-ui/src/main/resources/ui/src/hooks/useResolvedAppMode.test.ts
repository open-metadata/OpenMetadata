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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import {
  AI_APP_MODE,
  APP_MODE_HINT_STORAGE_KEY,
  APP_MODE_HINT_TTL_MS,
  APP_MODE_SESSION_KEY,
  DEFAULT_APP_MODE,
} from '../constants/appMode.constants';
import { AppMode } from '../generated/type/personaPreferences';
import { usePersistentStorage } from './currentUserStore/useCurrentUserStore';
import { useApplicationStore } from './useApplicationStore';
import { readAppModeSession, useAppModeStore } from './useAppMode';
import { useAppRoutesRegistry } from './useAppRoutesRegistry';
import { useResolvedAppMode } from './useResolvedAppMode';

jest.mock('../rest/DocStoreAPI', () => ({
  getDocumentByFQN: jest.fn(),
}));

const { getDocumentByFQN } = jest.requireMock('../rest/DocStoreAPI') as {
  getDocumentByFQN: jest.Mock;
};

const USER_NAME = 'user-1';

const seedUser = (opts?: {
  personaId?: string;
  personaName?: string;
  authenticated?: boolean;
  applicationsLoaded?: boolean;
}) => {
  const {
    personaId,
    personaName,
    authenticated = true,
    applicationsLoaded = true,
  } = opts ?? {};
  useApplicationStore.setState({
    isAuthenticated: authenticated,
    applicationsLoaded,
    currentUser: authenticated
      ? ({
          id: USER_NAME,
          name: USER_NAME,
          defaultPersona: personaId
            ? { id: personaId, name: personaName ?? 'p', type: 'persona' }
            : undefined,
        } as unknown as ReturnType<
          typeof useApplicationStore.getState
        >['currentUser'])
      : undefined,
  } as never);
};

const seedRegistry = (hasAi: boolean) => {
  useAppRoutesRegistry.setState({
    routes: hasAi ? { [AI_APP_MODE]: (() => null) as never } : {},
  });
};

const seedUserPref = (appMode: string | null) => {
  usePersistentStorage.setState({
    preferences: {
      [USER_NAME]: {
        isSidebarCollapsed: false,
        selectedEntityTableColumns: {},
        globalPageSize: 10,
        recentlyViewed: [],
        recentlySearched: [],
        recentlyViewedQuickLinks: [],
        marketplaceRecentSearches: [],
        appMode,
      },
    },
  } as never);
};

const seedSessionTuple = (
  tuple: { personaAppMode: string | null; mode: string } | null
) => {
  if (tuple === null) {
    globalThis.window.sessionStorage.removeItem(APP_MODE_SESSION_KEY);
  } else {
    globalThis.window.sessionStorage.setItem(
      APP_MODE_SESSION_KEY,
      JSON.stringify(tuple)
    );
  }
};

const seedHint = (hint: { mode: string; ts?: number } | null) => {
  if (hint === null) {
    globalThis.window.localStorage.removeItem(APP_MODE_HINT_STORAGE_KEY);
  } else {
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      JSON.stringify({ mode: hint.mode, ts: hint.ts ?? Date.now() })
    );
  }
};

const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
};

const personaDoc = (mode?: AppMode, personaId = 'persona-1') => ({
  data: {
    personaPreferences: [
      {
        personaId,
        personaName: 'p',
        ...(mode ? { appMode: mode } : {}),
      },
    ],
  },
});

describe('useResolvedAppMode', () => {
  beforeEach(() => {
    useAppModeStore.setState({ currentMode: DEFAULT_APP_MODE });
    seedSessionTuple(null);
    seedHint(null);
    seedRegistry(false);
    usePersistentStorage.setState({ preferences: {} } as never);
    seedUser({ authenticated: false });
    getDocumentByFQN.mockReset();
  });

  it('does nothing before the user is authenticated', async () => {
    seedUser({ authenticated: false });

    renderHook(() => useResolvedAppMode(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
      expect(readAppModeSession()).toBeNull();
    });
  });

  it('writes DEFAULT_APP_MODE for a fresh authenticated user with no persona and no pref', async () => {
    seedUser({});

    renderHook(() => useResolvedAppMode(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
      expect(readAppModeSession()).toEqual({
        personaAppMode: null,
        mode: DEFAULT_APP_MODE,
      });
    });
  });

  it('honours the persona appMode when AI route is registered', async () => {
    seedUser({ personaId: 'persona-1', personaName: 'p' });
    seedRegistry(true);
    getDocumentByFQN.mockResolvedValue(personaDoc(AppMode.AI));

    renderHook(() => useResolvedAppMode(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(AI_APP_MODE);
      expect(readAppModeSession()).toEqual({
        personaAppMode: AI_APP_MODE,
        mode: AI_APP_MODE,
      });
    });
  });

  it('waits (no write) when persona says AI but AI route is not registered', async () => {
    seedUser({ personaId: 'persona-1', personaName: 'p' });
    seedRegistry(false);
    getDocumentByFQN.mockResolvedValue(personaDoc(AppMode.AI));

    renderHook(() => useResolvedAppMode(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(getDocumentByFQN).toHaveBeenCalled();
    });

    // Should not have written anything, sessionStorage still empty
    expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    expect(readAppModeSession()).toBeNull();
  });

  it('falls back to user preference when persona has no appMode', async () => {
    seedUser({ personaId: 'persona-1', personaName: 'p' });
    seedRegistry(true);
    seedUserPref(AI_APP_MODE);
    getDocumentByFQN.mockResolvedValue(personaDoc(undefined));

    renderHook(() => useResolvedAppMode(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(AI_APP_MODE);
      expect(readAppModeSession()).toEqual({
        personaAppMode: null,
        mode: AI_APP_MODE,
      });
    });
  });

  it('respects an existing session tuple when persona appMode matches its snapshot', async () => {
    seedUser({ personaId: 'persona-1', personaName: 'p' });
    seedRegistry(true);
    // User previously switched to Classic during this tab (personaAppMode
    // snapshot stored as `ai` — the persona still says AI).
    seedSessionTuple({ personaAppMode: AI_APP_MODE, mode: DEFAULT_APP_MODE });
    useAppModeStore.setState({ currentMode: DEFAULT_APP_MODE });
    getDocumentByFQN.mockResolvedValue(personaDoc(AppMode.AI));

    renderHook(() => useResolvedAppMode(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(getDocumentByFQN).toHaveBeenCalled();
    });

    // Tuple matches persona snapshot — session sticks, mode unchanged.
    expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    expect(readAppModeSession()).toEqual({
      personaAppMode: AI_APP_MODE,
      mode: DEFAULT_APP_MODE,
    });
  });

  it('overrides an existing session tuple when persona appMode differs from its snapshot', async () => {
    seedUser({ personaId: 'persona-1', personaName: 'p' });
    seedRegistry(true);
    // Prior tuple recorded `null` for personaAppMode (no persona at time
    // of write) — persona now says Classic. Should snap to Classic.
    seedSessionTuple({ personaAppMode: null, mode: AI_APP_MODE });
    useAppModeStore.setState({ currentMode: AI_APP_MODE });
    getDocumentByFQN.mockResolvedValue(personaDoc(AppMode.Classic));

    renderHook(() => useResolvedAppMode(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
      expect(readAppModeSession()).toEqual({
        personaAppMode: DEFAULT_APP_MODE,
        mode: DEFAULT_APP_MODE,
      });
    });
  });

  it('preserves the session tuple across refresh even if the target mode is not yet registered', async () => {
    // Refresh scenario: sessionStorage has `mode: 'ai'` from a previous
    // switch. On boot, this resolver runs BEFORE App.tsx has registered
    // the AI route (React flushes child effects before parent effects
    // in the same commit). Old code called clearAppMode() here, which
    // wiped the tuple and reset the tab to Classic on every refresh.
    // New behavior: keep the session tuple, wait for the route to
    // register, then find the tuple valid on the next re-run.
    seedUser({});
    seedRegistry(false);
    seedSessionTuple({ personaAppMode: null, mode: AI_APP_MODE });
    useAppModeStore.setState({ currentMode: AI_APP_MODE });

    const { rerender } = renderHook(() => useResolvedAppMode(), {
      wrapper: makeWrapper(),
    });
    rerender();

    expect(useAppModeStore.getState().currentMode).toBe(AI_APP_MODE);
    expect(readAppModeSession()).toEqual({
      personaAppMode: null,
      mode: AI_APP_MODE,
    });
  });

  it('swallows persona fetch errors and falls back to user pref / default', async () => {
    seedUser({ personaId: 'persona-1', personaName: 'p' });
    seedRegistry(true);
    seedUserPref(AI_APP_MODE);
    getDocumentByFQN.mockRejectedValue(new Error('boom'));

    renderHook(() => useResolvedAppMode(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(AI_APP_MODE);
      expect(readAppModeSession()).toEqual({
        personaAppMode: null,
        mode: AI_APP_MODE,
      });
    });
  });

  it('adopts a fresh cross-tab hint when the session tuple is empty', async () => {
    seedUser({});
    seedRegistry(true);
    // No persona, no user pref → default would win normally. A fresh
    // hint from a sibling tab should override that.
    seedHint({ mode: AI_APP_MODE });

    renderHook(() => useResolvedAppMode(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(AI_APP_MODE);
      expect(readAppModeSession()).toEqual({
        personaAppMode: null,
        mode: AI_APP_MODE,
      });
    });
  });

  it('lets the hint trump persona when the tab has no session', async () => {
    // The user is actively using AI in a sibling tab (hint written).
    // Persona defaults to Classic — should NOT override the hint on
    // this new tab, or cmd+click from AI mode would land on Classic
    // and 404 on AI-only URLs.
    seedUser({ personaId: 'persona-1', personaName: 'p' });
    seedRegistry(true);
    seedHint({ mode: AI_APP_MODE });
    getDocumentByFQN.mockResolvedValue(personaDoc(AppMode.Classic));

    renderHook(() => useResolvedAppMode(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(AI_APP_MODE);
      expect(readAppModeSession()).toEqual({
        personaAppMode: DEFAULT_APP_MODE,
        mode: AI_APP_MODE,
      });
    });
  });

  it('ignores a stale (TTL-expired) hint and falls through to normal precedence', async () => {
    seedUser({});
    seedRegistry(true);
    seedHint({ mode: AI_APP_MODE, ts: Date.now() - APP_MODE_HINT_TTL_MS - 1 });

    renderHook(() => useResolvedAppMode(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
      expect(readAppModeSession()).toEqual({
        personaAppMode: null,
        mode: DEFAULT_APP_MODE,
      });
    });
  });

  it('waits (no write) when the hint mode is not yet registered', async () => {
    seedUser({});
    seedRegistry(false);
    seedHint({ mode: AI_APP_MODE });

    const { rerender } = renderHook(() => useResolvedAppMode(), {
      wrapper: makeWrapper(),
    });
    rerender();

    // The effect had a chance to run. It should NOT have written the
    // session tuple or overwritten the hint — falling through to write
    // DEFAULT here would clobber the hint that a sibling tab set, and
    // strand every new-tab-from-AI in Classic once the AI route
    // registers on the next commit. Route registration happens in a
    // child-of-child component effect (App.tsx) whose flush order is
    // not guaranteed relative to this resolver's flush, so we can't
    // rely on `applicationsLoaded` as a give-up signal.
    expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    expect(readAppModeSession()).toBeNull();
    expect(readAppModeSession()).toBeNull();

    const rawHint = globalThis.window.localStorage.getItem(
      APP_MODE_HINT_STORAGE_KEY
    );

    expect(JSON.parse(rawHint ?? '{}').mode).toBe(AI_APP_MODE);
  });
});
