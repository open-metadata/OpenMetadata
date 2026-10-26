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
import { QueryObserver } from '@tanstack/react-query';
import { queryClient } from '../../queryClient';
import { isTourMockActive } from '../../rest/product-tour/productTourMock';
import { useExploreCache } from '../useExploreCache';
import { useProductTourStore } from './useProductTourStore';

const HINT_KEY = 'omAppModeHint';
const SESSION_KEY = 'omAppMode';
const STORAGE_KEY = 'omProductTour';
const appModeStore = { currentMode: 'default' };
const mockGetTour = jest.fn();

jest.mock('../../utils/ProductTourClassBase', () => ({
  getTour: (mode: string) => mockGetTour(mode),
}));

// writeAppMode switches the mode and records it in the tab's session tuple
// and, unless the write is for this tab only, the cross-tab hint, as the real
// one does.
jest.mock('../useAppMode', () => ({
  useAppModeStore: {
    getState: () => ({
      currentMode: appModeStore.currentMode,
      setMode: (mode: string) => {
        appModeStore.currentMode = mode;
      },
    }),
  },
  writeAppMode: (
    mode: string,
    _personaAppMode?: string | null,
    options?: { tabOnly?: boolean }
  ) => {
    appModeStore.currentMode = mode;
    sessionStorage.setItem(
      'omAppMode',
      JSON.stringify({ mode, source: 'manual' })
    );
    if (!options?.tabOnly) {
      localStorage.setItem(
        'omAppModeHint',
        JSON.stringify({ mode, ts: Date.now() })
      );
    }
  },
}));

const getState = () => useProductTourStore.getState();
// What the tab's heartbeat does to the hint while it is in the tour's mode.
const refreshHintWith = (mode: string) =>
  localStorage.setItem(HINT_KEY, JSON.stringify({ mode, ts: Date.now() }));
const tourIn = (mode: string) => ({
  mode,
  steps: [],
  loadFixtures: async () => [],
});

describe('useProductTourStore', () => {
  beforeEach(() => {
    appModeStore.currentMode = 'default';
    mockGetTour.mockImplementation(() => tourIn('default'));
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({ idx: 0 }, '');
    getState().exit();
    useProductTourStore.setState({ lastPath: undefined });
  });

  it('runs a tour in the mode the user is in without switching mode', () => {
    getState().start('default');

    expect(getState()).toMatchObject({ isActive: true, tourMode: 'default' });
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(isTourMockActive()).toBe(true);

    getState().exit();

    expect(isTourMockActive()).toBe(false);
  });

  describe('a tour in another mode', () => {
    beforeEach(() => {
      mockGetTour.mockImplementation(() => tourIn('ai'));
    });

    it('switches to the tour mode and back on exit', () => {
      getState().start('default');

      expect(appModeStore.currentMode).toBe('ai');

      getState().exit();

      expect(appModeStore.currentMode).toBe('default');
    });

    it('switches this tab only, so new tabs keep opening in the user mode', () => {
      const previousHint = JSON.stringify({ mode: 'default', ts: 1 });
      localStorage.setItem(HINT_KEY, previousHint);

      getState().start('default');

      expect(sessionStorage.getItem(SESSION_KEY)).toContain('"ai"');
      expect(localStorage.getItem(HINT_KEY)).toBe(previousHint);

      getState().exit();
    });

    it('removes the session tuple and hint the tour left when there were none', () => {
      getState().start('default');
      refreshHintWith('ai');

      expect(sessionStorage.getItem(SESSION_KEY)).toContain('"ai"');

      getState().exit();

      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
      expect(localStorage.getItem(HINT_KEY)).toBeNull();
    });

    it('puts back the session tuple and hint that existed before', () => {
      const previousSession = JSON.stringify({
        mode: 'default',
        source: 'boot',
      });
      const previousHint = JSON.stringify({ mode: 'default', ts: 1 });
      sessionStorage.setItem(SESSION_KEY, previousSession);
      localStorage.setItem(HINT_KEY, previousHint);

      getState().start('default');
      getState().exit();

      expect(sessionStorage.getItem(SESSION_KEY)).toBe(previousSession);
      expect(localStorage.getItem(HINT_KEY)).toBe(previousHint);
    });

    it('puts back only the hint when the tab closes mid-tour', () => {
      getState().start('default');
      refreshHintWith('ai');
      getState().restoreModeHint();

      expect(localStorage.getItem(HINT_KEY)).toBeNull();
      expect(getState().isActive).toBe(true);
    });

    it('keeps the tour mode while the end modal is open', () => {
      getState().start('default');
      getState().finish();

      expect(getState()).toMatchObject({
        isActive: false,
        isEndModalOpen: true,
      });
      expect(appModeStore.currentMode).toBe('ai');

      getState().exit();

      expect(appModeStore.currentMode).toBe('default');
    });

    it('does not restart, or record the tour mode as the one to go back to', () => {
      getState().start('default');
      getState().goToStep(5);
      getState().start('ai');

      expect(getState().stepIndex).toBe(5);

      getState().finish();
      getState().start('ai');
      getState().exit();

      expect(appModeStore.currentMode).toBe('default');
    });
  });

  it('returns to the page the tour was started from', () => {
    getState().recordPath('/explore?search=orders');
    getState().recordPath('/tour');
    getState().start('default');
    // Pages the tour itself visits are not where it was started from.
    getState().recordPath('/glossary');

    expect(getState().exit()).toBe('/explore?search=orders');
  });

  it('tells a history entry from before the tour from one during it', () => {
    window.history.replaceState({ idx: 3 }, '');
    getState().start('default');
    window.history.replaceState({ idx: 5 }, '');

    expect(getState().isBeforeTour()).toBe(false);

    window.history.replaceState({ idx: 2 }, '');

    expect(getState().isBeforeTour()).toBe(true);
  });

  it('keeps the running tour in the tab session, so a reload resumes it', () => {
    getState().start('default');
    getState().goToStep(7);

    const persisted = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}');

    expect(persisted.state).toMatchObject({
      isActive: true,
      stepIndex: 7,
      tourMode: 'default',
    });
    expect(persisted.state).not.toHaveProperty('lastPath');
  });

  it('drops server data the pages before the tour cached, keeping mounted queries', () => {
    useExploreCache.getState().setCached('explore-search', { hits: ['real'] });
    queryClient.setQueryData(['left-page'], 'real');
    const shell = new QueryObserver(queryClient, {
      queryKey: ['shell'],
      queryFn: () => 'shell',
    });
    const unsubscribe = shell.subscribe(jest.fn());

    getState().start('default');

    expect(
      useExploreCache.getState().getCached('explore-search')
    ).toBeUndefined();
    expect(queryClient.getQueryData(['left-page'])).toBeUndefined();
    expect(queryClient.getQueryState(['shell'])).toBeDefined();

    unsubscribe();
    queryClient.clear();
  });

  it('serves the fixtures again after a reload mid-tour', async () => {
    getState().start('default');
    getState().goToStep(3);
    const persisted = sessionStorage.getItem(STORAGE_KEY);
    getState().exit();
    sessionStorage.setItem(STORAGE_KEY, persisted ?? '');

    expect(isTourMockActive()).toBe(false);

    await useProductTourStore.persist.rehydrate();

    expect(getState()).toMatchObject({ isActive: true, stepIndex: 3 });
    expect(isTourMockActive()).toBe(true);
  });
});
