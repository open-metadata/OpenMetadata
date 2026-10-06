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
import { isUndefined } from 'lodash';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toFiniteNumber } from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import { useTestCaseStore } from '../../../DataQuality/IncidentManager/useTestCase.store';

const SELECTED_RUN_PARAM = 'run';

/**
 * Keeps the chart's selected run in the URL, so a reload or a shared link
 * opens on it. The store stays the live state, so the selection still
 * survives a tab switch, which drops the query.
 */
export const useSelectedRunInUrl = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRunTimestamp = useTestCaseStore(
    (state) => state.selectedRunTimestamp
  );
  const setSelectedRunTimestamp = useTestCaseStore(
    (state) => state.setSelectedRunTimestamp
  );
  const urlRun = searchParams.get(SELECTED_RUN_PARAM);
  const isFirstSync = useRef(true);

  useEffect(() => {
    const fromUrl = toFiniteNumber(urlRun ?? undefined);

    if (
      !isUndefined(fromUrl) &&
      isUndefined(useTestCaseStore.getState().selectedRunTimestamp)
    ) {
      setSelectedRunTimestamp(fromUrl);
    }
    // Restored once, on mount; after that the store leads and the URL follows.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on mount only
  }, []);

  useEffect(() => {
    const isFirst = isFirstSync.current;
    isFirstSync.current = false;
    // On mount the store does not hold the URL's run yet: the restore sets it.
    if (isFirst && isUndefined(selectedRunTimestamp)) {
      return;
    }

    const value = isUndefined(selectedRunTimestamp)
      ? null
      : String(selectedRunTimestamp);

    if (value !== urlRun) {
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);

          if (value === null) {
            next.delete(SELECTED_RUN_PARAM);
          } else {
            next.set(SELECTED_RUN_PARAM, value);
          }

          return next;
        },
        { replace: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the store only
  }, [selectedRunTimestamp]);
};
