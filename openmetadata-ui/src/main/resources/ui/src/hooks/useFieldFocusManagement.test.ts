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
import { useFieldFocusManagement } from './useFieldFocusManagement';

describe('useFieldFocusManagement', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should set the active field and meta after the focus delay', () => {
    const { result } = renderHook(() => useFieldFocusManagement());

    act(() => {
      result.current.handleFieldFocus('root/hostPort', { title: 'Host' });
    });

    expect(result.current.activeField).toBe('');

    act(() => {
      jest.advanceTimersByTime(50);
    });

    expect(result.current.activeField).toBe('root/hostPort');
    expect(result.current.activeFieldMeta).toEqual({ title: 'Host' });
  });

  it('should ignore focus calls with an empty field name', () => {
    const { result } = renderHook(() => useFieldFocusManagement());

    act(() => {
      result.current.handleFieldFocus('');
      jest.runAllTimers();
    });

    expect(result.current.activeField).toBe('');
  });

  it('should cancel a pending blur when focus follows immediately', () => {
    const { result } = renderHook(() => useFieldFocusManagement());

    act(() => {
      result.current.handleFieldFocus('root/hostPort');
      jest.advanceTimersByTime(50);
    });

    act(() => {
      result.current.handleFieldBlur();
      jest.advanceTimersByTime(20);
      result.current.handleFieldFocus('root/username');
      jest.runAllTimers();
    });

    expect(result.current.activeField).toBe('root/username');
  });

  it('should not apply a stale focus after a newer focus', () => {
    const { result } = renderHook(() => useFieldFocusManagement());

    act(() => {
      result.current.handleFieldFocus('root/first');
      jest.advanceTimersByTime(20);
      result.current.handleFieldFocus('root/second');
      jest.runAllTimers();
    });

    expect(result.current.activeField).toBe('root/second');
  });

  it('should clear the active field after the blur delay', () => {
    const { result } = renderHook(() => useFieldFocusManagement());

    act(() => {
      result.current.handleFieldFocus('root/hostPort', { title: 'Host' });
      jest.advanceTimersByTime(50);
    });

    act(() => {
      result.current.handleFieldBlur();
      jest.advanceTimersByTime(100);
    });

    expect(result.current.activeField).toBe('');
    expect(result.current.activeFieldMeta).toBeUndefined();
  });

  it('should keep a single pending timer across rapid blur calls', () => {
    const { result } = renderHook(() => useFieldFocusManagement());

    act(() => {
      result.current.handleFieldBlur();
      jest.advanceTimersByTime(50);
      result.current.handleFieldBlur();
    });

    expect(jest.getTimerCount()).toBe(1);
  });

  it('should cancel any pending timer and set the field immediately on reset', () => {
    const { result } = renderHook(() => useFieldFocusManagement());

    act(() => {
      result.current.handleFieldFocus('root/stale');
      result.current.resetActiveField('serviceName');
      jest.runAllTimers();
    });

    expect(result.current.activeField).toBe('serviceName');
    expect(result.current.activeFieldMeta).toBeUndefined();
  });

  it('should clear the pending timer on unmount', () => {
    const { result, unmount } = renderHook(() => useFieldFocusManagement());

    act(() => {
      result.current.handleFieldFocus('root/hostPort');
    });

    unmount();

    expect(jest.getTimerCount()).toBe(0);
  });
});
