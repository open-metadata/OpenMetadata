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
import { parseAnnouncementSectionPath } from './AnnouncementsNotificationSection.utils';

describe('parseAnnouncementSectionPath', () => {
  it('should show the list at the section root', () => {
    expect(parseAnnouncementSectionPath()).toEqual({ view: 'list' });
    expect(parseAnnouncementSectionPath('')).toEqual({ view: 'list' });
  });

  it('should route add, edit and duplicate', () => {
    expect(parseAnnouncementSectionPath('add')).toEqual({ view: 'create' });
    expect(parseAnnouncementSectionPath('edit/a1')).toEqual({
      view: 'edit',
      id: 'a1',
    });
    expect(parseAnnouncementSectionPath('duplicate/a1')).toEqual({
      view: 'duplicate',
      id: 'a1',
    });
  });

  it('should fall back to the list rather than open a form with nothing to load', () => {
    expect(parseAnnouncementSectionPath('edit')).toEqual({ view: 'list' });
    expect(parseAnnouncementSectionPath('unknown/a1')).toEqual({
      view: 'list',
    });
  });
});
