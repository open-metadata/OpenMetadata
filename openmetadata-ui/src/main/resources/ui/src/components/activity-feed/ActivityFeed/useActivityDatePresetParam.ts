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
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_INBOX_DATE_PRESET,
  getInboxDateRange,
  InboxDateRange,
  INBOX_DATE_RANGE_OPTIONS,
} from '../../discovery/personal-space/InboxPage/inbox.utils';

const ACTIVITY_DATE_PARAM = 'activityDate';

const toPreset = (value: string | null): string =>
  value && INBOX_DATE_RANGE_OPTIONS[value] ? value : DEFAULT_INBOX_DATE_PRESET;

/**
 * An entity page's Activity date window, kept in the URL as its preset: the
 * feed and the page's tab label both read it, so the tab counts the window the
 * feed shows. The window is day-aligned, so both read the same query.
 */
export const useActivityDatePresetParam = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const preset = toPreset(searchParams.get(ACTIVITY_DATE_PARAM));
  const dateRange = useMemo<InboxDateRange>(
    () => ({
      ...getInboxDateRange(INBOX_DATE_RANGE_OPTIONS[preset].days),
      key: preset,
    }),
    [preset]
  );

  const setPreset = useCallback(
    (next: string) =>
      setSearchParams(
        (params) => {
          // The default window leaves the URL clean.
          if (toPreset(next) === DEFAULT_INBOX_DATE_PRESET) {
            params.delete(ACTIVITY_DATE_PARAM);
          } else {
            params.set(ACTIVITY_DATE_PARAM, next);
          }

          return params;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  return [dateRange, setPreset] as const;
};
