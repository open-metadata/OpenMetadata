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
import classNames from 'classnames';
import {
  ANNOUNCEMENT_SURFACE_CLASSES,
  getAnnouncementTypeConfig,
} from '../../utils/AnnouncementsUtils';
import { AnnouncementFeedCardProp } from './Announcement.interface';
import AnnouncementFeedCardBody from './AnnouncementFeedCardBody.component';

const AnnouncementFeedCard = ({
  announcement,
  editPermission,
  onConfirmation,
  updateAnnouncementHandler,
}: AnnouncementFeedCardProp) => {
  const { color } = getAnnouncementTypeConfig(announcement);

  return (
    <div
      className={classNames(
        'tw:rounded-xl tw:outline-1 tw:-outline-offset-1 tw:p-4',
        ANNOUNCEMENT_SURFACE_CLASSES[color].surface
      )}
      data-testid="announcement-card">
      <AnnouncementFeedCardBody
        announcement={announcement}
        editPermission={editPermission}
        updateAnnouncementHandler={updateAnnouncementHandler}
        onConfirmation={onConfirmation}
      />
    </div>
  );
};

export default AnnouncementFeedCard;
