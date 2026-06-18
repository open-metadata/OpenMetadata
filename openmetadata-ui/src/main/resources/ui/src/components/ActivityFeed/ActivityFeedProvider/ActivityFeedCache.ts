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

import type { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { MAX_ACTIVITY_FEED_CACHE_ENTRIES } from '../../../constants/DashboardCache.constants';
import { makeLruCache } from '../../../utils/lruCacheUtils';

// Keep cache ownership outside ActivityFeedProvider so auth/logout can clear it
// without importing the provider and pulling feed UI into the startup bundle.
export const myActivityFeedCache = makeLruCache<ActivityEvent[]>(
  MAX_ACTIVITY_FEED_CACHE_ENTRIES
);
export const myActivityFeedRequests = new Map<
  string,
  Promise<ActivityEvent[]>
>();
export let activityFeedCacheEpoch = 0;

/** Drop cached activity feeds and in-flight requests on logout, user switch, or tests. */
export function clearActivityFeedCache(): void {
  activityFeedCacheEpoch++;
  myActivityFeedCache.clear();
  myActivityFeedRequests.clear();
}
