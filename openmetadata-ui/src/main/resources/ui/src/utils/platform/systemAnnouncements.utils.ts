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
import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import { ROUTES } from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { AnnouncementEntity } from '../../rest/announcementsAPI';
import { getSettingPageEntityBreadCrumb } from '../GlobalSettingsUtils';
import i18n from '../i18next/LocalUtil';

/**
 * Settings › Notifications › Announcements, then the current sub-page when
 * there is one. Every crumb but the last links back up.
 */
export const getSystemAnnouncementBreadcrumbs = (
  current?: string
): Omit<BreadcrumbItemType, 'id'>[] => {
  const announcements = i18n.t('label.announcement-plural');
  const settingsCrumbs = getSettingPageEntityBreadCrumb(
    GlobalSettingsMenuCategory.NOTIFICATIONS,
    announcements
  )
    .filter(({ url }) => Boolean(url))
    .map(({ name, url }) => ({ label: name, ariaLabel: name, href: url }));

  return current
    ? [
        ...settingsCrumbs,
        {
          label: announcements,
          ariaLabel: announcements,
          href: ROUTES.SETTINGS_ANNOUNCEMENTS,
        },
        { label: current, ariaLabel: current },
      ]
    : [...settingsCrumbs, { label: announcements, ariaLabel: announcements }];
};

/**
 * The announcements whose title contains `search` (case-insensitive; a blank
 * search keeps them all), newest start first — the order an admin scans for
 * what is live or coming up next.
 */
export const searchSystemAnnouncements = (
  announcements: AnnouncementEntity[],
  search: string
): AnnouncementEntity[] => {
  const term = search.trim().toLowerCase();

  return announcements
    .filter(
      (announcement) =>
        !term ||
        (announcement.displayName ?? announcement.name)
          .toLowerCase()
          .includes(term)
    )
    .sort((a, b) => b.startTime - a.startTime);
};
