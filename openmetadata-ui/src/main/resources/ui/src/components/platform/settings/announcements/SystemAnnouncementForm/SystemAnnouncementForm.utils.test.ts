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
import { AnnouncementType } from '../../../../../generated/entity/feed/announcement';
import { AnnouncementEntity } from '../../../../../rest/announcementsAPI';
import { getSystemAnnouncementDefaultValues } from './SystemAnnouncementForm.utils';

const copyTitle = (title: string) => `${title} (copy)`;

const announcement: AnnouncementEntity = {
  id: 'a1',
  name: 'announcement-a1',
  displayName: 'Planned maintenance',
  description: '<p>Search is read-only</p>',
  startTime: 1_000,
  endTime: 2_000,
  type: AnnouncementType.Custom,
  color: undefined,
  customTypeName: 'Town hall',
};

describe('getSystemAnnouncementDefaultValues', () => {
  it('should start a new announcement empty, with no schedule chosen', () => {
    expect(
      getSystemAnnouncementDefaultValues('create', copyTitle, announcement)
    ).toEqual({
      title: '',
      description: '',
      type: AnnouncementType.Notice,
      startTime: null,
      endTime: null,
    });
  });

  it('should edit the announcement as stored', () => {
    expect(
      getSystemAnnouncementDefaultValues('edit', copyTitle, announcement)
    ).toEqual(
      expect.objectContaining({
        title: 'Planned maintenance',
        description: '<p>Search is read-only</p>',
        type: AnnouncementType.Custom,
        customTypeName: 'Town hall',
        startTime: 1_000,
        endTime: 2_000,
      })
    );
  });

  it('should mark a duplicate as a copy and keep it within the title limit', () => {
    const long = { ...announcement, displayName: 'x'.repeat(124) };

    expect(
      getSystemAnnouncementDefaultValues('duplicate', copyTitle, announcement)
        .title
    ).toBe('Planned maintenance (copy)');
    expect(
      getSystemAnnouncementDefaultValues('duplicate', copyTitle, long).title
    ).toHaveLength(124);
  });
});
