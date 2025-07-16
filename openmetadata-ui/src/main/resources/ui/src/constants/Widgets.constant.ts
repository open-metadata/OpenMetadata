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
import { ActivityFeedTabs } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { FeedFilter } from '../enums/mydata.enum';
import { t } from '../utils/i18next/LocalUtil';

export const TAB_SUPPORTED_FILTER = [
  ActivityFeedTabs.ALL,
  ActivityFeedTabs.TASKS,
];

export const TASK_FEED_FILTER_LIST = [
  {
    title: t('label.all'),
    key: FeedFilter.OWNER,
    description: t('message.feed-filter-all'),
  },
  {
    title: t('label.assigned'),
    key: FeedFilter.ASSIGNED_TO,
    description: t('message.feed-filter-owner'),
  },
  {
    title: t('label.created-by'),
    key: FeedFilter.ASSIGNED_BY,
    description: t('message.feed-filter-following'),
  },
];

export const ACTIVITY_FEED_FILTER_LIST = [
  {
    title: t('label.my-data'),
    key: FeedFilter.OWNER,
    description: t('message.feed-filter-owner'),
  },
  {
    title: t('label.following'),
    key: FeedFilter.FOLLOWS,
    description: t('message.feed-filter-following'),
  },
];

export const WIDGETS_MORE_MENU_KEYS = {
  HALF_SIZE: 'half-size',
  FULL_SIZE: 'full-size',
  REMOVE_WIDGET: 'remove-widget',
};

export const WIDGETS_MORE_MENU_OPTIONS = [
  {
    key: WIDGETS_MORE_MENU_KEYS.HALF_SIZE,
    label: t('label.half-size'),
  },
  {
    key: WIDGETS_MORE_MENU_KEYS.FULL_SIZE,
    label: t('label.full-size'),
  },
  {
    key: WIDGETS_MORE_MENU_KEYS.REMOVE_WIDGET,
    label: t('label.remove-entity', {
      entity: t('label.widget'),
    }),
  },
];

export const FEED_WIDGET_FILTER_OPTIONS = [
  {
    label: t('label.all-activity'),
    value: FeedFilter.ALL,
    key: FeedFilter.ALL,
  },
  {
    label: t('label.my-data'),
    value: FeedFilter.OWNER,
    key: FeedFilter.OWNER,
  },
  {
    label: t('label.following'),
    value: FeedFilter.FOLLOWS,
    key: FeedFilter.FOLLOWS,
  },
];

// Filter options for entity types
export const FOLLOWING_WIDGET_FILTER_OPTIONS = [
  {
    label: t('label.latest'),
    value: 'Latest',
    key: 'Latest',
  },
  {
    label: t('label.a-to-z'),
    value: 'A to Z',
    key: 'A to Z',
  },
  {
    label: t('label.z-to-a'),
    value: 'Z to A',
    key: 'Z to A',
  },
];

export const MY_DATA_WIDGET_FILTER_OPTIONS = [
  {
    label: t('label.latest'),
    value: 'Latest',
    key: 'Latest',
  },
  {
    label: t('label.a-to-z'),
    value: 'A to Z',
    key: 'A to Z',
  },
  {
    label: t('label.z-to-a'),
    value: 'Z to A',
    key: 'Z to A',
  },
];
