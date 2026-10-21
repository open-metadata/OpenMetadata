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
import { AnnouncementStatus } from '../../generated/entity/feed/announcement';

/** Every list query's key starts with this, so one invalidation refreshes them all. */
export const SYSTEM_ANNOUNCEMENTS_QUERY_KEY = ['system-announcements'] as const;

export const SYSTEM_ANNOUNCEMENT_PAGE_SIZES = [10, 25, 50];

/**
 * The list fetches every matching system announcement in one request and
 * searches and pages them in the browser. Only admins write them, so this is a
 * ceiling far above any real count, not a page size.
 */
export const SYSTEM_ANNOUNCEMENT_FETCH_LIMIT = 1000;

/**
 * Status filter order, as the lifecycle runs. The settings list says "Expired"
 * where the asset drawer says "In-active": here the status sits next to the end
 * date, and the design names it for what happened to the window.
 */
export const SYSTEM_ANNOUNCEMENT_STATUS_ORDER: AnnouncementStatus[] = [
  AnnouncementStatus.Scheduled,
  AnnouncementStatus.Active,
  AnnouncementStatus.Expired,
];

export const SYSTEM_ANNOUNCEMENT_STATUS_LABEL_KEYS: Record<
  AnnouncementStatus,
  string
> = {
  [AnnouncementStatus.Active]: 'label.active',
  [AnnouncementStatus.Scheduled]: 'label.scheduled',
  [AnnouncementStatus.Expired]: 'label.expired',
};

/** The sub-paths the settings modal's Announcements section routes on. */
export const SYSTEM_ANNOUNCEMENT_SUB_PATHS = {
  ADD: 'add',
  EDIT: 'edit',
  DUPLICATE: 'duplicate',
} as const;
