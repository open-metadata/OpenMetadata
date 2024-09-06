/*
 *  Copyright 2024 Collate.
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
import { isActiveAnnouncement } from './AnnouncementsUtils';

describe('Test isActiveAnnouncement utility', () => {
  jest.useFakeTimers().setSystemTime(new Date('2024-02-05'));

  it('should return true for active announcement', () => {
    const result = isActiveAnnouncement(
      new Date('2024-02-03').getTime(),
      new Date('2024-02-10').getTime()
    );

    expect(result).toBe(true);
  });

  it('should return false for inActive announcements', () => {
    const result = isActiveAnnouncement(
      new Date('2024-02-01').getTime(),
      new Date('2024-02-04').getTime()
    );

    expect(result).toBe(false);
  });
});
