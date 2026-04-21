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
import { Card } from 'antd';
import classNames from 'classnames';
import { useMemo } from 'react';
import { Thread } from '../../../../../generated/entity/feed/thread';
import { getEntityFQN, getEntityType } from '../../../../../utils/FeedUtils';
import { getEntityIcon } from '../../../../../utils/TableUtils';
import './announcement-card-v1.less';
import AnnouncementCardV1Content from './AnnouncementCardV1Content.component';

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

  const entityIcon = useMemo(() => {
    return getEntityIcon(entityType);
  }, [entityType, currentBackgroundColor]);

  const handleCardClick = () => {
    onClick();
  };

  return (
    <Card
      className={classNames('announcement-card-v1', disabled ? 'disabled' : '')}
      data-testid={`announcement-card-v1-${announcement.id}`}
      onClick={handleCardClick}>
      <AnnouncementCardV1Content
        columnName={columnName}
        currentBackgroundColor={currentBackgroundColor}
        description={description}
        entityFQN={entityFQN}
        entityIcon={entityIcon}
        entityName={entityName}
        entityType={entityType}
        fieldOperation={fieldOperation}
        timestamp={timestamp}
        title={title}
        userName={userName}
      />
    </Card>
  );
};

export default AnnouncementCardV1;
