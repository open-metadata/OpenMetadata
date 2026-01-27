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
import { useEffect } from 'react';

/**
 * Custom hook to scroll to a specific element when conditions are met
 * @param selector - CSS selector for the element to scroll to
 * @param shouldScroll - Condition that determines if scrolling should happen
 * @param delay - Delay in milliseconds before scrolling (default: 100ms)
 * @param behavior - Scroll behavior: 'smooth' or 'auto' (default: 'smooth')
 * @param block - Vertical alignment: 'start', 'center', 'end', or 'nearest' (default: 'center')
 */
export const useScrollToElement = (
  selector: string,
  shouldScroll: boolean,
  delay = 100,
  behavior: ScrollBehavior = 'smooth',
  block: ScrollLogicalPosition = 'center'
) => {
  useEffect(() => {
    if (!shouldScroll) {
      return;
    }

    const scrollTimer = setTimeout(() => {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({
          behavior,
          block,
        });
      }
    }, delay);

    return () => clearTimeout(scrollTimer);
  }, [selector, shouldScroll, delay, behavior, block]);
};
