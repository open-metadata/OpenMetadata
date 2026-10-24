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
import { useEffect, useState } from 'react';

/**
 * Closes a drawer when a link inside it is clicked, so the drawer does not
 * stay open over the page the link leads to. Returns a callback ref for the
 * drawer's body, which may mount after the drawer does. Closes on the next
 * tick: the router link navigates in its own click handler first, and
 * unmounting it before that would turn the navigation into a full page load.
 */
export const useCloseOnLinkClick = <T extends HTMLElement>(
  onClose?: () => void
): ((element: T | null) => void) => {
  const [element, setElement] = useState<T | null>(null);

  useEffect(() => {
    if (!element || !onClose) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest?.('a[href]')) {
        setTimeout(onClose);
      }
    };

    element.addEventListener('click', handleClick);

    return () => element.removeEventListener('click', handleClick);
  }, [element, onClose]);

  return setElement;
};
