/*
 *  Copyright 2025 Collate.
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
import { emitIntent, useIntent } from './useIntent';

const ADD_TEST_CASE = 'add-test-case';

describe('useIntent / emitIntent', () => {
  it('fires the registered handler when its intent is emitted', () => {
    const handler = jest.fn();
    renderHook(() => useIntent(ADD_TEST_CASE, handler));

    emitIntent(ADD_TEST_CASE);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire when a different intent is emitted', () => {
    const handler = jest.fn();
    renderHook(() => useIntent(ADD_TEST_CASE, handler));

    emitIntent('something-else');

    expect(handler).not.toHaveBeenCalled();
  });

  it('runs every emit (not just the first)', () => {
    const handler = jest.fn();
    renderHook(() => useIntent(ADD_TEST_CASE, handler));

    emitIntent(ADD_TEST_CASE);
    emitIntent(ADD_TEST_CASE);
    emitIntent(ADD_TEST_CASE);

    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('always invokes the latest handler closure', () => {
    let capturedValue = 0;
    let value = 1;
    const { rerender } = renderHook(() =>
      useIntent(ADD_TEST_CASE, () => {
        capturedValue = value;
      })
    );

    value = 42;
    rerender();
    emitIntent(ADD_TEST_CASE);

    expect(capturedValue).toBe(42);
  });

  it('drops emits dispatched while no listener is registered', () => {
    // Sanity: emit-then-mount should NOT fire (this isn't a buffer).
    const handler = jest.fn();
    emitIntent(ADD_TEST_CASE);
    renderHook(() => useIntent(ADD_TEST_CASE, handler));

    expect(handler).not.toHaveBeenCalled();
  });

  it('cleans up listeners on unmount', () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() => useIntent(ADD_TEST_CASE, handler));

    unmount();
    emitIntent(ADD_TEST_CASE);

    expect(handler).not.toHaveBeenCalled();
  });

  it('only the most recent subscriber wins (top of the stack)', () => {
    // Never every subscriber — a double-subscription can't open two drawers.
    const a = jest.fn();
    const b = jest.fn();
    renderHook(() => useIntent(ADD_TEST_CASE, a));
    renderHook(() => useIntent(ADD_TEST_CASE, b));

    emitIntent(ADD_TEST_CASE);

    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });

  it('leaves the intent unhandled once the top subscriber unmounts', () => {
    // Only one listener exists per intent, so an instance that mounted on top
    // of a kept-alive host owns the slot and clears it on unmount.
    const cachedPage = jest.fn();
    const detailRoute = jest.fn();
    renderHook(() => useIntent(ADD_TEST_CASE, cachedPage));
    const { unmount } = renderHook(() => useIntent(ADD_TEST_CASE, detailRoute));

    unmount();
    emitIntent(ADD_TEST_CASE);

    expect(cachedPage).not.toHaveBeenCalled();
    expect(detailRoute).not.toHaveBeenCalled();
  });

  it('lets a kept-alive host re-claim the slot when its reregister key changes', () => {
    const cachedPage = jest.fn();
    const detailRoute = jest.fn();
    const { rerender } = renderHook(
      ({ epoch }: { epoch: number }) =>
        useIntent(ADD_TEST_CASE, cachedPage, epoch),
      { initialProps: { epoch: 0 } }
    );
    const detail = renderHook(() => useIntent(ADD_TEST_CASE, detailRoute));

    detail.unmount();
    // The host becomes the active route again: a new epoch re-registers it.
    rerender({ epoch: 1 });
    emitIntent(ADD_TEST_CASE);

    expect(cachedPage).toHaveBeenCalledTimes(1);
    expect(detailRoute).not.toHaveBeenCalled();
  });

  it('unmounting a clobbered subscriber does not wipe out the newer one', () => {
    const bottom = jest.fn();
    const top = jest.fn();
    const { unmount: unmountBottom } = renderHook(() =>
      useIntent(ADD_TEST_CASE, bottom)
    );
    renderHook(() => useIntent(ADD_TEST_CASE, top));

    unmountBottom();
    emitIntent(ADD_TEST_CASE);

    expect(top).toHaveBeenCalledTimes(1);
    expect(bottom).not.toHaveBeenCalled();
  });
});
