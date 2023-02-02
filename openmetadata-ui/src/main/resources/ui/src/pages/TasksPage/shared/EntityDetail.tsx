/*
 *  Copyright 2022 Collate.
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

import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import { EntityTags } from 'Models';
import React, { useMemo } from 'react';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { getEntityName } from '../../../utils/CommonUtils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import { EntityData } from '../TasksPage.interface';

interface EntityDetailProps {
  entityData: EntityData;
}

const EntityDetail: React.FC<EntityDetailProps> = ({ entityData }) => {
  const entityTier = useMemo(() => {
    const tierFQN = getTierTags(entityData.tags || [])?.tagFQN;

    return tierFQN?.split(FQN_SEPARATOR_CHAR)[1];
  }, [entityData.tags]);

  const entityTags = useMemo(() => {
    const tags: EntityTags[] = getTagsWithoutTier(entityData.tags || []) || [];

    return tags.map((tag) => `#${tag.tagFQN}`).join('  ');
  }, [entityData.tags]);

  return (
    <div data-testid="entityDetail">
      <div className="tw-flex tw-ml-6">
        <span className="tw-text-grey-muted">Owner:</span>{' '}
        <span>
          {entityData.owner ? (
            <span className="tw-flex tw-ml-1">
              <ProfilePicture
                displayName={getEntityName(entityData.owner)}
                id=""
                name={getEntityName(entityData.owner)}
                width="20"
              />
              <span className="tw-ml-1">{getEntityName(entityData.owner)}</span>
            </span>
          ) : (
            <span className="tw-text-grey-muted tw-ml-1">No Owner</span>
          )}
        </span>
        <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">|</span>
        <p data-testid="tier">
          {entityTier ? (
            entityTier
          ) : (
            <span className="tw-text-grey-muted">No Tier</span>
          )}
        </p>
      </div>
      <p className="tw-ml-6" data-testid="tags">
        {entityTags}
      </p>
    </div>
  );
};

export default EntityDetail;
