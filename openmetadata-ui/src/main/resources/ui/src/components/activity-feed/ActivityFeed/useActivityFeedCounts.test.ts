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
import { renderHook } from '@testing-library/react';
import { useActivityFeedCounts } from './useActivityFeedCounts';

const TABLE_LINK = '<#E::table::svc.db.schema.customers>';
const DATE_RANGE = { startTs: 1, endTs: 2, key: 'last30days' };
const TASK_COUNTS = { all: 3, open: 2, closed: 1 };
let mockActivity: {
  total: number;
  isCapped: boolean;
  isLoading: boolean;
  error: unknown;
};

jest.mock('../../discovery/personal-space/InboxPage/useInboxActivity', () => ({
  useInboxActivity: () => mockActivity,
}));

jest.mock(
  '../../discovery/personal-space/InboxPage/useTaskStatusCounts',
  () => ({ useTaskStatusCounts: () => TASK_COUNTS })
);

const readCounts = () =>
  renderHook(() => useActivityFeedCounts(TABLE_LINK, DATE_RANGE)).result
    .current;

describe('useActivityFeedCounts', () => {
  beforeEach(() => {
    mockActivity = { total: 5, isCapped: true, isLoading: false, error: null };
  });

  it('counts the loaded activity and passes the task counts through', () => {
    const counts = readCounts();

    expect(counts.activityCount).toEqual({ total: 5, isCapped: true });
    expect(counts.taskCounts).toBe(TASK_COUNTS);
  });

  it('has no activity count while the feed loads', () => {
    mockActivity = { ...mockActivity, isLoading: true };

    expect(readCounts().activityCount).toBeUndefined();
  });

  // A failed read is not an entity without activity.
  it('has no activity count when the feed fails', () => {
    mockActivity = { ...mockActivity, total: 0, error: new Error('500') };

    expect(readCounts().activityCount).toBeUndefined();
  });
});
