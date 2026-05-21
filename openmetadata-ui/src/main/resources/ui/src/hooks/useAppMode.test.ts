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

import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import {
  APP_MODE_CHANGE_EVENT,
  APP_MODE_STORAGE_KEY,
  DEFAULT_APP_MODE,
} from '../constants/appMode.constants';
import { clearAppMode, useAppMode, writeAppMode } from './useAppMode';

const dispatchStorageEvent = (key: string, newValue: string | null) => {
  globalThis.window.dispatchEvent(
    new StorageEvent('storage', { key, newValue })
  );
};

describe('useAppMode hook', () => {
  beforeEach(() => {
    globalThis.window.localStorage.clear();
  });

  it('returns the DEFAULT_APP_MODE when no value is persisted', () => {
    const { result } = renderHook(() => useAppMode());

    expect(result.current).toBe(DEFAULT_APP_MODE);
  });

  it('returns the persisted value when one is stored in localStorage', () => {
    globalThis.window.localStorage.setItem(APP_MODE_STORAGE_KEY, 'ai');

    const { result } = renderHook(() => useAppMode());

    expect(result.current).toBe('ai');
  });

  it('re-renders subscribers when writeAppMode dispatches a same-tab change', () => {
    const { result } = renderHook(() => useAppMode());

    expect(result.current).toBe(DEFAULT_APP_MODE);

    act(() => {
      writeAppMode('ai');
    });

    expect(result.current).toBe('ai');
  });

  it('re-renders subscribers when a cross-tab storage event fires for the mode key', () => {
    const { result } = renderHook(() => useAppMode());

    act(() => {
      globalThis.window.localStorage.setItem(APP_MODE_STORAGE_KEY, 'preview');
      dispatchStorageEvent(APP_MODE_STORAGE_KEY, 'preview');
    });

    expect(result.current).toBe('preview');
  });

  it('ignores storage events for unrelated keys', () => {
    const { result } = renderHook(() => useAppMode());
    const renderCountBefore = result.all.length;

    act(() => {
      globalThis.window.localStorage.setItem('unrelated-key', 'whatever');
      dispatchStorageEvent('unrelated-key', 'whatever');
    });

    expect(result.current).toBe(DEFAULT_APP_MODE);
    expect(result.all.length).toBe(renderCountBefore);
  });

  it('removes its window listeners on unmount', () => {
    const removeSpy = jest.spyOn(globalThis.window, 'removeEventListener');

    const { unmount } = renderHook(() => useAppMode());
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith(
      APP_MODE_CHANGE_EVENT,
      expect.any(Function)
    );

    removeSpy.mockRestore();
  });
});

describe('writeAppMode', () => {
  beforeEach(() => {
    globalThis.window.localStorage.clear();
  });

  it('writes the new mode to localStorage', () => {
    writeAppMode('ai');

    expect(globalThis.window.localStorage.getItem(APP_MODE_STORAGE_KEY)).toBe(
      'ai'
    );
  });

  it('dispatches a same-tab custom event so subscribers can react', () => {
    const handler = jest.fn();
    globalThis.window.addEventListener(APP_MODE_CHANGE_EVENT, handler);

    writeAppMode('ai');

    expect(handler).toHaveBeenCalledTimes(1);

    globalThis.window.removeEventListener(APP_MODE_CHANGE_EVENT, handler);
  });

  it('no-ops (no event, no write) if the value would not change', () => {
    globalThis.window.localStorage.setItem(APP_MODE_STORAGE_KEY, 'ai');
    const handler = jest.fn();
    globalThis.window.addEventListener(APP_MODE_CHANGE_EVENT, handler);
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    writeAppMode('ai');

    expect(handler).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
    globalThis.window.removeEventListener(APP_MODE_CHANGE_EVENT, handler);
  });
});

describe('clearAppMode', () => {
  beforeEach(() => {
    globalThis.window.localStorage.clear();
  });

  it('removes the mode key from localStorage', () => {
    globalThis.window.localStorage.setItem(APP_MODE_STORAGE_KEY, 'ai');

    clearAppMode();

    expect(
      globalThis.window.localStorage.getItem(APP_MODE_STORAGE_KEY)
    ).toBeNull();
  });

  it('dispatches a same-tab custom event carrying the default mode', () => {
    const handler = jest.fn();
    globalThis.window.addEventListener(APP_MODE_CHANGE_EVENT, handler);

    clearAppMode();

    expect(handler).toHaveBeenCalledTimes(1);

    const event = handler.mock.calls[0][0] as CustomEvent<{ mode: string }>;

    expect(event.detail.mode).toBe(DEFAULT_APP_MODE);

    globalThis.window.removeEventListener(APP_MODE_CHANGE_EVENT, handler);
  });
});
