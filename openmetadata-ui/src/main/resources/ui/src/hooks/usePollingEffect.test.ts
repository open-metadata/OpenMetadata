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
import { usePollingEffect } from './usePollingEffect';

describe('usePollingEffect', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('invokes the callback on each interval while enabled', () => {
    const callback = jest.fn();
    renderHook(() =>
      usePollingEffect(callback, { enabled: true, intervalMs: 1000 })
    );

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('does not invoke the callback when disabled', () => {
    const callback = jest.fn();
    renderHook(() =>
      usePollingEffect(callback, { enabled: false, intervalMs: 1000 })
    );

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('stops polling when enabled flips to false', () => {
    const callback = jest.fn();
    const { rerender } = renderHook(
      ({ enabled }) =>
        usePollingEffect(callback, { enabled, intervalMs: 1000 }),
      { initialProps: { enabled: true } }
    );

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(callback).toHaveBeenCalledTimes(2);

    rerender({ enabled: false });

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('clears the timer on unmount', () => {
    const callback = jest.fn();
    const { unmount } = renderHook(() =>
      usePollingEffect(callback, { enabled: true, intervalMs: 1000 })
    );

    unmount();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('skips a tick while the previous async callback is still in flight', async () => {
    let resolveFirst: () => void = () => undefined;
    const callback = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValue(undefined);

    renderHook(() =>
      usePollingEffect(callback, { enabled: true, intervalMs: 1000 })
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // First call started but hasn't resolved.
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Still 1 — overlapping ticks are skipped while the first is in flight.
    expect(callback).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst();
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });
});
