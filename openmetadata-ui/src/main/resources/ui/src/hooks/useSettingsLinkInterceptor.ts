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
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettingsHashForHref } from '../utils/SettingsModalLinkUtils';

const opensNewTab = (event: MouseEvent) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1;

/**
 * Rich text stores user and team mentions as absolute classic URLs
 * (`<origin>/users/<name>`, `<origin>/settings/members/teams/<fqn>`), so no
 * link builder sees them. In the AI shell a click on any same-origin link to a
 * page the settings modal hosts opens the modal over the current page instead;
 * a new-tab click opens the same page and modal in a new tab.
 * ADR:2026-10-21-settings-pages-are-classic-only
 */
export const useSettingsLinkInterceptor = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button > 1) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      const href = anchor?.getAttribute('href');
      if (!href) {
        return;
      }
      const hash = getSettingsHashForHref(href);
      if (hash === undefined) {
        return;
      }
      event.preventDefault();
      if (opensNewTab(event)) {
        const { pathname, search } = globalThis.location;
        globalThis.open(`${pathname}${search}#${hash}`, '_blank', 'noopener');

        return;
      }
      navigate({ search: globalThis.location.search, hash });
    };

    // Capture phase: runs before ProseMirror, react-router `Link` and the
    // browser's own `target="_blank"` handling.
    document.addEventListener('click', handleClick, true);
    document.addEventListener('auxclick', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('auxclick', handleClick, true);
    };
  }, [navigate]);
};
