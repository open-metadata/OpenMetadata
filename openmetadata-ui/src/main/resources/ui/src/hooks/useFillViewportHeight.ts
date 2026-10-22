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
import { useLayoutEffect, useRef } from 'react';

const MIN_HEIGHT = 240;

/**
 * Sizes an element to the viewport space left below its top edge. A fixed
 * `calc(100vh - offset)` cannot follow content above it that changes height
 * (a filter bar wrapping to a second row, applied-filter chips), so the element
 * is measured instead. Re-measures when the viewport or the parent resizes.
 *
 * The height is written to the element's style rather than React state, so a
 * window drag never re-renders the page that owns the element, and bursts of
 * resize/observer events collapse to one measurement per animation frame.
 */
export const useFillViewportHeight = <T extends HTMLElement>(
  bottomGap = 16
) => {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next = `${Math.max(
        MIN_HEIGHT,
        Math.floor(
          window.innerHeight - element.getBoundingClientRect().top - bottomGap
        )
      )}px`;
      if (element.style.height !== next) {
        element.style.height = next;
      }
    };
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(measure);
      }
    };
    measure();
    window.addEventListener('resize', schedule);
    // Content above the element grows its parent and pushes its top down.
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(schedule);
    if (element.parentElement) {
      observer?.observe(element.parentElement);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
    };
  }, [bottomGap]);

  return ref;
};
