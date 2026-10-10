/*
 *  Copyright 2025 Collate.
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

import { AnnouncementStatus } from '../../../generated/entity/feed/announcement';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import { getAnnouncementStatus } from '../../../utils/AnnouncementsUtils';

/**
 * How an announcement *looks* — icon, badge, tinted surface — is its `type`, and
 * that table lives in OpenMetadata (`AnnouncementsUtils`) so a Critical
 * announcement reads the same here as on an entity page. This module covers the
 * other axis, the one only the Home rail and its dialog care about: where the
 * announcement sits in its own lifecycle.
 */
export interface AnnouncementLifecycle {
  status: AnnouncementStatus;
  /** Expired/scheduled cards are read-only context — only live ones dismiss. */
  isDismissible: boolean;
  /**
   * The moment that explains the status. Luxon's relative formatting handles
   * the future ("in 3 days") for a Scheduled announcement.
   */
  timestamp?: number;
}

const TIMESTAMP_OF: Record<
  AnnouncementStatus,
  (announcement: AnnouncementEntity) => number | undefined
> = {
  [AnnouncementStatus.Active]: (a) => a.updatedAt ?? a.createdAt,
  [AnnouncementStatus.Scheduled]: (a) => a.startTime,
  [AnnouncementStatus.Expired]: (a) => a.endTime,
};

/**
 * Status comes from the window rather than the stored `status` field, which is
 * only a snapshot of the announcement's last write — one stored while Scheduled
 * still reads back as Scheduled long after its start time has passed.
 */
export const getAnnouncementLifecycle = (
  announcement: AnnouncementEntity
): AnnouncementLifecycle => {
  const status = getAnnouncementStatus(announcement);

  return {
    status,
    isDismissible: status === AnnouncementStatus.Active,
    timestamp: TIMESTAMP_OF[status](announcement),
  };
};

// Active first, then upcoming, then history — the order the "all" dialog lists.
const STATUS_RANK: Record<AnnouncementStatus, number> = {
  [AnnouncementStatus.Active]: 0,
  [AnnouncementStatus.Scheduled]: 1,
  [AnnouncementStatus.Expired]: 2,
};

export const compareAnnouncements = (
  a: AnnouncementEntity,
  b: AnnouncementEntity
): number => {
  const rank =
    STATUS_RANK[getAnnouncementStatus(a)] -
    STATUS_RANK[getAnnouncementStatus(b)];

  return rank !== 0 ? rank : b.startTime - a.startTime;
};
