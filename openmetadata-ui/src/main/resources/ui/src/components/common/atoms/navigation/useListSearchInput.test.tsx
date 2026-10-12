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
import { useListSearchInput } from './useListSearchInput';

type Props = Parameters<typeof useListSearchInput>[0];

const renderSearch = (props: Props) =>
  renderHook((hookProps: Props) => useListSearchInput(hookProps), {
    initialProps: props,
  });

describe('useListSearchInput', () => {
  it('pushes a typed query once typing settles', () => {
    const onSearchChange = jest.fn();
    const { result } = renderSearch({ onSearchChange });

    act(() => result.current.handleChange('fin'));

    expect(onSearchChange).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onSearchChange).toHaveBeenCalledWith('fin');
  });

  it('keeps a pending push when the callback identity changes mid-debounce', () => {
    // A listing's callback is rebuilt on every URL change (react-router's
    // `setSearchParams`), which must not cancel the query being typed.
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = renderSearch({ onSearchChange: first });

    act(() => result.current.handleChange('fin'));
    rerender({ onSearchChange: second });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(second).toHaveBeenCalledWith('fin');
    expect(first).not.toHaveBeenCalled();
  });

  it('pushes only on submit when submitOnly is set', () => {
    const onSearchChange = jest.fn();
    const { result } = renderSearch({ onSearchChange, submitOnly: true });

    act(() => result.current.handleChange('domains owned by finance'));
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onSearchChange).not.toHaveBeenCalled();

    act(() => result.current.handleSubmit());

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('domains owned by finance');
  });

  it('drops a pending push when pushes become submit-only', () => {
    const onSearchChange = jest.fn();
    const { result, rerender } = renderSearch({ onSearchChange });

    act(() => result.current.handleChange('fin'));
    rerender({ onSearchChange, submitOnly: true });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onSearchChange).not.toHaveBeenCalled();
  });

  it('refreshes instead of pushing the same text again on submit', () => {
    const onSearchChange = jest.fn();
    const onRefresh = jest.fn();
    const { result } = renderSearch({
      searchQuery: 'fin',
      onSearchChange,
      onRefresh,
    });

    act(() => result.current.handleSubmit());

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onSearchChange).not.toHaveBeenCalled();
  });

  it('clears immediately, dropping a pending push', () => {
    const onSearchChange = jest.fn();
    const { result } = renderSearch({ onSearchChange });

    act(() => result.current.handleChange('fin'));
    act(() => result.current.handleClear());
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(result.current.searchInputValue).toBe('');
  });
});
