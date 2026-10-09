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
import {
    Box,
    ButtonUtility,
    Typography
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as MegaphoneIcon } from '../../../../assets/svg/announcements-v1.svg';
import { DEFAULT_THEME } from '../../../../constants/Appearance.constants';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { AnnouncementEntity } from '../../../../rest/announcementsAPI';
import {
    getEntityFQN,
    getEntityType,
    prepareFeedLink
} from '../../../../utils/FeedUtilsPure';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import AnnouncementCardV1 from './AnnouncementCardV1/AnnouncementCardV1.component';
import './announcements-widget-v1.less';

export interface AnnouncementsWidgetV1Props {
  announcements?: AnnouncementEntity[];
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

  const handleAnnouncementClick = (announcement: AnnouncementEntity) => {
    const entityType = getEntityType(announcement.entityLink ?? '');
    const entityFQN = getEntityFQN(announcement.entityLink ?? '');

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
        <Box
          align="center"
          className="announcements-widget-v1-header"
          justify="between">
          <Box align="center" className="header-left" gap={2}>
            <Box align="center" className="header-icon" justify="center">
              <MegaphoneIcon />
            </Box>
            <Typography
              as="h5"
              className="header-title"
              data-testid="announcements-widget-v1-title"
              size="text-md"
              weight="semibold">
              {t('label.recent-announcement-plural')}
            </Typography>
            {announcements.length > 0 && (
              <Box
                inline
                align="center"
                className="announcement-count-badge tw:border tw:border-bg-surface tw:bg-surface tw:px-1.5"
                data-testid="announcement-count-badge"
                justify="center"
                style={{ color: bgColor }}>
                {announcements.length}
              </Box>
            )}
          </Box>
          <ButtonUtility
            className="close-button"
            color="tertiary"
            data-testid="announcements-widget-v1-close"
            icon={XClose}
            isDisabled={disabled}
            onClick={handleClose}
          />
        </Box>

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
