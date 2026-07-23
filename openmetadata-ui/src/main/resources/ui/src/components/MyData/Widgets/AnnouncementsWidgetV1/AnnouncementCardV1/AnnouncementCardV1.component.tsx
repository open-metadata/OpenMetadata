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
import { Card, Typography } from 'antd';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnnouncementEntity } from '../../../../../rest/announcementsAPI';
import {
  getEntityFQN,
  getEntityType,
} from '../../../../../utils/FeedUtilsPure';
import { getEntityIcon } from '../../../../../utils/TableUtils';
import './announcement-card-v1.less';
import AnnouncementCardV1Content from './AnnouncementCardV1Content.component';
interface AnnouncementCardV1Props {
  announcement: AnnouncementEntity;
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
    description,
    entityFQN,
    entityName,
    entityType,
    timestamp,
    title,
    userName,
  } = useMemo(() => {
    const fqn = getEntityFQN(announcement.entityLink ?? '');

    return {
      title: announcement.displayName ?? announcement.name,
      description: announcement.description || '',
      userName: announcement.createdBy || '',
      timestamp: announcement.updatedAt ?? announcement.createdAt,
      entityName: fqn.split('::').pop() || '',
      entityType: getEntityType(announcement.entityLink ?? ''),
      entityFQN: fqn,
    };
  }, [announcement]);

  const entityIcon = useMemo(() => getEntityIcon(entityType), [entityType]);

  const gradientBackground = currentBackgroundColor
    ? `linear-gradient(270deg, #ffffff -12.07%, ${currentBackgroundColor} 500.72%)`
    : undefined;

  return (
    <Card
      className={classNames('announcement-card-v1', disabled ? 'disabled' : '')}
      data-testid={`announcement-card-v1-${announcement.id}`}
      onClick={onClick}>
      <AnnouncementCardV1Content
        backgroundColor={gradientBackground}
        columnName=""
        currentBackgroundColor={currentBackgroundColor}
        description={description}
        entityFQN={entityFQN}
        entityIcon={entityIcon}
        entityName={entityName}
        entityType={entityType}
        timestamp={timestamp}
        title={title}
        userName={userName}
      />
      {!description && (
        <Typography.Text className="text-grey-muted text-xs">
          {t('message.no-announcement-message')}
        </Typography.Text>
      )}
    </Card>
  );
};

export default AnnouncementCardV1;
