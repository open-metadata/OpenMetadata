/*
 *  Copyright 2023 Collate.
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
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseRovingFocusOptions {
  initialIndex?: number;
  vertical?: boolean;
  onSelect?: (index: number) => void;
  totalItems: number;
}

export function useRovingFocus({
  initialIndex = 0,
  vertical = true,
  onSelect,
  totalItems,
}: UseRovingFocusOptions) {
  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), totalItems - 1)
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  const moveFocus = (delta: number) => {
    setFocusedIndex((prev) => {
      const next = prev + delta;
      if (next < 0) {
        return 0;
      }
      if (next >= totalItems) {
        return totalItems - 1;
      }

      return next;
    });
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container || totalItems === 0) {
        return;
      }

      const target = e.target as HTMLElement;
      if (!target.dataset.rovingItem) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          if (vertical ? e.key === 'ArrowDown' : e.key === 'ArrowRight') {
            e.preventDefault();
            moveFocus(1);
          }

          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          if (vertical ? e.key === 'ArrowUp' : e.key === 'ArrowLeft') {
            e.preventDefault();
            moveFocus(-1);
          }

          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect?.(focusedIndex);

          break;
      }
    },
    [focusedIndex, totalItems, vertical, onSelect]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    container.addEventListener('keydown', handleKeyDown);

    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const current = container.querySelector<HTMLElement>(
      `[data-roving-index="${focusedIndex}"]`
    );
    current?.focus();
  }, [focusedIndex, totalItems]);

  useEffect(() => {
    // Reset if current focus index is invalid
    if (focusedIndex >= totalItems && totalItems > 0) {
      setFocusedIndex(totalItems - 1);
    } else if (focusedIndex < 0 && totalItems > 0) {
      setFocusedIndex(0);
    }
  }, [totalItems]);

  const getItemProps = (index: number) => ({
    tabIndex: focusedIndex === index ? 0 : -1,
    'data-roving-item': 'true',
    'data-roving-index': index,
    onFocus: () => setFocusedIndex(index),
  });

  return {
    containerRef,
    focusedIndex,
    setFocusedIndex,
    getItemProps,
  };
}
