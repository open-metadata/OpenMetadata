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
import { useLayoutEffect, useRef, useState } from 'react';

// The boxes the element's text is laid out in, one per line fragment of each
// text node. Text nodes only: a range over the element also returns its child
// elements' own boxes, and a block child spans the full width.
const getTextBoxes = (element: HTMLElement): DOMRect[] => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const boxes: DOMRect[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    range.selectNodeContents(node);
    const rects = range.getClientRects();
    for (let index = 0; index < rects.length; index++) {
      const rect = rects.item(index);
      if (rect && rect.width > 0) {
        boxes.push(rect);
      }
    }
  }

  return boxes;
};

// Where the element's first line of text ends, in px from its left edge. A
// line can hold several text nodes (a link inside the title), so it takes the
// rightmost box that starts above the first box's bottom.
const getFirstLineEnd = (element: HTMLElement): number | undefined => {
  const boxes = getTextBoxes(element);
  const [first] = boxes;

  return first
    ? Math.max(
        ...boxes
          .filter(({ top }) => top < first.bottom)
          .map(({ right }) => right)
      ) - element.getBoundingClientRect().left
    : undefined;
};

/**
 * Where an element's first line of text ends, so something can sit right
 * after its last word on that line even when the text wraps: a wrapped box
 * spans its full width, so a sibling placed after it lands at the box's edge.
 *
 * Measured before paint, and again when the element resizes, when `content`
 * changes, and when web fonts finish loading: a font swap moves where the
 * line ends without resizing the element. `undefined` until measured, or when
 * the element holds no text.
 */
export const useFirstLineEnd = <T extends HTMLElement>(content?: unknown) => {
  const ref = useRef<T>(null);
  const [end, setEnd] = useState<number>();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const measure = () => setEnd(getFirstLineEnd(node));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    // Fires once every font loading at the time has loaded, including one that
    // started before this mounted.
    const { fonts } = document;
    fonts?.addEventListener('loadingdone', measure);

    return () => {
      observer.disconnect();
      fonts?.removeEventListener('loadingdone', measure);
    };
  }, [content]);

  return { ref, end };
};
