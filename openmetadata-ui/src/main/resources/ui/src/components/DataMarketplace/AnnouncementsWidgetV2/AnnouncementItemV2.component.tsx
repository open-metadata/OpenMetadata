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

import { useMemo } from 'react';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import { getEntityFQN, getEntityType } from '../../../utils/FeedUtils';
import { getEntityIcon } from '../../../utils/TableUtils';
import AnnouncementCardV1Content from '../../MyData/Widgets/AnnouncementsWidgetV1/AnnouncementCardV1/AnnouncementCardV1Content.component';

interface AnnouncementItemV2Props {
  announcement: AnnouncementEntity;
  onClick: () => void;
}

const AnnouncementItemV2 = ({
  announcement,
  onClick,
}: AnnouncementItemV2Props) => {
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
    const entityLink = announcement.entityLink ?? '';
    const fqn = getEntityFQN(entityLink);
    const entityName = fqn.split('::').pop() || '';
    const entityType = getEntityType(entityLink);

    return {
      title: announcement.displayName ?? announcement.name,
      description: announcement.description || '',
      userName: announcement.createdBy || '',
      timestamp: announcement.updatedAt ?? announcement.createdAt ?? Date.now(),
      entityName,
      entityType,
      entityFQN: fqn,
      fieldOperation: undefined,
      columnName: '',
    };
  }, [announcement]);

  const entityIcon = useMemo(() => {
    return getEntityIcon(entityType);
  }, [entityType]);

  return (
    <div
      data-testid={`announcement-item-${announcement.id}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}>
      <AnnouncementCardV1Content
        columnName={columnName}
        currentBackgroundColor="var(--color-utility-blue-100)"
        description={description}
        entityFQN={entityFQN}
        entityIcon={entityIcon}
        entityName={entityName}
        entityType={entityType}
        fieldOperation={fieldOperation}
        timestamp={timestamp}
        title={title}
        userName={userName}
        variant="compact"
      />
    </div>
  );
};

export default AnnouncementItemV2;
