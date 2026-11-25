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
import { useEffect, useRef, useState } from 'react';

/**
 * Tracks which ends of a horizontally scrolling element hide content, so the
 * caller can draw an edge shadow there. Used where the scrollbar is hidden or
 * overlaid (macOS), and the shadow is the only sign that more content sits past
 * the edge: the card tab list and table custom property values.
 */
export const useOverflowEdges = (enabled: boolean) => {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const update = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end }
      );
    };
    // Observing the tabs too catches a count badge widening a tab.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    // Tabs added after mount can overflow the list without resizing it.
    const childObserver = new MutationObserver((records) => {
      records.forEach((record) =>
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            observer.observe(node);
          }
        })
      );
      update();
    });
    childObserver.observe(el, { childList: true });
    el.addEventListener('scroll', update, { passive: true });
    update();

    return () => {
      observer.disconnect();
      childObserver.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [enabled]);

  return { ref, edges };
};
