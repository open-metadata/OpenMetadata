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
import { Paging } from '../../generated/type/paging';
import { useCursorPageJump } from './useCursorPageJump';

describe('useCursorPageJump', () => {
  it('opens page 1 with no cursor and goes back with the next page before', async () => {
    const fetchPaging = jest.fn();
    const { result } = renderHook(() => useCursorPageJump(fetchPaging));

    act(() => {
      result.current.remember(1, { after: 'a2', total: 45 });
      result.current.remember(2, { after: 'a3', before: 'b1', total: 45 });
      result.current.remember(3, { before: 'b2', total: 45 });
    });

    await expect(result.current.cursorFor(1, 3)).resolves.toEqual({});
    await expect(result.current.cursorFor(2, 3)).resolves.toEqual({
      before: 'b2',
    });
    expect(fetchPaging).not.toHaveBeenCalled();
  });

  it('walks the unvisited pages before a forward jump', async () => {
    const fetchPaging = jest
      .fn()
      .mockResolvedValueOnce({ after: 'a3', total: 60 })
      .mockResolvedValueOnce({ after: 'a4', total: 60 });
    const { result } = renderHook(() => useCursorPageJump(fetchPaging));

    act(() => result.current.remember(1, { after: 'a2', total: 60 }));

    await expect(result.current.cursorFor(4, 1)).resolves.toEqual({
      after: 'a4',
    });
    expect(fetchPaging.mock.calls).toEqual([['a2'], ['a3']]);
  });

  it('forgets cursors on reset, so a jump cannot use a stale list', async () => {
    const fetchPaging = jest.fn();
    const { result } = renderHook(() => useCursorPageJump(fetchPaging));

    act(() => {
      result.current.remember(1, { after: 'a2', total: 30 });
      result.current.reset();
    });

    await expect(result.current.cursorFor(2, 1)).resolves.toBeUndefined();
  });

  it('drops a jump that a newer one replaced', async () => {
    const pending: Array<(paging: Paging) => void> = [];
    const fetchPaging = jest.fn(
      () => new Promise<Paging>((resolve) => pending.push(resolve))
    );
    const { result } = renderHook(() => useCursorPageJump(fetchPaging));
    act(() => result.current.remember(1, { after: 'a2', total: 90 }));

    const slow = result.current.cursorFor(3, 1);
    const fresh = result.current.cursorFor(1, 1);
    pending.forEach((resolve) => resolve({ after: 'a3', total: 90 }));

    await expect(slow).resolves.toBeUndefined();
    await expect(fresh).resolves.toEqual({});
  });
});
