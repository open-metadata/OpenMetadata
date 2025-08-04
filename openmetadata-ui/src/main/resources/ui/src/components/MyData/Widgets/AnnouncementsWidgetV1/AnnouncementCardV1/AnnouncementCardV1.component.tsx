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
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  FieldOperation,
  Thread,
} from '../../../../../generated/entity/feed/thread';
import { getFieldOperationText } from '../../../../../utils/AnnouncementsUtils';
import { getShortRelativeTime } from '../../../../../utils/date-time/DateTimeUtils';
import entityUtilClassBase from '../../../../../utils/EntityUtilClassBase';
import { getEntityFQN, getEntityType } from '../../../../../utils/FeedUtils';
import { getUserPath } from '../../../../../utils/RouterUtils';
import { getEntityIcon } from '../../../../../utils/TableUtils';
import RichTextEditorPreviewerV1 from '../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import './announcement-card-v1.less';

interface AnnouncementCardV1Props {
  announcement: Thread;
  currentBackgroundColor?: string;
  disabled?: boolean;
  onClick: () => void;
}

const AnnouncementCardV1 = ({
  announcement,
  currentBackgroundColor,
  disabled,
  onClick,
}: AnnouncementCardV1Props) => {
  const { t } = useTranslation();

  const {
    columnName,
    description,
    entityFQN,
    entityName,
    entityType,
    fieldOperation,
    timestamp,
    title,
    userName,
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
    timeStampStyle,
  } = useMemo(() => {
    if (!currentBackgroundColor) {
      return {};
    }

    return {
      announcementTitleSectionStyle: {
        background: `linear-gradient(270deg, #ffffff -12.07%, ${currentBackgroundColor} 500.72%)`,
        color: `${currentBackgroundColor} !important`,
      },
      announcementTitleStyle: {
        borderLeft: `3px solid ${currentBackgroundColor}`,
        color: `${currentBackgroundColor} !important`,
      },
      userNameStyle: {
        color: currentBackgroundColor,
      },
      timeStampStyle: {
        color: currentBackgroundColor,
        '&.ant-typography': {
          color: `${currentBackgroundColor} !important`,
        },
      },
    };
  }, [currentBackgroundColor]);

  const entityIcon = useMemo(() => {
    return getEntityIcon(entityType);
  }, [entityType, currentBackgroundColor]);

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
      className={classNames('announcement-card-v1', disabled ? 'disabled' : '')}
      data-testid={`announcement-card-v1-${announcement.id}`}
      onClick={handleCardClick}>
      <div className="announcement-card-v1-content">
        <div className="announcement-header-container">
          <div
            className="announcement-title-section"
            style={announcementTitleSectionStyle}>
            {fieldOperation && fieldOperation !== FieldOperation.None ? (
              <div
                className="announcement-header"
                style={announcementTitleStyle}>
                <Link
                  className="user-name"
                  data-testid="user-link"
                  style={userNameStyle}
                  to={getUserPath(userName)}
                  onClick={handleUserClick}>
                  {userName}
                </Link>
                <Typography.Text
                  className="field-operation-text"
                  style={{
                    color: currentBackgroundColor ?? 'inherit',
                  }}>
                  {' '}
                  {getFieldOperationText(fieldOperation)}
                </Typography.Text>
                <span
                  className="announcement-card-entity-icon"
                  style={{
                    color: currentBackgroundColor ?? 'inherit',
                  }}>
                  {entityIcon}
                </span>
                {entityFQN && entityType ? (
                  <Typography.Text
                    ellipsis={{
                      tooltip: (
                        <div className="announcement-entity-name-tooltip">
                          {entityName}
                        </div>
                      ),
                    }}
                    style={{
                      color: currentBackgroundColor ?? 'inherit',
                    }}>
                    <Link
                      className="announcement-entity-name"
                      data-testid="announcement-entity-link"
                      style={{
                        color: currentBackgroundColor ?? 'inherit',
                      }}
                      to={entityUtilClassBase.getEntityLink(
                        entityType,
                        entityFQN
                      )}
                      onClick={handleEntityClick}>
                      {entityName}
                    </Link>
                  </Typography.Text>
                ) : (
                  <Typography.Text
                    className="announcement-entity-name"
                    ellipsis={{ tooltip: true }}
                    style={{
                      color: currentBackgroundColor ?? 'inherit',
                    }}>
                    {entityName}
                  </Typography.Text>
                )}
              </div>
            ) : (
              <Typography.Text
                className="announcement-header"
                style={announcementTitleStyle}>
                {title}
              </Typography.Text>
            )}
            <Typography.Text className="timestamp" style={timeStampStyle}>
              {getShortRelativeTime(timestamp)}
            </Typography.Text>
          </div>
        </div>

        {fieldOperation && fieldOperation !== FieldOperation.None && (
          <Typography.Paragraph
            className="announcement-title"
            ellipsis={{ tooltip: true, rows: 2 }}>
            {title}
            {columnName && (
              <Typography.Text>
                {`${t('label.column-name')}: ${columnName}`}
              </Typography.Text>
            )}
          </Typography.Paragraph>
        )}

        {description && (
          <RichTextEditorPreviewerV1
            className="announcement-description"
            data-testid="announcement-description"
            markdown={description}
            maxLength={200}
            showReadMoreBtn={false}
          />
        )}
      </div>
    </Card>
  );
};

export default AnnouncementCardV1;
