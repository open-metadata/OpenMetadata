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
// What one line of a line-mode wheel (Firefox's mouse wheel) scrolls.
const WHEEL_LINE_PX = 16;
// Over the pane's own sticky header.
const PINNED_BAR_Z_INDEX = '20';

const getScrollParent = (element: HTMLElement): HTMLElement | null => {
  let parent = element.parentElement;
  while (parent && !SCROLLABLE.test(getComputedStyle(parent).overflowY)) {
    parent = parent.parentElement;
  }

  return parent;
};

// How far the page can still scroll down.
const getRemainingScroll = (scrollParent: HTMLElement) =>
  scrollParent.scrollHeight -
  scrollParent.clientHeight -
  scrollParent.scrollTop;

// Sticks the bar to the top of the page; returns what puts it back.
const pinBar = (bar: HTMLElement) => {
  const { position, top, zIndex } = bar.style;
  Object.assign(bar.style, {
    position: 'sticky',
    top: '0',
    zIndex: PINNED_BAR_Z_INDEX,
  });

  return () => Object.assign(bar.style, { position, top, zIndex });
};

/**
 * Lets an element that scrolls inside itself sit in a page that scrolls too,
 * and read as one scroll:
 *
 * - The element is as tall as the page's scroll container, less the bar
 *   pinned above it (an entity page's tab bar): once the page has scrolled to
 *   its end, the bar sits at the top and the element fills the rest.
 * - Scrolling down over the element scrolls the page first, until it ends,
 *   then the element. Scrolling up hands back to the page by itself once the
 *   element is at its top.
 *
 * Follows the container (a window resize) and whatever sits above the element
 * (a header whose content arrives late). Below `minHeight` the page scrolls on.
 */
export const usePageScrollPane = (
  ref: RefObject<HTMLElement>,
  getPinnedBar?: (element: HTMLElement) => HTMLElement | null,
  // Short enough that a laptop window never scrolls the page past it.
  minHeight = 320
) => {
  useLayoutEffect(() => {
    const element = ref.current;
    const scrollParent = element && getScrollParent(element);
    if (!element || !scrollParent) {
      return;
    }
    const bar = getPinnedBar?.(element) ?? null;
    const unpinBar = bar ? pinBar(bar) : undefined;
    // The bar and the gap below it, read while the bar is in its place in
    // the page: once pinned, the element can scroll up against it.
    let barSpace = 0;

    const fit = () => {
      const parentTop = scrollParent.getBoundingClientRect().top;
      const top = element.getBoundingClientRect().top;
      const barTop = bar?.getBoundingClientRect().top;
      if (barTop !== undefined && barTop > parentTop) {
        barSpace = top - barTop;
      }
      // Padding or a footer the page holds below the element.
      const below =
        scrollParent.scrollHeight -
        (top - parentTop + scrollParent.scrollTop) -
        element.offsetHeight;
      element.style.height = `${Math.max(
        minHeight,
        scrollParent.clientHeight - barSpace - below
      )}px`;
    };

    const handleWheel = (event: WheelEvent) => {
      const remaining = getRemainingScroll(scrollParent);
      if (event.deltaY <= 0 || remaining < 1 || event.ctrlKey) {
        return;
      }
      event.preventDefault();
      const lineHeight =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PX : 1;
      scrollParent.scrollTop += Math.min(event.deltaY * lineHeight, remaining);
    };

    // Resizing inside the observer's callback resizes an observed child, which
    // the browser reports as a ResizeObserver loop; the next frame does not.
    let frame = 0;
    const scheduleFit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    fit();

    element.addEventListener('wheel', handleWheel, { passive: false });

    const observer = new ResizeObserver(scheduleFit);
    observer.observe(scrollParent);
    Array.from(scrollParent.children).forEach((child) =>
      observer.observe(child)
    );

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      element.removeEventListener('wheel', handleWheel);
      unpinBar?.();
      element.style.height = '';
    };
  }, [ref, getPinnedBar, minHeight]);
};
