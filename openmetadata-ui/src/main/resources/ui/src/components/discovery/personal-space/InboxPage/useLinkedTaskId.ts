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
import { useSearchParams } from 'react-router-dom';
import { INBOX_TASK_ID_PARAM } from '../personalSpace.constants';

/** The task the URL names (`?taskId=`), and a setter that replaces or clears it. */
export const useLinkedTaskId = (): readonly [
  string | undefined,
  (taskId?: string) => void
] => {
  const [searchParams, setSearchParams] = useSearchParams();
  const setLinkedTaskId = useCallback(
    (taskId?: string) =>
      setSearchParams(
        (params) => {
          if (taskId) {
            params.set(INBOX_TASK_ID_PARAM, taskId);
          } else {
            params.delete(INBOX_TASK_ID_PARAM);
          }

          return params;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  return [
    searchParams.get(INBOX_TASK_ID_PARAM) ?? undefined,
    setLinkedTaskId,
  ] as const;
};
