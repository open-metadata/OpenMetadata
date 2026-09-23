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

import {
  AnnouncementColor,
  AnnouncementType,
} from '../../../generated/entity/feed/announcement';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';

/** The fields the add/edit announcement form owns. */
export interface AnnouncementFormValues {
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  announcementType: AnnouncementType;
  color?: AnnouncementColor;
  customTypeName?: string;
  systemWide: boolean;
}

/**
 * The subset of an announcement the edit modal round-trips — also the keys its
 * patch compares, so a field added here is diffed without a second list to keep
 * in step.
 */
export const EDITABLE_ANNOUNCEMENT_KEYS = [
  'description',
  'startTime',
  'endTime',
  'announcementType',
  'color',
  'customTypeName',
  'systemWide',
] as const;

export type EditableAnnouncement = Pick<
  AnnouncementEntity,
  (typeof EDITABLE_ANNOUNCEMENT_KEYS)[number]
>;
