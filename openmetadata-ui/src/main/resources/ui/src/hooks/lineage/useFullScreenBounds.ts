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
import { CSSProperties, useLayoutEffect, useRef, useState } from 'react';

// The page's content column: the area beside the app sidebar in both the
// classic layout and the AI shell, whatever width that sidebar has.
const PAGE_CONTENT_SELECTOR = '.page-layout-v1-center';

/**
 * Pins a full-screen lineage view over the page content column. Measuring the
 * column, instead of hard-coding sidebar widths, keeps it aligned for every
 * app mode and sidebar state, and follows the sidebar when it is toggled.
 */
export const useFullScreenBounds = (isFullScreen: boolean) => {
  const ref = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<CSSProperties>();

  useLayoutEffect(() => {
    const content = isFullScreen
      ? ref.current?.closest(PAGE_CONTENT_SELECTOR)
      : null;
    if (!content) {
      setBounds(undefined);

      return;
    }
    const update = () => {
      const { top, left, width, height } = content.getBoundingClientRect();
      setBounds({ top, left, width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [isFullScreen]);

  return { ref, bounds };
};
