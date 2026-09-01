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

import { Box, Tooltip, Typography } from '@openmetadata/ui-core-components';
import { Focusable } from 'react-aria-components';
import { Link } from 'react-router-dom';
import { NO_DATA } from '../../../constants/constants';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getTagName, getTagRedirectLink } from '../../../utils/TagsPureUtils';
import { getTagTooltip } from '../../../utils/TagsUtils';
import TagChip from '../atoms/TagChip/TagChip';

interface TagBadgeListProps {
  tags: TagLabel[];
  size?: 'sm' | 'lg';
}

const TAG_CHIP_SIZE_MAP = {
  sm: 'small',
  lg: 'medium',
} as const;

const TagBadgeList = ({ tags, size = 'sm' }: TagBadgeListProps) => {
  if (!tags.length) {
    return <Typography size="text-sm">{NO_DATA}</Typography>;
  }

  const firstTag = tags[0];
  const remaining = tags.length - 1;
  const tagName = getTagName(firstTag, true);
  const redirectLink = getTagRedirectLink(firstTag);

  return (
    <Box align="center" direction="row" gap={1}>
      <Tooltip
        arrow
        delay={500}
        placement="top"
        title={getTagTooltip(firstTag.tagFQN, firstTag.description) ?? ''}>
        <Focusable>
          <Link
            className="tw:w-max"
            data-testid="tag-redirect-link"
            to={redirectLink}>
            <TagChip
              data-testid="tags"
              icon={firstTag.style?.iconURL}
              label={tagName}
              labelDataTestId={`tag-${firstTag.tagFQN}`}
              size={TAG_CHIP_SIZE_MAP[size]}
              tagColor={firstTag.style?.color}
              variant="blueGray"
            />
          </Link>
        </Focusable>
      </Tooltip>
      {remaining > 0 && (
        <Typography size="text-xs" weight="medium">
          +{remaining}
        </Typography>
      )}
    </Box>
  );
};

export default TagBadgeList;
