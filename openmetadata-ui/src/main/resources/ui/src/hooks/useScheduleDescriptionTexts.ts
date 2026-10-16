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
import {
  ensureCronstrueLoaded,
  getLoadedCronstrue,
  getScheduleDescriptionTexts,
} from '../utils/date-time/DateTimeUtils';

interface ScheduleDescriptionTexts {
  descriptionFirstPart: string;
  descriptionSecondPart: string;
}

const EMPTY_TEXTS: ScheduleDescriptionTexts = {
  descriptionFirstPart: '',
  descriptionSecondPart: '',
};

/**
 * Returns the parsed cron-expression description. cronstrue is lazy-loaded
 * on first call (~15 KB brotli), so the first render after mount returns
 * empty strings until the import resolves, then the component re-renders
 * with the parsed values.
 */
export const useScheduleDescriptionTexts = (
  scheduleInterval?: string | null
): ScheduleDescriptionTexts => {
  const [, setLoaded] = useState<boolean>(() => Boolean(getLoadedCronstrue()));

  useEffect(() => {
    if (getLoadedCronstrue()) {
      return;
    }
    let cancelled = false;
    ensureCronstrueLoaded().then(() => {
      if (!cancelled) {
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!scheduleInterval) {
    return EMPTY_TEXTS;
  }

  return getScheduleDescriptionTexts(scheduleInterval);
};
