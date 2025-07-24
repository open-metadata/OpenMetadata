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
import { CloseOutlined } from '@ant-design/icons';
import { Badge, Button, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as MegaphoneIcon } from '../../../../assets/svg/announcements-v1.svg';
import { DEFAULT_THEME } from '../../../../constants/Appearance.constants';
import { Thread } from '../../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  getEntityFQN,
  getEntityType,
  prepareFeedLink,
} from '../../../../utils/FeedUtils';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import AnnouncementCardV1 from './AnnouncementCardV1/AnnouncementCardV1.component';
import './announcements-widget-v1.less';

export interface AnnouncementsWidgetV1Props {
  announcements?: Thread[];
  currentBackgroundColor?: string;
  disabled?: boolean;
  loading?: boolean;
  onClose: () => void;
}

const AnnouncementsWidgetV1 = ({
  announcements = [],
  currentBackgroundColor,
  disabled = false,
  loading = false,
  onClose,
}: AnnouncementsWidgetV1Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { applicationConfig } = useApplicationStore();
  const bgColor = currentBackgroundColor?.includes('linear-gradient')
    ? applicationConfig?.customTheme?.primaryColor ?? DEFAULT_THEME.primaryColor
    : currentBackgroundColor;

  const handleClose = () => {
    onClose();
  };

  const handleAnnouncementClick = (announcement: Thread) => {
    const entityType = getEntityType(announcement.about);
    const entityFQN = getEntityFQN(announcement.about);

    if (entityType && entityFQN) {
      // Navigate to the activity feed of the entity
      const feedLink = prepareFeedLink(entityType, entityFQN);
      navigate(feedLink);
    }
  };

  return (
    <WidgetWrapper
      className="announcements-widget-v1-wrapper"
      dataLength={announcements.length !== 0 ? announcements.length : 5}
      loading={loading}>
      <div className="announcements-widget-v1-container">
        <div className="announcements-widget-v1-header">
          <div className="header-left">
            <div className="header-icon">
              <MegaphoneIcon />
            </div>
            <Typography.Title
              className="header-title"
              data-testid="announcements-widget-v1-title"
              level={5}>
              {t('label.recent-announcement-plural')}
            </Typography.Title>
            <Badge
              className="announcement-count-badge"
              count={announcements.length}
              data-testid="announcement-count-badge"
              style={{ color: bgColor }}
            />
          </div>
          <Button
            className="close-button"
            data-testid="announcements-widget-v1-close"
            disabled={disabled}
            icon={<CloseOutlined />}
            type="text"
            onClick={handleClose}
          />
        </div>

        <div className="announcements-widget-v1-content">
          <div className="announcement-cards-container">
            {announcements.map((announcement) => (
              <AnnouncementCardV1
                announcement={announcement}
                currentBackgroundColor={bgColor}
                disabled={disabled}
                key={announcement.id}
                onClick={() => handleAnnouncementClick(announcement)}
              />
            ))}
          </div>
        </div>
      </div>
    </WidgetWrapper>
  );
};

export default AnnouncementsWidgetV1;
