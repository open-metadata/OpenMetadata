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

import { RefObject, useLayoutEffect, useState } from 'react';

const DARK_MODE_CLASS = 'dark-mode';

const rootIsDark = () =>
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains(DARK_MODE_CLASS);

/**
 * Whether the element renders in dark mode: `override` when given, else a
 * `.dark-mode` class on the element's ancestors or on `<html>`. Re-checks when
 * the `<html>` class changes, which is how the app theme toggles.
 */
export const useIsDarkMode = (
  ref: RefObject<HTMLElement | null>,
  override?: boolean
): boolean => {
  const [detected, setDetected] = useState(rootIsDark);

  useLayoutEffect(() => {
    const update = () =>
      setDetected(
        Boolean(ref.current?.closest(`.${DARK_MODE_CLASS}`)) || rootIsDark()
      );
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [ref]);

  return override ?? detected;
};
