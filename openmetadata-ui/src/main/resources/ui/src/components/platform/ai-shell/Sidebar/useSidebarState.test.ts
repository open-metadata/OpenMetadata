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
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  useMainCollapse,
} from './useSidebarState';

const renderMain = (inSubMode = false, contextKey: string | null = null) =>
  renderHook(({ sub, key }) => useMainCollapse(sub, key), {
    initialProps: { sub: inSubMode, key: contextKey },
  });

describe('useMainCollapse', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('top level (no sub-nav)', () => {
    it('defaults to expanded when nothing is persisted', () => {
      expect(renderMain(false).result.current[0]).toBe(false);
    });

    it('starts from the persisted preference', () => {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true');

      expect(renderMain(false).result.current[0]).toBe(true);
    });

    it('persists an explicit toggle', () => {
      const { result } = renderMain(false);

      act(() => result.current[1]());

      expect(result.current[0]).toBe(true);
      expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true');
    });

    it('persists an explicit set', () => {
      const { result } = renderMain(false);

      act(() => result.current[2](true));

      expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true');
    });
  });

  describe('inside a sub-context', () => {
    it('always starts collapsed, ignoring a persisted-expanded preference', () => {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'false');

      expect(renderMain(true, 'observability').result.current[0]).toBe(true);
    });

    it('does not persist a toggle made in a sub-context', () => {
      const { result } = renderMain(true, 'observability');

      // starts collapsed → toggle expands transiently
      act(() => result.current[1]());

      expect(result.current[0]).toBe(false);
      expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBeNull();
    });

    it('re-collapses (rails) when the active sub-context changes', () => {
      const { result, rerender } = renderHook(
        ({ sub, key }) => useMainCollapse(sub, key),
        { initialProps: { sub: true, key: 'observability' } }
      );

      act(() => result.current[1]());

      expect(result.current[0]).toBe(false);

      rerender({ sub: true, key: 'context-center' });

      expect(result.current[0]).toBe(true);
    });
  });

  describe('crossing between top level and a sub-context', () => {
    it('rails on entering a sub-context, even with a persisted-expanded preference', () => {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'false');
      const { result, rerender } = renderHook(
        ({ sub, key }) => useMainCollapse(sub, key),
        { initialProps: { sub: false, key: null as string | null } }
      );

      expect(result.current[0]).toBe(false);

      rerender({ sub: true, key: 'observability' });

      expect(result.current[0]).toBe(true);
    });

    it('rails when inSubMode resolves true with the contextKey already set (direct load)', () => {
      // On a direct load / reload of a sub-context URL, the active module id is
      // known before its sub-nav resolves: inSubMode flips false→true while
      // contextKey stays the same. The main nav must still rail — regression for
      // the "main nav not visible" bug.
      const { result, rerender } = renderHook(
        ({ sub, key }) => useMainCollapse(sub, key),
        { initialProps: { sub: false, key: 'observability' as string | null } }
      );

      expect(result.current[0]).toBe(false);

      rerender({ sub: true, key: 'observability' });

      expect(result.current[0]).toBe(true);
    });

    it('restores the persisted preference on returning to the top level', () => {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true');
      const { result, rerender } = renderHook(
        ({ sub, key }) => useMainCollapse(sub, key),
        { initialProps: { sub: true, key: 'observability' as string | null } }
      );

      expect(result.current[0]).toBe(true);

      rerender({ sub: false, key: null });

      expect(result.current[0]).toBe(true);
    });
  });

  it('falls back to expanded when storage reads throw (e.g. private mode)', () => {
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });

    expect(renderMain(false).result.current[0]).toBe(false);

    getItem.mockRestore();
  });

  it('still updates state when storage writes throw', () => {
    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    const { result } = renderMain(false);

    act(() => result.current[1]());

    expect(result.current[0]).toBe(true);

    setItem.mockRestore();
  });
});
