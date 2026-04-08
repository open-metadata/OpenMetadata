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

import {
  BadgeWithIcon,
  Box,
  Typography,
} from '@openmetadata/ui-core-components';
import { Tag01 } from '@untitledui/icons';
import { NO_DATA } from '../../../constants/constants';
import { TagLabel } from '../../../generated/type/tagLabel';
interface TagBadgeListProps {
  tags: TagLabel[];
  size?: 'sm' | 'lg';
}

const TagBadgeList = ({ tags, size = 'sm' }: TagBadgeListProps) => {
  if (!tags.length) {
    return <Typography size="text-sm">{NO_DATA}</Typography>;
  }

  const firstTag = tags[0];
  const remaining = tags.length - 1;

  return (
    <Box align="center" direction="row" gap={1}>
      <BadgeWithIcon color="gray" iconLeading={Tag01} size={size} type="color">
        {firstTag.displayName || firstTag.tagFQN}
      </BadgeWithIcon>
      {remaining > 0 && (
        <Typography size="text-xs" weight="medium">
          +{remaining}
        </Typography>
      )}
    </Box>
  );
};

export default TagBadgeList;
