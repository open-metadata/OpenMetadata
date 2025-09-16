/*
 *  Copyright 2025 Collate.
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
import { ActivityFeedTabs } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import {
  ACTIVITY_FEED_FILTER_LIST,
  TASK_FEED_FILTER_LIST,
} from '../../constants/Widgets.constant';
import { FeedFilter } from '../../enums/mydata.enum';
import i18n from '../i18next/LocalUtil';

export const getFeedFilterWidgets = (
  tab: ActivityFeedTabs,
  isAdmin?: boolean
) => {
  return tab === ActivityFeedTabs.TASKS
    ? TASK_FEED_FILTER_LIST
    : [
        {
          title: i18n.t('label.all'),
          key: isAdmin ? FeedFilter.ALL : FeedFilter.OWNER_OR_FOLLOWS,
          description: i18n.t('message.feed-filter-all'),
        },
        ...ACTIVITY_FEED_FILTER_LIST,
      ];
};

/**
 * Determines the safest container for rendering dropdown/popups like from Ant Design.
 * It avoids containers that may clip the popup (e.g., with overflow: hidden),
 * while still trying to keep the popup within a scrollable context if possible.
 *
 * @param trigger - The element that triggered the popup.
 * @returns A suitable container element for rendering the popup.
 */
export const getVisiblePopupContainer = (
  trigger?: HTMLElement
): HTMLElement => {
  // Fallback to document.body if no trigger is provided
  if (!trigger) {
    return document.body;
  }

  // Start from the trigger and walk up the DOM tree
  let node: HTMLElement | null = trigger;

  // Acceptable overflow values for scrollable containers
  const scrollableValues = ['auto', 'scroll', 'overlay'];

  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);

    // Extract overflow styles from the current element
    const { overflowY, overflow } = style;

    // Check if the element is considered scrollable
    const isScrollable =
      scrollableValues.includes(overflowY) ||
      scrollableValues.includes(overflow);

    // Check if the element might clip content (e.g., overflow: hidden)
    const willClip = overflow === 'hidden' || overflowY === 'hidden';

    // Ensure it is scrollable, does not clip, and has actual scrollable content
    if (isScrollable && !willClip && node.scrollHeight > node.clientHeight) {
      return node; // Found a safe scrollable container
    }

    // Move up to the parent element
    node = node.parentElement;
  }

  // Fallback to the <body> if no suitable container is found
  return document.body;
};
