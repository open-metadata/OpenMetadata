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

import { useCallback } from 'react';
import {
  GRID_PAGE_SIZE_OPTIONS,
  LIST_PAGE_SIZE_OPTIONS,
} from '../../constants/constants';
import { useCurrentUserPreferences } from '../currentUserStore/useCurrentUserStore';

// ADR:2026-10-13-ui-page-sizes-lists-15-25-50-grids-12-24-48
export const useSavedPageSize = (
  pageSizeOptions: number[] = LIST_PAGE_SIZE_OPTIONS
) => {
  const {
    preferences: { globalPageSize, globalGridPageSize },
    setPreference,
  } = useCurrentUserPreferences();

  const saved = GRID_PAGE_SIZE_OPTIONS.includes(pageSizeOptions[0])
    ? globalGridPageSize
    : globalPageSize;
  const savedPageSize = pageSizeOptions.includes(saved)
    ? saved
    : pageSizeOptions[0];

  const savePageSize = useCallback(
    (size: number) => {
      if (GRID_PAGE_SIZE_OPTIONS.includes(size)) {
        setPreference({ globalGridPageSize: size });
      } else if (LIST_PAGE_SIZE_OPTIONS.includes(size)) {
        setPreference({ globalPageSize: size });
      }
    },
    [setPreference]
  );

  const resolvePageSize = useCallback(
    (requested?: number) =>
      requested && pageSizeOptions.includes(requested)
        ? requested
        : savedPageSize,
    [pageSizeOptions, savedPageSize]
  );

  return { savedPageSize, savePageSize, resolvePageSize };
};
