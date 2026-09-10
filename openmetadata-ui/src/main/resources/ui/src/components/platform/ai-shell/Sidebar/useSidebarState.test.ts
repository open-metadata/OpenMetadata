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
  SUB_COLLAPSED_STORAGE_KEY,
  usePersistedCollapse,
} from './useSidebarState';

const renderCollapse = (
  key = SIDEBAR_COLLAPSED_STORAGE_KEY,
  defaultCollapsed = false
) => renderHook(() => usePersistedCollapse(key, defaultCollapsed));

describe('usePersistedCollapse', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('falls back to the default when nothing is persisted', () => {
    expect(renderCollapse().result.current[0]).toBe(false);
    expect(
      renderCollapse(SUB_COLLAPSED_STORAGE_KEY, true).result.current[0]
    ).toBe(true);
  });

  it('starts from the persisted value, which wins over the default', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true');

    expect(
      renderCollapse(SIDEBAR_COLLAPSED_STORAGE_KEY, false).result.current[0]
    ).toBe(true);

    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'false');

    expect(
      renderCollapse(SIDEBAR_COLLAPSED_STORAGE_KEY, true).result.current[0]
    ).toBe(false);
  });

  it('treats any non-"true" persisted value as expanded', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'invalid');

    expect(renderCollapse().result.current[0]).toBe(false);
  });

  it('toggles between collapsed and expanded', () => {
    const { result } = renderCollapse();

    act(() => result.current[1]());

    expect(result.current[0]).toBe(true);

    act(() => result.current[1]());

    expect(result.current[0]).toBe(false);
  });

  it('persists the new value on toggle', () => {
    const { result } = renderCollapse();

    act(() => result.current[1]());

    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true');

    act(() => result.current[1]());

    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('false');
  });

  it('sets and persists an explicit value', () => {
    const { result } = renderCollapse();

    act(() => result.current[2](true));

    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true');
  });

  it('keeps each panel on its own key', () => {
    const main = renderCollapse(SIDEBAR_COLLAPSED_STORAGE_KEY, false);

    act(() => main.result.current[1]());

    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true');
    expect(localStorage.getItem(SUB_COLLAPSED_STORAGE_KEY)).toBeNull();
    expect(
      renderCollapse(SUB_COLLAPSED_STORAGE_KEY, false).result.current[0]
    ).toBe(false);
  });

  it('falls back to the default when storage reads throw (e.g. private mode)', () => {
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });

    expect(
      renderCollapse(SIDEBAR_COLLAPSED_STORAGE_KEY, true).result.current[0]
    ).toBe(true);

    getItem.mockRestore();
  });

  it('still updates state when storage writes throw', () => {
    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    const { result } = renderCollapse();

    act(() => result.current[1]());

    expect(result.current[0]).toBe(true);

    setItem.mockRestore();
  });
});
