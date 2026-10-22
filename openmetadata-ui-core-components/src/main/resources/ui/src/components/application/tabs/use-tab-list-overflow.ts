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
import type { Key } from 'react';
import { type RefObject, useCallback, useEffect, useState } from 'react';

// A sub-pixel remainder is not overflow, so it must not show the controls.
const EDGE_TOLERANCE = 1;
// Leave part of the previous view on screen so the user keeps their place.
const SCROLL_STEP_RATIO = 0.8;

export interface TabListOverflow {
  isOverflowing: boolean;
  canScrollStart: boolean;
  canScrollEnd: boolean;
  scrollByPage: (direction: -1 | 1) => void;
}

/**
 * Tracks whether a horizontal tab list overflows its container and keeps the
 * selected tab in view, so tabs past the edge stay reachable with a mouse.
 * ponytail: assumes left-to-right; mirror `direction` if RTL layouts land.
 */
export const useTabListOverflow = (
  ref: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  selectedKey?: Key | null
): TabListOverflow => {
  const [overflow, setOverflow] = useState({
    isOverflowing: false,
    canScrollStart: false,
    canScrollEnd: false,
  });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    const next = {
      isOverflowing: maxScroll > EDGE_TOLERANCE,
      canScrollStart: el.scrollLeft > EDGE_TOLERANCE,
      canScrollEnd: el.scrollLeft < maxScroll - EDGE_TOLERANCE,
    };
    setOverflow((prev) =>
      prev.isOverflowing === next.isOverflowing &&
      prev.canScrollStart === next.canScrollStart &&
      prev.canScrollEnd === next.canScrollEnd
        ? prev
        : next
    );
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) {
      return undefined;
    }
    el.addEventListener('scroll', measure, { passive: true });
    // Tabs can change width after mount (counts load, labels translate), and
    // tabs can be added later (e.g. once permissions load) without the list
    // itself resizing, so observe each tab and re-run when the set changes.
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
    const observeTabs = () => {
      Array.from(el.children).forEach((child) => resizeObserver.observe(child));
      measure();
    };
    observeTabs();
    const mutationObserver = new MutationObserver(observeTabs);
    mutationObserver.observe(el, { childList: true });

    return () => {
      el.removeEventListener('scroll', measure);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [enabled, measure, ref]);

  // Only an overflowing list can hide the selected tab, e.g. a deep link to
  // the last tab.
  useEffect(() => {
    if (!enabled || !overflow.isOverflowing) {
      return;
    }
    ref.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [enabled, overflow.isOverflowing, ref, selectedKey]);

  const scrollByPage = useCallback(
    (direction: -1 | 1) => {
      const el = ref.current;
      el?.scrollBy({
        left: direction * el.clientWidth * SCROLL_STEP_RATIO,
        behavior: 'smooth',
      });
    },
    [ref]
  );

  return { ...overflow, scrollByPage };
};
