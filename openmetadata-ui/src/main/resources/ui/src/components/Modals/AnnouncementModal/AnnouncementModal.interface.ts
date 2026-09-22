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

import { DateTime } from 'luxon';
import {
  AnnouncementColor,
  AnnouncementType,
} from '../../../generated/entity/feed/announcement';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';

/** The fields the add/edit announcement form owns. */
export interface AnnouncementFormValues {
  title: string;
  description: string;
  startTime: DateTime;
  endTime: DateTime;
  announcementType: AnnouncementType;
  color?: AnnouncementColor;
}

/** The subset of an announcement the edit modal round-trips. */
export type EditableAnnouncement = Pick<
  AnnouncementEntity,
  'description' | 'startTime' | 'endTime' | 'announcementType' | 'color'
>;
