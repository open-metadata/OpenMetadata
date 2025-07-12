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
import i18n from '../utils/i18next/LocalUtil';

export const TAB_SUPPORTED_FILTER = [
  ActivityFeedTabs.ALL,
  ActivityFeedTabs.TASKS,
];

export const TASK_FEED_FILTER_LIST = [
  {
    title: i18n.t('label.all'),
    key: FeedFilter.OWNER,
    description: i18n.t('message.feed-filter-all'),
  },
  {
    title: i18n.t('label.assigned'),
    key: FeedFilter.ASSIGNED_TO,
    description: i18n.t('message.feed-filter-owner'),
  },
  {
    title: i18n.t('label.created-by'),
    key: FeedFilter.ASSIGNED_BY,
    description: i18n.t('message.feed-filter-following'),
  },
];

export const ACTIVITY_FEED_FILTER_LIST = [
  {
    title: i18n.t('label.my-data'),
    key: FeedFilter.OWNER,
    description: i18n.t('message.feed-filter-owner'),
  },
  {
    title: i18n.t('label.following'),
    key: FeedFilter.FOLLOWS,
    description: i18n.t('message.feed-filter-following'),
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
    label: i18n.t('label.half-size'),
  },
  {
    key: WIDGETS_MORE_MENU_KEYS.FULL_SIZE,
    label: i18n.t('label.full-size'),
  },
  {
    key: WIDGETS_MORE_MENU_KEYS.REMOVE_WIDGET,
    label: i18n.t('label.remove-entity', {
      entity: i18n.t('label.widget'),
    }),
  },
];
