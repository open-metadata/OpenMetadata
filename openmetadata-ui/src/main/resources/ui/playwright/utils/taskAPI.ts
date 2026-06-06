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
import { APIRequestContext, expect } from '@playwright/test';

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_ATTEMPTS = 15;
const DEFAULT_DELAY_MS = 1000;

interface TaskListItem {
  id: string;
  [key: string]: unknown;
}

interface TaskListResponse {
  data: TaskListItem[];
  paging?: { after?: string; before?: string; total?: number };
}

export interface FindTaskInListOptions {
  status?: string;
  createdById?: string;
  pageSize?: number;
  maxAttempts?: number;
  delayMs?: number;
}

/**
 * `GET /api/v1/tasks` is cursor-paginated and sorted by `(name, id)`, not by
 * recency. On populated environments a freshly-created task can sit on a
 * page past the first one, so a single-page lookup is unreliable.
 *
 * This helper scopes the list with whatever filters the caller passes
 * (typically `status` and `createdById`) and walks every page with the
 * `after` cursor before giving up on an attempt. The outer retry exists
 * only to absorb a genuine post-create indexing delay.
 *
 * Returns the matching task or `undefined` if it never appears within the
 * retry budget.
 */
export const findTaskInList = async (
  apiContext: APIRequestContext,
  taskId: string,
  options: FindTaskInListOptions = {}
): Promise<TaskListItem | undefined> => {
  const {
    status,
    createdById,
    pageSize = DEFAULT_PAGE_SIZE,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    delayMs = DEFAULT_DELAY_MS,
  } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let after: string | undefined;
    do {
      const params: Record<string, string | number> = { limit: pageSize };
      if (status) {
        params.status = status;
      }
      if (createdById) {
        params.createdById = createdById;
      }
      if (after) {
        params.after = after;
      }

      const response = await apiContext.get('/api/v1/tasks', { params });
      const data = (await response.json()) as TaskListResponse;

      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);

      const match = data.data.find((t) => t.id === taskId);
      if (match) {
        return match;
      }

      after = data.paging?.after;
    } while (after);

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return undefined;
};
