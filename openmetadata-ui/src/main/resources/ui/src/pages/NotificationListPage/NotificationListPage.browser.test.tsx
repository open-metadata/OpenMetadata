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
import { http, HttpResponse } from 'msw';
import {
  AlertType,
  EventSubscription,
} from '../../generated/events/eventSubscription';
import { many, named } from '../../test/browser/fixtures/entities';
import { worker } from '../../test/browser/msw';
import { describePaginatedList } from '../../test/browser/paginationContract';

const alerts = many(40, (i) => ({
  ...named('notification_alert', i),
  alertType: AlertType.Notification,
  destinations: [],
})) as EventSubscription[];

describePaginatedList({
  name: 'Settings › Notification alerts',
  route: '/settings/notifications/alerts',
  listPath: '/api/v1/events/subscriptions',
  items: alerts,
  itemLabel: (a) => a.displayName ?? a.name,
  // Page 1 also pins the system ActivityFeedAlert above the list.
  pinnedRowsOnFirstPage: 1,
  setup: () =>
    worker.use(
      http.get('/api/v1/events/subscriptions/name/ActivityFeedAlert', () =>
        HttpResponse.json({
          id: 'activity-feed-alert',
          name: 'ActivityFeedAlert',
          alertType: AlertType.ActivityFeed,
          destinations: [],
        })
      )
    ),
  knownIssues: {
    duplicateFetchOnPageChange:
      'NotificationListPage fetches on click and again from the URL effect',
  },
});
