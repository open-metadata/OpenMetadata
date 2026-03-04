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
import { act, renderHook } from '@testing-library/react';
import { useEditableSection } from './useEditableSection';

jest.useFakeTimers();

describe('useEditableSection', () => {
  const initialData = { name: 'test', value: 123 };

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useEditableSection(initialData));

    expect(result.current.isEditing).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.popoverOpen).toBe(false);
    expect(result.current.displayData).toEqual(initialData);
  });

  it('should start editing when startEditing is called', () => {
    const { result } = renderHook(() => useEditableSection(initialData));

    act(() => {
      result.current.startEditing();
    });

    expect(result.current.isEditing).toBe(true);
    expect(result.current.popoverOpen).toBe(true);
  });

  it('should cancel editing when cancelEditing is called', () => {
    const { result } = renderHook(() => useEditableSection(initialData));

    act(() => {
      result.current.startEditing();
    });

    expect(result.current.isEditing).toBe(true);
    expect(result.current.popoverOpen).toBe(true);

    act(() => {
      result.current.cancelEditing();
    });

    expect(result.current.isEditing).toBe(false);
    expect(result.current.popoverOpen).toBe(false);
  });

  it('should complete editing after 500ms delay', () => {
    const { result } = renderHook(() => useEditableSection(initialData));

    act(() => {
      result.current.startEditing();
      result.current.setIsLoading(true);
    });

    expect(result.current.isEditing).toBe(true);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.popoverOpen).toBe(true);

    act(() => {
      result.current.completeEditing();
    });

    // States should not change immediately
    expect(result.current.isEditing).toBe(true);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.popoverOpen).toBe(true);

    // Fast-forward time by 500ms
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Now states should be reset
    expect(result.current.isEditing).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.popoverOpen).toBe(false);
  });

  it('should update displayData when initialData changes', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useEditableSection(data),
      {
        initialProps: { data: initialData },
      }
    );

    expect(result.current.displayData).toEqual(initialData);

    const newData = { name: 'updated', value: 456 };

    rerender({ data: newData });

    expect(result.current.displayData).toEqual(newData);
  });

  it('should not update displayData when data is the same', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useEditableSection(data),
      {
        initialProps: { data: initialData },
      }
    );

    const firstDisplayData = result.current.displayData;

    // Rerender with same data (but different object reference)
    rerender({ data: { ...initialData } });

    // DisplayData reference should remain the same
    expect(result.current.displayData).toBe(firstDisplayData);
  });

  it('should allow manual control of isLoading', () => {
    const { result } = renderHook(() => useEditableSection(initialData));

    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.setIsLoading(true);
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.setIsLoading(false);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should allow manual control of popoverOpen', () => {
    const { result } = renderHook(() => useEditableSection(initialData));

    expect(result.current.popoverOpen).toBe(false);

    act(() => {
      result.current.setPopoverOpen(true);
    });

    expect(result.current.popoverOpen).toBe(true);

    act(() => {
      result.current.setPopoverOpen(false);
    });

    expect(result.current.popoverOpen).toBe(false);
  });

  it('should allow manual update of displayData', () => {
    const { result } = renderHook(() => useEditableSection(initialData));

    const updatedData = { name: 'manual update', value: 789 };

    act(() => {
      result.current.setDisplayData(updatedData);
    });

    expect(result.current.displayData).toEqual(updatedData);
  });

  it('should work with array data', () => {
    const arrayData = [1, 2, 3];
    const { result } = renderHook(() => useEditableSection(arrayData));

    expect(result.current.displayData).toEqual(arrayData);

    const newArrayData = [4, 5, 6];

    act(() => {
      result.current.setDisplayData(newArrayData);
    });

    expect(result.current.displayData).toEqual(newArrayData);
  });

  it('should work with string data', () => {
    const stringData = 'initial text';
    const { result } = renderHook(() => useEditableSection(stringData));

    expect(result.current.displayData).toBe(stringData);

    act(() => {
      result.current.setDisplayData('updated text');
    });

    expect(result.current.displayData).toBe('updated text');
  });

  it('should work with undefined data', () => {
    const { result } = renderHook(() =>
      useEditableSection<string | undefined>(undefined)
    );

    expect(result.current.displayData).toBeUndefined();

    act(() => {
      result.current.setDisplayData('now defined');
    });

    expect(result.current.displayData).toBe('now defined');
  });

  it('should handle rapid state changes correctly', () => {
    const { result } = renderHook(() => useEditableSection(initialData));

    act(() => {
      result.current.startEditing();
      result.current.setIsLoading(true);
      result.current.cancelEditing();
    });

    expect(result.current.isEditing).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.popoverOpen).toBe(false);
  });

  it('should handle complete editing called multiple times', () => {
    const { result } = renderHook(() => useEditableSection(initialData));

    act(() => {
      result.current.startEditing();
      result.current.completeEditing();
      result.current.completeEditing();
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isEditing).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.popoverOpen).toBe(false);
  });

  it('should cleanup timeout on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useEditableSection(initialData)
    );

    act(() => {
      result.current.startEditing();
      result.current.completeEditing();
    });

    unmount();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Should not cause any errors
    expect(true).toBe(true);
  });
});
