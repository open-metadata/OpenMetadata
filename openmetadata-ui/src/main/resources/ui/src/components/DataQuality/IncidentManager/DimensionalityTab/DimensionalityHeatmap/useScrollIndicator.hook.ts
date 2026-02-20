/*
 *  Copyright 2025 Collate.
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

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { HEATMAP_CONSTANTS } from './DimensionalityHeatmap.constants';

export const useScrollIndicator = (
  containerRef: RefObject<HTMLDivElement>,
  dependencies: unknown[]
) => {
  const [showLeftIndicator, setShowLeftIndicator] = useState(false);
  const [showRightIndicator, setShowRightIndicator] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  const checkScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollWidth, clientWidth, scrollLeft } = containerRef.current;
      const hasHorizontalScroll = scrollWidth > clientWidth;

      const isNotAtStart = scrollLeft > HEATMAP_CONSTANTS.SCROLL_THRESHOLD;
      const isNotAtEnd =
        scrollLeft + clientWidth <
        scrollWidth - HEATMAP_CONSTANTS.SCROLL_THRESHOLD;

      setShowLeftIndicator(hasHorizontalScroll && isNotAtStart);
      setShowRightIndicator(hasHorizontalScroll && isNotAtEnd);
    }
  }, [containerRef]);

  const handleScrollLeft = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        left: -HEATMAP_CONSTANTS.SCROLL_STEP,
        behavior: 'smooth',
      });
    }
  }, [containerRef]);

  const handleScrollRight = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        left: HEATMAP_CONSTANTS.SCROLL_STEP,
        behavior: 'smooth',
      });
    }
  }, [containerRef]);

  useEffect(() => {
    const timeoutId = setTimeout(
      checkScroll,
      HEATMAP_CONSTANTS.SCROLL_CHECK_DELAY
    );

    const container = containerRef.current;

    const handleScroll = () => {
      if (container) {
        container.classList.add('is-scrolling');
      }
      checkScroll();

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        if (container) {
          container.classList.remove('is-scrolling');
        }
      }, 200);
    };

    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    window.addEventListener('resize', checkScroll);

    return () => {
      clearTimeout(timeoutId);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (container) {
        container.removeEventListener('scroll', handleScroll);
        container.classList.remove('is-scrolling');
      }
      window.removeEventListener('resize', checkScroll);
    };
  }, dependencies);

  return {
    showLeftIndicator,
    showRightIndicator,
    handleScrollLeft,
    handleScrollRight,
  };
};
