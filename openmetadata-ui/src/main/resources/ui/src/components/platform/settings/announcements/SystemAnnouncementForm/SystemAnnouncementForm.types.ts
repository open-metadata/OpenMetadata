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
import { AnnouncementEntity } from '../../../../../rest/announcementsAPI';

/**
 * `create` starts empty; `edit` patches the given announcement; `duplicate`
 * starts from the given one but saves a new announcement, so its dates can be
 * moved before a second banner goes live.
 */
export type SystemAnnouncementFormMode = 'create' | 'edit' | 'duplicate';

export interface SystemAnnouncementFormProps {
  mode: SystemAnnouncementFormMode;
  /** The announcement being edited or duplicated. */
  announcement?: AnnouncementEntity;
  onCancel: () => void;
  onSaved: (announcement: AnnouncementEntity) => void;
  /** Center the form horizontally; the settings modal opts in. */
  centered?: boolean;
}
