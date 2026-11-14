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
import { ROUTES } from '../../constants/constants';
import { AnnouncementEntity } from '../../rest/announcementsAPI';
import {
  getSystemAnnouncementBreadcrumbs,
  searchSystemAnnouncements,
} from './systemAnnouncements.utils';

jest.mock('../i18next/LocalUtil', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  t: (key: string) => key,
}));

jest.mock('../GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: (_: string, entity: string) => [
    { name: 'label.setting-plural', url: '/settings' },
    { name: 'label.notification-plural', url: '/settings/notifications' },
    { name: entity, url: '', activeTitle: true },
  ],
}));

const make = (
  id: string,
  startTime: number,
  overrides: Partial<AnnouncementEntity> = {}
): AnnouncementEntity => ({
  id,
  name: `announcement-${id}`,
  displayName: `Title ${id}`,
  description: '',
  startTime,
  endTime: startTime + 1,
  ...overrides,
});

describe('searchSystemAnnouncements', () => {
  const all = [
    make('old', 1, { displayName: 'Q2 data quality report' }),
    make('new', 3, { displayName: 'Planned maintenance' }),
    make('mid', 2, { displayName: 'Data Quality tests support SQL' }),
  ];

  it('keeps every announcement, newest start first, when the search is blank', () => {
    expect(searchSystemAnnouncements(all, '   ').map(({ id }) => id)).toEqual([
      'new',
      'mid',
      'old',
    ]);
  });

  it('matches the title case-insensitively, ignoring surrounding spaces', () => {
    expect(
      searchSystemAnnouncements(all, '  DATA quality ').map(({ id }) => id)
    ).toEqual(['mid', 'old']);
  });

  it('falls back to the name for an announcement with no display name', () => {
    const unnamed = make('x', 1, {
      displayName: undefined,
      name: 'release-notes',
    });

    expect(searchSystemAnnouncements([unnamed], 'release')).toEqual([unnamed]);
  });

  it('does not reorder the array it was given', () => {
    const input = [...all];
    searchSystemAnnouncements(input, '');

    expect(input.map(({ id }) => id)).toEqual(['old', 'new', 'mid']);
  });
});

describe('getSystemAnnouncementBreadcrumbs', () => {
  it('ends at Announcements on the list, linking each crumb above it', () => {
    expect(getSystemAnnouncementBreadcrumbs()).toEqual([
      {
        label: 'label.setting-plural',
        ariaLabel: 'label.setting-plural',
        href: '/settings',
      },
      {
        label: 'label.notification-plural',
        ariaLabel: 'label.notification-plural',
        href: '/settings/notifications',
      },
      {
        label: 'label.announcement-plural',
        ariaLabel: 'label.announcement-plural',
      },
    ]);
  });

  it('links Announcements back to the list from a sub-page', () => {
    const crumbs = getSystemAnnouncementBreadcrumbs('Add Announcement');

    expect(crumbs.slice(-2)).toEqual([
      {
        label: 'label.announcement-plural',
        ariaLabel: 'label.announcement-plural',
        href: ROUTES.SETTINGS_ANNOUNCEMENTS,
      },
      { label: 'Add Announcement', ariaLabel: 'Add Announcement' },
    ]);
  });
});
