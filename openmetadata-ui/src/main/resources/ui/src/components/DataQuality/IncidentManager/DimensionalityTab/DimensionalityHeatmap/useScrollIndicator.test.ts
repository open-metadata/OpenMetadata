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
import { useScrollIndicator } from './useScrollIndicator.hook';

describe('useScrollIndicator', () => {
  let mockContainer: HTMLDivElement;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    Object.defineProperty(mockContainer, 'scrollWidth', {
      writable: true,
      value: 1000,
    });
    Object.defineProperty(mockContainer, 'clientWidth', {
      writable: true,
      value: 500,
    });
    Object.defineProperty(mockContainer, 'scrollLeft', {
      writable: true,
      value: 0,
    });

    mockContainer.scrollBy = jest.fn();

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should initialize with showLeftIndicator and showRightIndicator as false', () => {
    const containerRef = { current: null };
    const { result } = renderHook(() => useScrollIndicator(containerRef, []));

    expect(result.current.showLeftIndicator).toBe(false);
    expect(result.current.showRightIndicator).toBe(false);
  });

  it('should show right indicator when content is scrollable and at start', () => {
    const containerRef = { current: mockContainer };
    const { result } = renderHook(() => useScrollIndicator(containerRef, []));

    act(() => {
      jest.runAllTimers();
    });

    expect(result.current.showLeftIndicator).toBe(false);
    expect(result.current.showRightIndicator).toBe(true);
  });

  it('should hide both indicators when content is not scrollable', () => {
    Object.defineProperty(mockContainer, 'scrollWidth', { value: 500 });
    Object.defineProperty(mockContainer, 'clientWidth', { value: 500 });

    const containerRef = { current: mockContainer };
    const { result } = renderHook(() => useScrollIndicator(containerRef, []));

    act(() => {
      jest.runAllTimers();
    });

    expect(result.current.showLeftIndicator).toBe(false);
    expect(result.current.showRightIndicator).toBe(false);
  });

  it('should hide right indicator when at end of scroll', () => {
    Object.defineProperty(mockContainer, 'scrollLeft', { value: 495 });

    const containerRef = { current: mockContainer };
    const { result } = renderHook(() => useScrollIndicator(containerRef, []));

    act(() => {
      jest.runAllTimers();
    });

    expect(result.current.showLeftIndicator).toBe(true);
    expect(result.current.showRightIndicator).toBe(false);
  });

  it('should call scrollBy with correct parameters when handleScrollRight is called', () => {
    const containerRef = { current: mockContainer };
    const { result } = renderHook(() => useScrollIndicator(containerRef, []));

    act(() => {
      result.current.handleScrollRight();
    });

    expect(mockContainer.scrollBy).toHaveBeenCalledWith({
      left: 300,
      behavior: 'smooth',
    });
  });

  it('should call scrollBy with correct parameters when handleScrollLeft is called', () => {
    const containerRef = { current: mockContainer };
    const { result } = renderHook(() => useScrollIndicator(containerRef, []));

    act(() => {
      result.current.handleScrollLeft();
    });

    expect(mockContainer.scrollBy).toHaveBeenCalledWith({
      left: -300,
      behavior: 'smooth',
    });
  });

  it('should not throw error when handleScrollRight is called with null ref', () => {
    const containerRef = { current: null };
    const { result } = renderHook(() => useScrollIndicator(containerRef, []));

    expect(() => {
      act(() => {
        result.current.handleScrollRight();
      });
    }).not.toThrow();
  });

  it('should not throw error when handleScrollLeft is called with null ref', () => {
    const containerRef = { current: null };
    const { result } = renderHook(() => useScrollIndicator(containerRef, []));

    expect(() => {
      act(() => {
        result.current.handleScrollLeft();
      });
    }).not.toThrow();
  });

  it('should add and remove is-scrolling class on scroll', () => {
    const containerRef = { current: mockContainer };
    renderHook(() => useScrollIndicator(containerRef, []));

    const scrollEvent = new Event('scroll');
    mockContainer.dispatchEvent(scrollEvent);

    expect(mockContainer.classList.contains('is-scrolling')).toBe(true);

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(mockContainer.classList.contains('is-scrolling')).toBe(false);
  });

  it('should remove is-scrolling class on unmount', () => {
    const containerRef = { current: mockContainer };
    const { unmount } = renderHook(() => useScrollIndicator(containerRef, []));

    const scrollEvent = new Event('scroll');
    mockContainer.dispatchEvent(scrollEvent);

    expect(mockContainer.classList.contains('is-scrolling')).toBe(true);

    unmount();

    expect(mockContainer.classList.contains('is-scrolling')).toBe(false);
  });

  it('should update when dependencies change', () => {
    const containerRef = { current: mockContainer };
    const { result, rerender } = renderHook(
      ({ deps }) => useScrollIndicator(containerRef, deps),
      { initialProps: { deps: ['dependency1'] } }
    );

    act(() => {
      jest.runAllTimers();
    });

    expect(result.current.showRightIndicator).toBe(true);

    Object.defineProperty(mockContainer, 'scrollWidth', { value: 500 });
    Object.defineProperty(mockContainer, 'clientWidth', { value: 500 });

    rerender({ deps: ['dependency2'] });

    act(() => {
      jest.runAllTimers();
    });

    expect(result.current.showLeftIndicator).toBe(false);
    expect(result.current.showRightIndicator).toBe(false);
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(
      mockContainer,
      'removeEventListener'
    );
    const windowRemoveEventListenerSpy = jest.spyOn(
      window,
      'removeEventListener'
    );

    const containerRef = { current: mockContainer };
    const { unmount } = renderHook(() => useScrollIndicator(containerRef, []));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function)
    );
    expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
  });
});
