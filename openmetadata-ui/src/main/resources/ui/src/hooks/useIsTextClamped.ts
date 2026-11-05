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
 * Whether a line-clamped or truncated element is hiding part of its text, so a
 * tooltip with the full text can be offered only when it adds something.
 *
 * Re-measures when the element resizes and when `content` changes, since new
 * text in a box of the same size fires no resize.
 */
export const useIsTextClamped = <T extends HTMLElement>(content?: unknown) => {
  const ref = useRef<T>(null);
  const [isClamped, setIsClamped] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const measure = () =>
      setIsClamped(
        node.scrollHeight > node.clientHeight ||
          node.scrollWidth > node.clientWidth
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, [content]);

  return { ref, isClamped };
};
