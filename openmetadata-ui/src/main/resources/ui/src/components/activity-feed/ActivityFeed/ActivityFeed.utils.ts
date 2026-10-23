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

/**
 * On an entity page, the page's tab bar: the Tabs' list, before the panel the
 * feed renders in. It pins above the feed while the page scrolls.
 */
export const getEntityTabBar = (feed: HTMLElement): HTMLElement | null =>
  (feed.closest('[role="tabpanel"]')?.parentElement
    ?.firstElementChild as HTMLElement | null) ?? null;

/**
 * The entity tab's count. A capped Activity fetch holds only the newest
 * events, so its total is a lower bound: shown as `219+`, as the feed's own
 * badge marks it.
 */
export const getActivityFeedTabCount = (
  total: number,
  isCapped: boolean
): number | string => (isCapped ? `${total}+` : total);
