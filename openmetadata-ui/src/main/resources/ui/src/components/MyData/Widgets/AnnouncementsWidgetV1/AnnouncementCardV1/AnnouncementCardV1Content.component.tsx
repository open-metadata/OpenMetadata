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
import { Typography } from 'antd';
import classNames from 'classnames';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FieldOperation } from '../../../../../generated/entity/feed/thread';
import { getFieldOperationText } from '../../../../../utils/AnnouncementsUtils';
import { getShortRelativeTime } from '../../../../../utils/date-time/DateTimeUtils';
import entityUtilClassBase from '../../../../../utils/EntityUtilClassBase';
import { getUserPath } from '../../../../../utils/RouterUtils';
import RichTextEditorPreviewerV1 from '../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import './announcement-card-v1-content.less';

const PRIMARY_COLOR = 'var(--ant-primary-color)';

interface AnnouncementCardV1ContentProps {
  className?: string;
  columnName: string;
  currentBackgroundColor?: string;
  description: string;
  entityFQN: string;
  entityIcon: ReactNode;
  entityName: string;
  entityType: string;
  fieldOperation?: FieldOperation;
  timestamp?: number;
  title: string;
  userName: string;
  variant?: 'default' | 'compact';
}

const VARIANT_CONFIG = {
  default: {
    header: 'tw:h-11 tw:text-[16px] tw:rounded-lg',
    entityName: 'tw:!text-base tw:!font-medium',
    iconSize: 'tw:size-4',
    title: 'tw:text-sm tw:font-medium tw:!mb-1',
    description: 'tw:text-sm tw:mt-2',
  },
  compact: {
    header: 'tw:h-[30px] tw:text-xs tw:rounded-l-md',
    entityName: 'tw:!text-[11px] tw:!font-normal',
    iconSize: 'tw:size-[9px]',
    title: 'tw:text-xs tw:font-medium tw:!mb-0',
    description: 'tw:!text-[11px] tw:!font-normal tw:!leading-none tw:!mt-0',
  },
};

const AnnouncementCardV1Content = ({
  className,
  columnName,
  currentBackgroundColor,
  description,
  entityFQN,
  entityIcon,
  entityName,
  entityType,
  fieldOperation,
  timestamp,
  title,
  userName,
  variant = 'default',
}: AnnouncementCardV1ContentProps) => {
  const variantConfig = VARIANT_CONFIG[variant];
  const { t } = useTranslation();

  const color = currentBackgroundColor ?? PRIMARY_COLOR;

  const {
    announcementTitleSectionStyle,
    announcementTitleStyle,
    userNameStyle,
    timeStampStyle,
  } = useMemo(() => {
    return {
      announcementTitleSectionStyle: {
        background: `linear-gradient(270deg, #ffffff -12.07%, ${color} 500.72%)`,
        color: `${color} !important`,
      },
      announcementTitleStyle: {
        borderLeft: `3px solid ${color}`,
        color: `${color} !important`,
      },
      userNameStyle: {
        color,
      },
      timeStampStyle: {
        color,
      },
    };
  }, [color]);

  const handleEntityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className={classNames('announcement-card-v1-content', className)}>
      <div className="announcement-header-container">
        <div
          className={classNames(
            'announcement-title-section',
            variantConfig.header
          )}
          style={announcementTitleSectionStyle}>
          {fieldOperation && fieldOperation !== FieldOperation.None ? (
            <div
              className={classNames(
                'announcement-header',
                variantConfig.header
              )}
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
                style={{ color }}>
                {' '}
                {getFieldOperationText(fieldOperation)}
              </Typography.Text>
              <span
                className={classNames(
                  'announcement-card-entity-icon tw:flex tw:items-center',
                  variantConfig.iconSize
                )}
                style={{ color }}>
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
                    className={classNames(
                      'announcement-entity-name',
                      variantConfig.entityName
                    )}
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
                  className={classNames(
                    'announcement-entity-name',
                    variantConfig.entityName
                  )}
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
          className={classNames('announcement-title', variantConfig.title)}
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
          className={classNames(
            'announcement-description',
            variantConfig.description
          )}
          data-testid="announcement-description"
          markdown={description}
          maxLength={200}
          showReadMoreBtn={false}
        />
      )}
    </div>
  );
};

export default AnnouncementCardV1Content;
