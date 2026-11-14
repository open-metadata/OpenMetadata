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

import { RefObject, useEffect, useState } from 'react';
import {
  EMOJI_PICKER_ABOVE_TOP,
  FORMAT_BAR_ICONS,
} from '../constants/CommentComposer.constants';
import { isSameButtons } from '../utils/CommentComposerUtils';

/**
 * Watches the editor's format bar, which loads lazily, is rebuilt when Quill
 * re-initialises and gains the emoji button after the rest. Returns its
 * buttons in {@link FORMAT_BAR_ICONS} order, and anchors the emoji picker:
 * quill-emoji drops it into the bar with no horizontal position, so it lands
 * at the composer's far edge. It is pinned to its button, above or below as
 * the module chose, and the button is marked open while it shows.
 */
export const useCommentFormatBar = (hostRef: RefObject<HTMLElement>) => {
  const [buttons, setButtons] = useState<Array<Element | null>>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    // Read afresh each time: the editor loads lazily, and quill rebuilds its
    // bar when it re-initialises.
    const sync = () => {
      const toolbar = host.querySelector<HTMLElement>('.ql-toolbar');
      const next = FORMAT_BAR_ICONS.map(
        ([selector]) => toolbar?.querySelector(selector) ?? null
      );
      setButtons((current) => (isSameButtons(current, next) ? current : next));
      const button = toolbar?.querySelector<HTMLElement>(
        '.textarea-emoji-control'
      );
      const picker = toolbar?.querySelector<HTMLElement>('#textarea-emoji');
      button?.classList.toggle('ql-active', Boolean(picker));
      button?.setAttribute('aria-expanded', String(Boolean(picker)));
      if (toolbar && button && picker) {
        // Read the module's choice once: the first pass clears that top, and
        // any later node change (an icon drawn, a palette tab) passes again.
        picker.dataset.above ??= String(
          picker.style.top === EMOJI_PICKER_ABOVE_TOP
        );
        const isAbove = picker.dataset.above === 'true';
        // Kept inside the bar where the button sits near its far edge.
        const left = Math.min(
          button.offsetLeft,
          toolbar.clientWidth - picker.offsetWidth
        );
        // `''` drops the module's inline top; quill-emoji's CSS pins `right`.
        Object.assign(picker.style, {
          left: `${Math.max(left, 0)}px`,
          right: 'auto',
          top: isAbove ? '' : '100%',
          bottom: isAbove ? '100%' : '',
        });
      }
    };
    // Node changes only: the styles set above never re-trigger it.
    const observer = new MutationObserver(sync);
    observer.observe(host, { childList: true, subtree: true });
    sync();

    return () => observer.disconnect();
  }, [hostRef]);

  return buttons;
};
