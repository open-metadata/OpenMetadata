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
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

// Fraction of the rail's visible width a pager click travels. Under 1 so the
// item at the edge stays partly visible and the scroll reads as continuous;
// the rail's scroll-snap settles it on the next item's start.
const RAIL_PAGE_FRACTION = 0.9;
// Sub-pixel slack: fractional item widths leave a fraction of a pixel of scroll
// left at either end, which would otherwise keep a pager button enabled forever.
const RAIL_SCROLL_EPSILON = 1;

export interface RailScrollState {
  next: boolean;
  previous: boolean;
}

export interface RailPager {
  railRef: RefObject<HTMLUListElement>;
  canScroll: RailScrollState;
  syncScrollState: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
}

/**
 * Paging for a horizontally scrolling, scroll-snapped list. Which pager
 * buttons are live is read off the element rather than tracked as an index,
 * so it stays correct however many items fit at the current width.
 *
 * `itemCount` re-measures the rail when its items change.
 */
export const useRailPager = (itemCount: number): RailPager => {
  const railRef = useRef<HTMLUListElement>(null);
  const [canScroll, setCanScroll] = useState<RailScrollState>({
    next: false,
    previous: false,
  });

  const syncScrollState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    const next = rail.scrollLeft < maxScrollLeft - RAIL_SCROLL_EPSILON;
    const previous = rail.scrollLeft > RAIL_SCROLL_EPSILON;
    // Smooth scrolling fires this every frame — hand back the same object when
    // nothing changed so React bails out instead of re-rendering the rail.
    setCanScroll((prev) =>
      prev.next === next && prev.previous === previous
        ? prev
        : { next, previous }
    );
  }, []);

  // Layout effect so the buttons are never painted in a stale enabled state
  // after the item list changes. ResizeObserver covers the page resizing us.
  useLayoutEffect(() => {
    syncScrollState();
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    const observer = new ResizeObserver(syncScrollState);
    observer.observe(rail);

    return () => observer.disconnect();
  }, [syncScrollState, itemCount]);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const rail = railRef.current;
    rail?.scrollBy?.({
      behavior: 'smooth',
      left: direction * rail.clientWidth * RAIL_PAGE_FRACTION,
    });
  }, []);

  const goToPrevious = useCallback(() => scrollByPage(-1), [scrollByPage]);
  const goToNext = useCallback(() => scrollByPage(1), [scrollByPage]);

  return { railRef, canScroll, syncScrollState, goToPrevious, goToNext };
};
