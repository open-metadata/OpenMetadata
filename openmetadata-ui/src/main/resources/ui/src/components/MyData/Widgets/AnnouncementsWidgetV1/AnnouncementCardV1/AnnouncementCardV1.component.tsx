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
import { Card, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  FieldOperation,
  Thread,
} from '../../../../../generated/entity/feed/thread';
import { getFieldOperationText } from '../../../../../utils/AnnouncementsUtils';
import { getRelativeTime } from '../../../../../utils/date-time/DateTimeUtils';
import entityUtilClassBase from '../../../../../utils/EntityUtilClassBase';
import { getEntityFQN, getEntityType } from '../../../../../utils/FeedUtils';
import { getUserPath } from '../../../../../utils/RouterUtils';
import { getEntityIcon } from '../../../../../utils/TableUtils';
import RichTextEditorPreviewerV1 from '../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import './announcement-card-v1.less';

interface AnnouncementCardV1Props {
  announcement: Thread;
  onClick: () => void;
  currentBackgroundColor?: string;
}

const AnnouncementCardV1 = ({
  announcement,
  onClick,
  currentBackgroundColor,
}: AnnouncementCardV1Props) => {
  const { t } = useTranslation();

  const {
    title,
    description,
    userName,
    timestamp,
    entityName,
    entityType,
    entityFQN,
    fieldOperation,
    columnName,
  } = useMemo(() => {
    const fqn = getEntityFQN(announcement.about);
    const entityName = fqn.split('::').pop() || '';
    const entityType = getEntityType(announcement.about);
    const entityFQN = fqn;

    return {
      title: announcement.message,
      description: announcement?.announcement?.description || '',
      userName: announcement.createdBy || '',
      timestamp: announcement.threadTs,
      entityName,
      entityType,
      entityFQN,
      fieldOperation: announcement.fieldOperation,
      columnName: announcement.feedInfo?.fieldName || '',
    };
  }, [announcement]);

  const {
    announcementTitleSectionStyle,
    announcementTitleStyle,
    userNameStyle,
    entityNameStyle,
  } = useMemo(() => {
    return {
      announcementTitleSectionStyle: {
        background: `linear-gradient(270deg, #ffffff -12.07%, ${currentBackgroundColor} 233.72%)`,
      },
      announcementTitleStyle: {
        borderLeft: `3px solid ${currentBackgroundColor}`,
      },
      userNameStyle: {
        color: currentBackgroundColor,
      },
      entityNameStyle: {
        color: currentBackgroundColor,
      },
    };
  }, [currentBackgroundColor]);

  const entityIcon = useMemo(() => {
    return getEntityIcon(entityType, 'entity-icon');
  }, [entityType]);

  const handleEntityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleCardClick = () => {
    onClick();
  };

  return (
    <Card
      className="announcement-card-v1"
      data-testid={`announcement-card-v1-${announcement.id}`}
      onClick={handleCardClick}>
      <div className="announcement-card-v1-content">
        <div className="announcement-header">
          <div
            className="announcement-title-section"
            style={announcementTitleSectionStyle}>
            {fieldOperation && fieldOperation !== FieldOperation.None ? (
              <div
                className="announcement-title"
                style={announcementTitleStyle}>
                <Link
                  className="user-name"
                  data-testid="user-link"
                  style={userNameStyle}
                  to={getUserPath(userName)}
                  onClick={handleUserClick}>
                  {userName}
                </Link>
                <Typography.Text className="field-operation-text">
                  {' '}
                  {getFieldOperationText(fieldOperation)}
                </Typography.Text>
                <span className="announcement-entity-icon">{entityIcon}</span>
                {entityFQN && entityType ? (
                  <Link
                    className="announcement-entity-name"
                    data-testid="entity-link"
                    style={entityNameStyle}
                    to={entityUtilClassBase.getEntityLink(
                      entityType,
                      entityFQN
                    )}
                    onClick={handleEntityClick}>
                    {entityName}
                  </Link>
                ) : (
                  <Typography.Text className="announcement-entity-name">
                    {entityName}
                  </Typography.Text>
                )}
              </div>
            ) : (
              <Typography.Text
                className="announcement-title"
                style={announcementTitleStyle}>
                {title}
              </Typography.Text>
            )}
            <Typography.Text className="timestamp">
              {getRelativeTime(timestamp)}
            </Typography.Text>
          </div>
        </div>

        {fieldOperation && fieldOperation !== FieldOperation.None && (
          <Typography.Text
            className="announcement-title"
            style={{
              fontWeight: 600,
              margin: '0 0 4px 0',
            }}>
            {title}
          </Typography.Text>
        )}

        {description && (
          <RichTextEditorPreviewerV1
            className="text-grey-muted m-0 text-xss"
            data-testid="announcement-message"
            markdown={description}
            maxLength={200}
            showReadMoreBtn={false}
          />
        )}

        {columnName && (
          <Typography.Paragraph className="column-info">
            {t('label.column-name')}:{' '}
            <Typography.Text className="column-name">
              {columnName}
            </Typography.Text>
          </Typography.Paragraph>
        )}
      </div>
    </Card>
  );
};

export default AnnouncementCardV1;
