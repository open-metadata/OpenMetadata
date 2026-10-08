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
import {
  STATUS_FILTERS,
  TaskStatusFilter,
} from '../../discovery/personal-space/InboxPage/useTaskQueue';

const TASK_STATUS_PARAM = 'taskStatus';
const DEFAULT_TASK_STATUS: TaskStatusFilter = 'open';

const toTaskStatus = (value: string | null): TaskStatusFilter =>
  STATUS_FILTERS.find(({ id }) => id === value)?.id ?? DEFAULT_TASK_STATUS;

/**
 * An entity page's Tasks Status choice, kept in the URL: the feed's Tasks view
 * and the page's tab label both read it, so the tab's count follows it.
 */
export const useTaskStatusParam = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = toTaskStatus(searchParams.get(TASK_STATUS_PARAM));

  const setStatus = useCallback(
    (next: TaskStatusFilter) =>
      setSearchParams(
        (params) => {
          // Open is the default, so it leaves the URL clean.
          if (next === DEFAULT_TASK_STATUS) {
            params.delete(TASK_STATUS_PARAM);
          } else {
            params.set(TASK_STATUS_PARAM, next);
          }

          return params;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  return [status, setStatus] as const;
};
