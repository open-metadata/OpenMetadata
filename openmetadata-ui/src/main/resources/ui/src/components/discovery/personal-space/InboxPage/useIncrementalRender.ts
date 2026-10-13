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
  RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const ROOT_MARGIN = '400px';

export interface UseIncrementalRender<T> {
  visibleItems: T[];
  hasMore: boolean;
  // Attach to the scroll container and to a sentinel element after the list;
  // the sentinel nearing the viewport renders the next batch.
  scrollRef: RefObject<HTMLDivElement>;
  sentinelRef: RefObject<HTMLDivElement>;
}

/**
 * Renders a long, already fetched list a batch at a time: the first
 * `batchSize` items, then another batch each time the sentinel after them
 * nears the viewport. A small DOM is what keeps a modal over the list cheap
 * to open, since react-aria measures and aria-hides everything behind it.
 *
 * `resetKey` starts over from the first batch, e.g. when a filter changes. A
 * re-fetch of the same list keeps what has been revealed, so posting a reply
 * does not jump the reader back to the top.
 */
export function useIncrementalRender<T>(
  items: T[],
  batchSize: number,
  resetKey?: string
): UseIncrementalRender<T> {
  // The revealed count belongs to the list and batch size it was revealed
  // under. A new `resetKey` or batch size reads the first batch in the same
  // render, rather than mounting the old count's worth of cards and trimming
  // them after.
  const [revealed, setRevealed] = useState({
    key: resetKey,
    batchSize,
    count: batchSize,
  });
  const isSameList =
    revealed.key === resetKey && revealed.batchSize === batchSize;
  const count = isSameList ? revealed.count : batchSize;
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = count < items.length;

  // A new list starts at its top, not at the old list's scroll position, which
  // would also put the sentinel in view and reveal a batch at once.
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [resetKey]);

  // Re-created after every batch, so a sentinel still in view (a short list
  // on a tall screen) reveals the next batch too.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!hasMore || !sentinel || !root) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRevealed((current) => ({
            key: resetKey,
            batchSize,
            count:
              (current.key === resetKey && current.batchSize === batchSize
                ? current.count
                : batchSize) + batchSize,
          }));
        }
      },
      { root, rootMargin: ROOT_MARGIN }
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, batchSize, count, resetKey]);

  const visibleItems = useMemo(() => items.slice(0, count), [items, count]);

  return { visibleItems, hasMore, scrollRef, sentinelRef };
}
