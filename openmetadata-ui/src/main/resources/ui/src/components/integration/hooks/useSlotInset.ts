/*
 *  Copyright 2024 Collate.
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

export const useSlotInset = () => {
  const [inset, setInset] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  // A callback ref rather than a `useEffect`-attached `useRef`: the measured node can mount *after*
  // this hook's host first renders — e.g. a page that returns a loader on its first paint and only
  // renders the footer slot once its data settles. A one-shot effect keyed on `[]` would run while
  // the ref is still null, attach nothing, and never re-run, leaving the inset stuck at 0. The
  // callback fires whenever React attaches or detaches the node, so the observer follows it.
  const ref = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();

    if (!node) {
      setInset(0);

      return;
    }

    setInset(node.offsetHeight);
    observerRef.current = new ResizeObserver(() => setInset(node.offsetHeight));
    observerRef.current.observe(node);
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { ref, inset };
};
