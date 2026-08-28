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
import { MouseEvent, ReactNode } from 'react';
import { NO_DATA } from '../../../../../constants/constants';
import { DataProduct } from '../../../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../../../generated/entity/domains/domain';
import { EntityReference } from '../../../../../generated/entity/type';
import { TagLabel } from '../../../../../generated/type/tagLabel';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getEntityAvatarProps } from '../../../../../utils/IconUtils';
import {
  getClassificationTags,
  getGlossaryTags,
} from '../../../../../utils/TagsPureUtils';
import { renderBreakableTooltip } from '../../../../../utils/TooltipUtils';
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

// Long entity names must clip to a single line with a tooltip carrying the full
// name. The table is `table-layout: auto`, so the max-width is what stops a long
// name from widening the column - it is the clip boundary, not decoration.
// `min-w-0` lets the name shrink below its content width so the ellipsis lands.
export const NAME_CELL_CLIP_CLASS = 'tw:max-w-[480px] tw:min-w-0';
export const COMPACT_CELL_CLIP_CLASS = 'tw:max-w-[320px] tw:min-w-0';
export const CARD_NAME_CLIP_CLASS = 'tw:min-w-0';

// `ellipsis` wraps the text in react-aria's TooltipTrigger, which renders a
// `<button>` - and the UA stylesheet centers a button's text. The default
// Typography element is an inline `<span>`, so `text-left` alone would not
// apply; `block` makes it a block container so the left alignment takes effect.
export const CLIPPED_NAME_CLASS = 'tw:block tw:text-left';

// The empty states share the list body with the table and card branches, which
// get `tw:min-h-0 tw:flex-1`. Only the full-height shell pins the card to a
// height, so elsewhere `flex-1` resolves to nothing and the placeholder
// collapses onto its own content - the text then sits on the card's bottom
// border. The floor gives it a block tall enough to centre in either way.
//
// The centring utilities are here rather than left to the placeholder because
// `CoreCreateErrorPlaceHolder` asks for it with `tw:flex-center`, which is a
// legacy Less class name that the `tw:` prefix never resolves - so that box
// stays `display: block` and pins its content to the top of whatever height it
// is given. Supplying the real utilities from the call site fixes these two
// pages without touching a placeholder that many other screens render.
export const LIST_EMPTY_STATE_CLASS =
  'tw:flex tw:flex-1 tw:min-h-60 tw:items-center tw:justify-center';

export const renderDomainNameCell = (
  entity: Domain | DataProduct,
  onClick?: () => void
): ReactNode => {
  const entityName = getEntityName(entity);

  const handleNameClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onClick?.();
  };

  return (
    <Box
      align="center"
      className={NAME_CELL_CLIP_CLASS}
      direction="row"
      gap={3}
      onClick={onClick ? handleNameClick : undefined}>
      <Avatar size="md" {...getEntityAvatarProps(entity)} />
      <Typography
        className={CLIPPED_NAME_CLASS}
        ellipsis={{ tooltip: renderBreakableTooltip(entityName) }}
        size="text-sm"
        weight="medium">
        {entityName}
      </Typography>
    </Box>
  );
};

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
