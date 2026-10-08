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
import { RefObject, useLayoutEffect } from 'react';

const SCROLLABLE = /(auto|scroll)/;

const getScrollParent = (element: HTMLElement): HTMLElement | null => {
  let parent = element.parentElement;
  while (parent && !SCROLLABLE.test(getComputedStyle(parent).overflowY)) {
    parent = parent.parentElement;
  }

  return parent;
};

// The height that ends the element at the bottom of its scroll container: its
// space from its top to the container's bottom, less whatever still overflows
// below it (padding, a footer) once it is that tall. The element must clip its
// own content, or content spilling out of it reads as space taken below.
const fitToScrollParent = (
  element: HTMLElement,
  scrollParent: HTMLElement,
  minHeight: number
) => {
  const parentRect = scrollParent.getBoundingClientRect();
  const offset =
    element.getBoundingClientRect().top -
    parentRect.top +
    scrollParent.scrollTop;
  element.style.height = `${Math.max(
    minHeight,
    scrollParent.clientHeight - offset
  )}px`;
  const overflow = scrollParent.scrollHeight - scrollParent.clientHeight;
  if (overflow > 0) {
    element.style.height = `${Math.max(
      minHeight,
      element.offsetHeight - overflow
    )}px`;
  }
};

/**
 * Sizes an element to fill what is left of its scroll container below it, so
 * the element scrolls inside itself instead of growing the page. Follows the
 * container (a window resize) and whatever sits above the element (a header
 * whose content arrives late). Below `minHeight` the page scrolls instead.
 */
export const useFillAvailableHeight = (
  ref: RefObject<HTMLElement>,
  // Short enough that a laptop window never scrolls the page.
  minHeight = 320
) => {
  useLayoutEffect(() => {
    const element = ref.current;
    const scrollParent = element && getScrollParent(element);
    if (!element || !scrollParent) {
      return;
    }
    const fit = () => fitToScrollParent(element, scrollParent, minHeight);
    // Resizing inside the observer's callback resizes an observed child, which
    // the browser reports as a ResizeObserver loop; the next frame does not.
    let frame = 0;
    const scheduleFit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    fit();

    const observer = new ResizeObserver(scheduleFit);
    observer.observe(scrollParent);
    Array.from(scrollParent.children).forEach((child) =>
      observer.observe(child)
    );

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      element.style.height = '';
    };
  }, [ref, minHeight]);
};
