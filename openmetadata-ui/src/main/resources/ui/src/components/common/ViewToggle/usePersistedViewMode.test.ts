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

import { act, renderHook } from '@testing-library/react';
import { usePersistedViewMode } from './usePersistedViewMode';
import { ViewMode } from './ViewToggle';

describe('usePersistedViewMode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the default view when nothing is stored yet', () => {
    const { result } = renderHook(() =>
      usePersistedViewMode('test.viewMode.v1', [ViewMode.Table, ViewMode.Card])
    );

    expect(result.current[0]).toBe(ViewMode.Table);
  });

  it('reads back a previously stored, valid view', () => {
    localStorage.setItem('test.viewMode.v1', ViewMode.Card);

    const { result } = renderHook(() =>
      usePersistedViewMode('test.viewMode.v1', [ViewMode.Table, ViewMode.Card])
    );

    expect(result.current[0]).toBe(ViewMode.Card);
  });

  it('falls back to the default when the stored view is outside the accepted views (e.g. stale from a different toggle)', () => {
    localStorage.setItem('test.viewMode.v1', ViewMode.Tree);

    const { result } = renderHook(() =>
      usePersistedViewMode('test.viewMode.v1', [ViewMode.Table, ViewMode.Card])
    );

    expect(result.current[0]).toBe(ViewMode.Table);
  });

  it('updates the returned view and writes through to localStorage when the setter is called', () => {
    const { result } = renderHook(() =>
      usePersistedViewMode('test.viewMode.v1', [ViewMode.Table, ViewMode.Card])
    );

    act(() => {
      result.current[1](ViewMode.Card);
    });

    expect(result.current[0]).toBe(ViewMode.Card);
    expect(localStorage.getItem('test.viewMode.v1')).toBe(ViewMode.Card);
  });

  it('persists the new view so a later mount under the same key reads it back', () => {
    const { result, unmount } = renderHook(() =>
      usePersistedViewMode('test.viewMode.v1', [ViewMode.Table, ViewMode.Card])
    );

    act(() => {
      result.current[1](ViewMode.Card);
    });
    unmount();

    const { result: secondMount } = renderHook(() =>
      usePersistedViewMode('test.viewMode.v1', [ViewMode.Table, ViewMode.Card])
    );

    expect(secondMount.current[0]).toBe(ViewMode.Card);
  });

  it('keeps two different storage keys fully independent', () => {
    const { result: first } = renderHook(() =>
      usePersistedViewMode('page-a.viewMode.v1', [
        ViewMode.Table,
        ViewMode.Card,
      ])
    );
    const { result: second } = renderHook(() =>
      usePersistedViewMode('page-b.viewMode.v1', [
        ViewMode.Table,
        ViewMode.Card,
      ])
    );

    act(() => {
      first.current[1](ViewMode.Card);
    });

    expect(first.current[0]).toBe(ViewMode.Card);
    expect(second.current[0]).toBe(ViewMode.Table);
    expect(localStorage.getItem('page-b.viewMode.v1')).toBeNull();
  });

  it('supports a three-view toggle (table/card/tree) via its own `views` list, with no change to the hook', () => {
    localStorage.setItem('domain.viewMode.v1', ViewMode.Tree);

    const { result } = renderHook(() =>
      usePersistedViewMode('domain.viewMode.v1', [
        ViewMode.Table,
        ViewMode.Card,
        ViewMode.Tree,
      ])
    );

    expect(result.current[0]).toBe(ViewMode.Tree);

    act(() => {
      result.current[1](ViewMode.Card);
    });

    expect(result.current[0]).toBe(ViewMode.Card);
    expect(localStorage.getItem('domain.viewMode.v1')).toBe(ViewMode.Card);
  });

  it('falls back to the default when localStorage.getItem throws (e.g. private browsing)', () => {
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });

    const { result } = renderHook(() =>
      usePersistedViewMode('test.viewMode.v1', [ViewMode.Table, ViewMode.Card])
    );

    expect(result.current[0]).toBe(ViewMode.Table);

    getItemSpy.mockRestore();
  });

  it('does not throw, and still updates the in-memory view, when localStorage.setItem throws', () => {
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

    const { result } = renderHook(() =>
      usePersistedViewMode('test.viewMode.v1', [ViewMode.Table, ViewMode.Card])
    );

    act(() => {
      result.current[1](ViewMode.Card);
    });

    expect(result.current[0]).toBe(ViewMode.Card);

    setItemSpy.mockRestore();
  });
});
