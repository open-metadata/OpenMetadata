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

import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useAppMode, writeAppMode } from '../../hooks/useAppMode';
import { useAppModeRegistry } from '../../hooks/useAppModeRegistry';

/**
 * Watches the current URL and auto-engages a registered AppMode when the
 * user lands on one of that mode's UNIQUE path patterns. Shadow paths
 * (those also served by OM/Collate routes) never auto-engage — only an
 * explicit mode switch or a unique-path visit changes the active mode.
 */
export const LocationModeSync = (): null => {
  const { pathname } = useLocation();
  const appMode = useAppMode();
  const registeredModes = useAppModeRegistry((state) => state.modes);

  useEffect(() => {
    for (const [modeName, config] of Object.entries(registeredModes)) {
      if (appMode === modeName) {
        continue;
      }
      const isUnique = config.uniquePathPatterns.some((pattern) =>
        matchPath({ path: pattern, end: true }, pathname)
      );
      if (isUnique) {
        writeAppMode(modeName);
        break;
      }
    }
  }, [pathname, appMode, registeredModes]);

  return null;
};
