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

const SEARCH_POPOVER_SELECTOR = '[data-testid="explore-search-popover"]';

/**
 * Treats the search form and its portalled suggestions as one focus boundary.
 * DOM containment alone cannot identify focus moving into the popover because
 * React Aria renders it outside the form.
 */
export const isFocusWithinSearchControl = (
  relatedTarget: EventTarget | null,
  searchContainer: HTMLElement | null
): boolean => {
  if (!(relatedTarget instanceof Node)) {
    return false;
  }

  if (searchContainer?.contains(relatedTarget)) {
    return true;
  }

  return (
    relatedTarget instanceof Element &&
    Boolean(relatedTarget.closest(SEARCH_POPOVER_SELECTOR))
  );
};
