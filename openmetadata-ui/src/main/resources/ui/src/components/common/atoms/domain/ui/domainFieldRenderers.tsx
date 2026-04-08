/*
 *  Copyright 2024 Collate.
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

import { Avatar, Box, Typography } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { NO_DATA } from '../../../../../constants/constants';
import { DataProduct } from '../../../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../../../generated/entity/domains/domain';
import { EntityReference } from '../../../../../generated/entity/type';
import { TagLabel } from '../../../../../generated/type/tagLabel';
import { getEntityName } from '../../../../../utils/EntityUtils';
import { getEntityAvatarProps } from '../../../../../utils/IconUtils';
import {
  getClassificationTags,
  getGlossaryTags,
} from '../../../../../utils/TagsUtils';
import { DomainTypeChip } from '../../../../DomainListing/components/DomainTypeChip';
import { OwnerLabel } from '../../../OwnerLabel/OwnerLabel.component';
import TagBadgeList from '../../../TagBadgeList/TagBadgeList.component';

type TagSize = 'sm' | 'lg';

interface TaggedEntity {
  tags?: TagLabel[];
}

interface OwnedEntity {
  owners?: EntityReference[];
}

export const renderDomainNameCell = (
  entity: Domain | DataProduct
): ReactNode => (
  <Box align="center" direction="row" gap={3}>
    <Avatar size="md" {...getEntityAvatarProps(entity)} />
    <Typography size="text-sm" weight="medium">
      {getEntityName(entity)}
    </Typography>
  </Box>
);

export const renderDomainTypeCell = (entity: Domain): ReactNode =>
  entity.domainType ? (
    <DomainTypeChip domainType={entity.domainType} />
  ) : (
    <Typography size="text-sm">{NO_DATA}</Typography>
  );

export const renderDomainOwnersCell = (entity: OwnedEntity): ReactNode => (
  <OwnerLabel
    isCompactView={false}
    maxVisibleOwners={4}
    owners={entity.owners}
    showLabel={false}
  />
);

export const renderDomainGlossaryTagsCell = (
  entity: TaggedEntity,
  options?: { size?: TagSize }
): ReactNode => (
  <TagBadgeList size={options?.size} tags={getGlossaryTags(entity.tags)} />
);

export const renderDomainClassificationTagsCell = (
  entity: TaggedEntity,
  options?: { size?: TagSize }
): ReactNode => (
  <TagBadgeList
    size={options?.size}
    tags={getClassificationTags(entity.tags)}
  />
);
