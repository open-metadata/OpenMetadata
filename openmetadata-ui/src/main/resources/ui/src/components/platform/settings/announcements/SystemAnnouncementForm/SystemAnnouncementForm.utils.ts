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
import { ANNOUNCEMENT_TITLE_MAX_LENGTH } from '../../../../Modals/AnnouncementModal/announcementFormUtils';
import { AnnouncementFormValues } from '../../../../Modals/AnnouncementModal/AnnouncementModal.interface';
import { SystemAnnouncementFormMode } from './SystemAnnouncementForm.types';

/**
 * The form's starting values. A duplicate keeps everything but marks its title
 * as a copy, cut to the title limit so the copy suffix never makes it invalid.
 */
export const getSystemAnnouncementDefaultValues = (
  mode: SystemAnnouncementFormMode,
  copyTitle: (title: string) => string,
  announcement?: AnnouncementEntity
): AnnouncementFormValues => {
  if (!announcement || mode === 'create') {
    return {
      title: '',
      description: '',
      type: AnnouncementType.Notice,
      // Dates start empty: a prefilled window is a schedule the author never
      // chose, and it reads as already decided.
      startTime: null,
      endTime: null,
    };
  }

  const title = announcement.displayName ?? announcement.name;

  return {
    title:
      mode === 'duplicate'
        ? copyTitle(title).slice(0, ANNOUNCEMENT_TITLE_MAX_LENGTH)
        : title,
    description: announcement.description,
    type: announcement.type ?? AnnouncementType.Notice,
    color: announcement.color,
    customTypeName: announcement.customTypeName,
    startTime: announcement.startTime,
    endTime: announcement.endTime,
  };
};
