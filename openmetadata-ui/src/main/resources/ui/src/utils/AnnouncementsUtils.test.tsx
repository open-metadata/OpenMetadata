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
import {
  AnnouncementColor,
  AnnouncementStatus,
  AnnouncementType,
} from '../generated/entity/feed/announcement';
import {
  ANNOUNCEMENT_COLORS,
  getAnnouncementStatus,
  getAnnouncementTypeConfig,
  getAnnouncementTypeLabel,
  isActiveAnnouncement,
} from './AnnouncementsUtils';

describe('Test isActiveAnnouncement utility', () => {
  jest.useFakeTimers('modern').setSystemTime(new Date('2024-02-05'));

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

describe('getAnnouncementTypeConfig', () => {
  it('should default an announcement with no type to Notice', () => {
    expect(getAnnouncementTypeConfig({}).color).toBe('blue');
    expect(getAnnouncementTypeConfig({}).labelKey).toBe('label.notice');
  });

  it('should derive the colour from the type, ignoring a stored colour', () => {
    const config = getAnnouncementTypeConfig({
      announcementType: AnnouncementType.Critical,
      color: AnnouncementColor.Pink,
    });

    expect(config.color).toBe('error');
    expect(config.labelKey).toBe('label.critical');
  });

  it('should honour the stored colour only for the Custom type', () => {
    expect(
      getAnnouncementTypeConfig({
        announcementType: AnnouncementType.Custom,
        color: AnnouncementColor.Success,
      }).color
    ).toBe('success');
  });

  it('should fall back to the Custom default when no colour is stored', () => {
    expect(
      getAnnouncementTypeConfig({ announcementType: AnnouncementType.Custom })
        .color
    ).toBe('pink');
  });

  it('should map every colour of the schema enum to a badge colour', () => {
    expect(Object.keys(ANNOUNCEMENT_COLORS).sort()).toEqual(
      Object.values(AnnouncementColor).sort()
    );
  });
});

describe('getAnnouncementStatus', () => {
  // The suite above pins the clock to 2024-02-05.
  it('should report Scheduled before the window opens', () => {
    expect(
      getAnnouncementStatus({
        startTime: new Date('2024-02-10').getTime(),
        endTime: new Date('2024-02-12').getTime(),
      })
    ).toBe(AnnouncementStatus.Scheduled);
  });

  it('should report Active inside the window', () => {
    expect(
      getAnnouncementStatus({
        startTime: new Date('2024-02-03').getTime(),
        endTime: new Date('2024-02-10').getTime(),
      })
    ).toBe(AnnouncementStatus.Active);
  });

  it('should report Expired after the window closes', () => {
    expect(
      getAnnouncementStatus({
        startTime: new Date('2024-02-01').getTime(),
        endTime: new Date('2024-02-04').getTime(),
      })
    ).toBe(AnnouncementStatus.Expired);
  });
});

describe('getAnnouncementTypeLabel', () => {
  const t = (key: string) => `t:${key}`;

  it("should use a Custom announcement's own name", () => {
    const config = getAnnouncementTypeConfig({
      announcementType: AnnouncementType.Custom,
      customTypeName: '  Release  ',
    });

    expect(getAnnouncementTypeLabel(config, t)).toBe('Release');
  });

  it('should fall back to the type label for a blank Custom name', () => {
    const config = getAnnouncementTypeConfig({
      announcementType: AnnouncementType.Custom,
      customTypeName: '   ',
    });

    expect(getAnnouncementTypeLabel(config, t)).toBe('t:label.custom');
  });

  it('should ignore a name stored on a predefined type', () => {
    const config = getAnnouncementTypeConfig({
      announcementType: AnnouncementType.Warning,
      customTypeName: 'Ignored',
    });

    expect(getAnnouncementTypeLabel(config, t)).toBe('t:label.warning');
  });
});
