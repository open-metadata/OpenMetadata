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

import { Badge } from '@openmetadata/ui-core-components';
import React, { useMemo } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import searchClassBase from '../../../../utils/SearchClassBase';
import EntityPopOverCard from '../../PopOverCard/EntityPopOverCard';

export interface EntityPillProps {
  entityType: EntityType;
  fullyQualifiedName: string;
  label: string;
}

const EntityPill: React.FC<EntityPillProps> = ({
  entityType,
  fullyQualifiedName,
  label,
}) => {
  const icon = useMemo(() => {
    return searchClassBase.getEntityIcon(entityType);
  }, [entityType]);

  return (
    <EntityPopOverCard entityFQN={fullyQualifiedName} entityType={entityType}>
      <Badge
        className="tw:bg-gray-blue-50 tw:border-gray-blue-100"
        size="lg"
        type="modern">
        <span className="tw:flex tw:items-center tw:w-5 tw:h-5 tw:mr-1.5">
          {icon}
        </span>
        {label}
      </Badge>
    </EntityPopOverCard>
  );
};

export default EntityPill;
