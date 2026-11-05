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
import { SYSTEM_ANNOUNCEMENT_SUB_PATHS } from '../../../../../constants/platform/systemAnnouncements.constants';
import { SystemAnnouncementFormMode } from '../SystemAnnouncementForm/SystemAnnouncementForm.types';

export type AnnouncementSectionPath =
  | { view: 'list'; id?: undefined }
  | { view: SystemAnnouncementFormMode; id?: string };

/**
 * The section's hash sub-path → which page to show. `add` creates; `edit/<id>`
 * and `duplicate/<id>` start from an existing announcement. Anything else —
 * including an edit with no id — falls back to the list rather than an empty
 * form.
 */
export const parseAnnouncementSectionPath = (
  subPath?: string
): AnnouncementSectionPath => {
  const [action, id] = (subPath ?? '').split('/');

  if (action === SYSTEM_ANNOUNCEMENT_SUB_PATHS.ADD) {
    return { view: 'create' };
  }

  if (action === SYSTEM_ANNOUNCEMENT_SUB_PATHS.EDIT && id) {
    return { view: 'edit', id };
  }

  if (action === SYSTEM_ANNOUNCEMENT_SUB_PATHS.DUPLICATE && id) {
    return { view: 'duplicate', id };
  }

  return { view: 'list' };
};
