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
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as MegaphoneIcon } from '../../../../assets/svg/announcements-v1.svg';
import { Thread } from '../../../../generated/entity/feed/thread';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import {
  getEntityFQN,
  getEntityType,
  prepareFeedLink,
} from '../../../../utils/FeedUtils';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import AnnouncementCardV1 from './AnnouncementCardV1/AnnouncementCardV1.component';
import './announcements-widget-v1.less';

export interface AnnouncementsWidgetV1Props extends WidgetCommonProps {
  announcements?: Thread[];
  loading?: boolean;
  currentBackgroundColor?: string;
}

const AnnouncementsWidgetV1 = ({
  announcements = [],
  loading = false,
  handleRemoveWidget,
  widgetKey,
  currentBackgroundColor,
}: AnnouncementsWidgetV1Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    if (handleRemoveWidget) {
      handleRemoveWidget(widgetKey);
    } else {
      setIsVisible(false);
    }
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

  const announcementCards = useMemo(
    () => (
      <div className="announcement-cards-container">
        {announcements.map((announcement) => (
          <AnnouncementCardV1
            announcement={announcement}
            currentBackgroundColor={currentBackgroundColor}
            key={announcement.id}
            onClick={() => handleAnnouncementClick(announcement)}
          />
        ))}
      </div>
    ),
    [announcements, handleAnnouncementClick, currentBackgroundColor]
  );

  const widgetContent = useMemo(
    () => (
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
              style={{ color: currentBackgroundColor }}
            />
          </div>
          <Button
            className="close-button"
            data-testid="announcements-widget-v1-close"
            icon={<CloseOutlined />}
            type="text"
            onClick={handleClose}
          />
        </div>

        <div className="announcements-widget-v1-content">
          {announcementCards}
        </div>
      </div>
    ),
    [announcements, announcementCards, t, handleClose]
  );

  if (!isVisible) {
    return null;
  }

  return (
    <WidgetWrapper
      className="announcements-widget-v1-wrapper"
      dataLength={announcements.length !== 0 ? announcements.length : 3}
      loading={loading}>
      {widgetContent}
    </WidgetWrapper>
  );
};

export default AnnouncementsWidgetV1;
